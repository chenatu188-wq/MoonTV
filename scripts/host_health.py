#!/usr/bin/env python3
"""按主機分組的源站健檢。

2026-10-23 新增。起因是 php2shell（CVE-2026-109618/109619）：config.json 裡
271 個源有 269 個走 `/api.php/provide/vod`，也就是蘋果CMS（PHP）。那批站多半
不會乖乖更新 PHP，預期接下來陸續掉源。

為什麼要按主機分組
-------------------
271 個源其實只擠在 57 個主機名上，`tyyszy.com` 一台就掛了 15 個源。所以「死了
12 個源」可能只是一台機器在重開，也可能是十二台各死一個 —— 這兩件事的處置完全
不同，但看扁平的死源清單分不出來。

這支只負責「測 + 分組 + 報」，不改 config.json。要不要移除由人決定，因為單一
主機整台死亡最常見的原因是暫時性的，隔天就回來了。

用法
-----
    python3 scripts/host_health.py                 # 測當前 checkout 的 config.json
    python3 scripts/host_health.py --group 🔞       # 只測某個群組
    python3 scripts/host_health.py --json           # 機器可讀
    python3 scripts/host_health.py --no-state       # 不讀寫週對週狀態檔
"""
from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlsplit

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(REPO, "config.json")
# 狀態檔放 repo 外：它是本機觀察紀錄，不該進版本庫也不該被 git checkout 切掉
STATE = os.path.expanduser("~/Library/Application Support/moontv/host_health.json")

TIMEOUT = 8
WORKERS = 20
# 讀多少 body。第一版設 200 KB，結果把回應較大的源（caiji.maotaizy.cc、
# api.yzzy-api.com）截斷成不完整的 JSON，誤判 18 個源死亡。videolist 一頁
# 通常幾十到幾百 KB，給 5 MB；真的碰到上限就改用關鍵字判斷不硬解析。
MAX_BODY = 5_000_000
# 必須和 src/lib/config.ts:27-31 的 API_CONFIG.search.headers 完全一致。
# 第一版用自己編的 Mac UA 又沒帶 Accept，api.wujinapi.me 等源的搜尋端點直接回
# 403 —— 看起來像源壞了，其實是我的請求被擋。測活工具的請求必須長得像真正的
# 消費端，否則測的是「這個源對我友善嗎」而不是「這個源對 MoonTV 可用嗎」。
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
HDRS = {"User-Agent": UA, "Accept": "application/json"}


def host_of(url: str) -> str:
    """主機名，去掉 www. 前綴。

    config.json 裡 `iqiyizyapi.com` 和 `www.iqiyizyapi.com` 是同一個後端，
    不折平的話一台機器掛掉會被報成兩台各掛一部分。
    """
    netloc = urlsplit(url).netloc
    if not netloc:
        return "（無法解析）"
    return netloc[4:] if netloc.startswith("www.") else netloc


def is_php(url: str) -> bool:
    return ".php" in urlsplit(url).path


def probe(api: str) -> tuple[bool, str, str]:
    """列表測活 + 搜尋測活。回傳 (活著, 原因)。

    兩段都要測。只測列表會漏掉「半死源」：`?ac=list` 和 `?ac=videolist` 都回
    正常 JSON，但 `?ac=videolist&wd=` 搜尋回「暂不支持搜索」。MoonTV 的聚合
    搜尋全靠 wd=（src/lib/config.ts:121-122），搜尋被關的源等於廢源。
    這是舊週清查已知的盲點（案例：旺旺死後域名被天涯站系列吸收）。

    搜尋關鍵詞不寫死 —— 從列表第一筆片名取兩個字來搜，保證這個詞在該源上
    一定有資料，回空就真的是搜尋壞了而不是剛好沒片。
    """
    alive, why, sample = probe_list(api)
    if not alive:
        return False, why, "dead"
    if sample is None:
        return True, why + "（拿不到片名，略過搜尋測試）", "ok"
    ok, swhy = probe_search(api, sample)
    if not ok:
        if swhy == "CF_CHALLENGE":
            # 存疑不算死：從本機看不出 prod 拿不拿得到
            return True, "搜尋被 Cloudflare 擋（本機測；prod 出口 IP 不同）", "cf"
        return False, f"列表正常但搜尋壞了：{swhy}", "half"
    return True, why, "ok"


CF_MARKERS = (b"Just a moment", b"cf-browser-verification",
              b"challenge-platform", b"cf_chl_opt", b"Attention Required")


def looks_like_cf(body: bytes) -> bool:
    """Cloudflare 的人機挑戰。常常以 403 回來，所以錯誤分支也要檢查 body。"""
    return any(m in body for m in CF_MARKERS)


def probe_search(api: str, term: str) -> tuple[bool, str]:
    """用一個保證有資料的詞測搜尋。"""
    from urllib.parse import quote
    url = api + ("&" if "?" in api else "?") + f"ac=videolist&wd={quote(term)}"
    req = urllib.request.Request(url, headers=HDRS)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                return False, f"HTTP {resp.status}"
            body = resp.read(MAX_BODY)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read()
        except Exception:                       # noqa: BLE001
            err_body = b""
        if looks_like_cf(err_body):
            return False, "CF_CHALLENGE"
        return False, f"HTTP {e.code}"
    except Exception as e:                      # noqa: BLE001
        return False, f"{type(e).__name__}"

    if len(body) >= MAX_BODY:
        return True, "ok"
    # Cloudflare 的人機挑戰不是源壞了，是我們的 IP 被擋。prod 在 Zeabur，
    # 出口 IP 和這台機器不同，所以本機測到挑戰頁不代表 prod 也拿不到。
    if looks_like_cf(body):
        return False, "CF_CHALLENGE"
    try:
        data = json.loads(body)
    except ValueError:
        head = body[:40].decode("utf-8", "replace").strip()
        return False, f"非 JSON「{head}」"
    if not isinstance(data, dict):
        return False, "JSON 不是物件"
    rows = data.get("list") or data.get("videolist") or []
    if rows:
        return True, "ok"
    # 回空：看看有沒有明說不支援
    msg = str(data.get("msg") or data.get("message") or "")
    if "搜索" in msg or "search" in msg.lower():
        return False, f"回「{msg[:20]}」"
    return False, f"搜「{term}」回 0 筆（該詞在列表裡存在）"


def probe_list(api: str) -> tuple[bool, str, str | None]:
    """列表測活。第三個回傳值是可用來測搜尋的片名片段（拿不到就 None）。"""
    url = api + ("&" if "?" in api else "?") + "ac=videolist&pg=1"
    req = urllib.request.Request(url, headers=HDRS)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                return False, f"HTTP {resp.status}", None
            body = resp.read(MAX_BODY)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}", None
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, socket.gaierror):
            return False, "DNS 解析失敗", None
        if isinstance(reason, socket.timeout):
            return False, f"timeout {TIMEOUT}s", None
        return False, f"連線失敗：{str(reason)[:48]}", None
    except socket.timeout:
        return False, f"timeout {TIMEOUT}s", None
    except Exception as e:                      # noqa: BLE001 — 任何意外都算死源
        return False, f"{type(e).__name__}: {str(e)[:40]}", None

    if len(body) >= MAX_BODY:
        # 可能被截斷，硬解析一定失敗。改看關鍵字，寧可寬鬆也不要誤殺活源。
        if any(k in body for k in (b'"videolist"', b'"list"', b'"total"')):
            return True, f"ok（回應 >{MAX_BODY // 1_000_000}MB，用關鍵字判斷）", None
        return False, f"回應 >{MAX_BODY // 1_000_000}MB 且不含 videolist/list/total", None

    try:
        data = json.loads(body)
    except ValueError:
        head = body[:40].decode("utf-8", "replace").strip()
        return False, f"非 JSON（開頭「{head}」）", None
    if not isinstance(data, dict):
        return False, "JSON 不是物件", None
    if not any(k in data for k in ("videolist", "list", "total")):
        return False, f"缺 videolist/list/total（鍵：{','.join(list(data)[:4])}）", None

    return True, "ok", sample_term(data)


def sample_term(data: dict) -> str | None:
    """從列表挑一個「這個源上一定有資料」的搜尋詞。

    取第一筆片名裡連續兩個中日韓文字；沒有就退回前兩個字元。太短的片名跳過，
    因為單字搜尋很多站會當成空查詢。
    """
    rows = data.get("list") or data.get("videolist") or []
    for r in rows[:5]:
        if not isinstance(r, dict):
            continue
        name = str(r.get("vod_name") or r.get("name") or r.get("title") or "").strip()
        if len(name) < 2:
            continue
        m = re.search(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]{2}", name)
        return m.group(0) if m else name[:2]
    return None


def load_sites(path: str, group: str | None) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        sites = json.load(f)["api_site"]
    if group:
        sites = {k: v for k, v in sites.items() if v.get("group") == group}
    return sites


def read_state() -> dict:
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def write_state(state: dict) -> None:
    try:
        os.makedirs(os.path.dirname(STATE), exist_ok=True)
        with open(STATE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=1)
    except OSError as e:
        print(f"（狀態檔寫不進去，週對週比較下次會從頭算：{e}）", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(description="按主機分組的 MoonTV 源站健檢")
    ap.add_argument("--config", default=CONFIG)
    ap.add_argument("--group", default=None, help="只測這個 group（例：🔞）")
    ap.add_argument("--json", action="store_true", dest="as_json")
    ap.add_argument("--no-state", action="store_true", help="不讀寫週對週狀態檔")
    args = ap.parse_args()

    sites = load_sites(args.config, args.group)
    if not sites:
        print("沒有符合條件的源", file=sys.stderr)
        return 1

    keys = list(sites)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(lambda k: probe(sites[k]["api"]), keys))

    byhost: dict[str, list[dict]] = defaultdict(list)
    half_dead: list[dict] = []
    cf_blocked: list[dict] = []
    for key, (alive, why, kind) in zip(keys, results):
        v = sites[key]
        rec = {
            "key": key, "name": v.get("name", key), "group": v.get("group", "—"),
            "alive": alive, "why": why, "kind": kind,
            "host": host_of(v["api"]), "php": is_php(v["api"]),
        }
        if kind == "half":
            half_dead.append(rec)
        elif kind == "cf":
            cf_blocked.append(rec)
        byhost[rec["host"]].append(rec)

    dead_total = sum(1 for _, (a, _, _) in zip(keys, results) if not a)
    # 半死源（搜尋被關）不算「可能暫時性」—— 那是設定狀態不是故障，可以直接移除。
    # 所以歸類時把它排除在整台死亡之外，否則會被貼上「先別急著移除」的標籤。
    def connectivity_dead(i):
        return not i["alive"] and i["kind"] == "dead"
    whole_down = {h: items for h, items in byhost.items()
                  if items and all(connectivity_dead(i) for i in items)}
    partial = {h: items for h, items in byhost.items()
               if any(connectivity_dead(i) for i in items) and h not in whole_down}

    # 週對週：這次新死的主機。--no-state 時沒有上週資料，就不要把全部都標成新死。
    state = {} if args.no_state else read_state()
    has_baseline = bool(state)
    prev_down = set(state.get("whole_down", []))
    newly_down = sorted(set(whole_down) - prev_down) if has_baseline else []
    recovered = sorted(prev_down - set(whole_down)) if has_baseline else []

    if args.as_json:
        json.dump({
            "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "config": args.config, "group": args.group,
            "total": len(keys), "dead": dead_total, "hosts": len(byhost),
            "whole_down": sorted(whole_down), "partial_down": sorted(partial),
            "half_dead": half_dead, "cf_blocked": cf_blocked,
            "newly_down": newly_down, "recovered": recovered,
            "detail": {h: items for h, items in sorted(byhost.items())},
        }, sys.stdout, ensure_ascii=False, indent=1)
        print()
    else:
        php_n = sum(1 for items in byhost.values() for i in items if i["php"])
        conn_dead = sum(1 for items in byhost.values()
                        for i in items if not i["alive"] and i["kind"] == "dead")
        print(f"源 {len(keys)} 個，分布在 {len(byhost)} 個主機（PHP {php_n} 個）")
        print(f"  連線正常 {len(keys) - conn_dead}"
              f"（其中搜尋不可用 {len(half_dead)}、CF 擋 {len(cf_blocked)}）"
              f"、連線失敗 {conn_dead}")
        if args.group:
            print(f"群組篩選：{args.group}")
        print()

        if whole_down:
            print(f"■ 整台死亡 {len(whole_down)} 台 —— 多半是暫時性的，先別急著移除")
            for h, items in sorted(whole_down.items(), key=lambda kv: -len(kv[1])):
                whys = {i["why"] for i in items}
                flag = "  ← 本週新死" if h in newly_down else ""
                print(f"  {h}（{len(items)} 源）{flag}")
                print(f"    原因：{'、'.join(sorted(whys))}")
                print(f"    影響群組：{'、'.join(sorted({i['group'] for i in items}))}")
            print()

        if partial:
            print(f"■ 個別源死亡 {len(partial)} 台 —— 主機活著但這幾條不通，可以直接移除")
            for h, items in sorted(partial.items()):
                bad = [i for i in items if not i["alive"]]
                print(f"  {h}（死 {len(bad)}／共 {len(items)}）")
                for i in bad:
                    print(f"    {i['name']} [{i['group']}] — {i['why']}")
            print()

        if half_dead:
            # 不要寫成「可以移除」。實際查過程式碼：
            #   聚合搜尋 /api/search 走 ?ac=videolist&wd= → 這些源不可用
            #   分類瀏覽 /api/browse 走 ?ac=videolist&t=&pg= → 這些源完全正常
            # 所以移除會打爛瀏覽分類。例外是韓國分區（browse/route.ts:158 與
            # adult/latest/route.ts:51 用 &wd=韩国），那裡搜尋壞就連瀏覽也壞。
            korean = [i for i in half_dead if "韓國" in i["group"] or "韩国" in i["group"]]
            print(f"■ 搜尋不可用 {len(half_dead)} 個 —— **不要移除**。"
                  f"分類瀏覽走 t=/pg= 仍然正常，只有聚合搜尋用不到它們")
            byh = defaultdict(list)
            for i in half_dead:
                byh[i["host"]].append(i)
            for h, items in sorted(byh.items(), key=lambda kv: -len(kv[1])):
                why = items[0]["why"].split("：", 1)[-1]
                print(f"    {len(items):>2} 源  {h:24} {why[:40]}")
            if korean:
                print(f"  ⚠️ 其中 {len(korean)} 個在韓國分區，那裡瀏覽也用 &wd=韩国，"
                      f"等於整個分頁都壞 —— 這些才該移除：")
                for i in korean:
                    print(f"      {i['name']} [{i['group']}] {i['host']}")
            print()

        if cf_blocked:
            print(f"■ 搜尋被 Cloudflare 擋 {len(cf_blocked)} 個 —— 存疑，不要移除。"
                  f"本機 IP 被擋不代表 Zeabur 也被擋，要從 prod 驗")
            for i in cf_blocked:
                print(f"    {i['name']:18} [{i['group']}] {i['host']}")
            print()

        if recovered:
            print(f"■ 復活 {len(recovered)} 台：{'、'.join(recovered)}")
            print()

        if not whole_down and not partial and not half_dead and not cf_blocked:
            print("■ 全部活著")

    if not args.no_state:
        write_state({
            "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "whole_down": sorted(whole_down),
            "partial_down": sorted(partial),
        })
    return 0


if __name__ == "__main__":
    sys.exit(main())
