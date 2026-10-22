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
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 moontv-health"


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


def probe(api: str) -> tuple[bool, str]:
    """測一個源還活著嗎。回傳 (活著, 原因)。

    判準跟週清查的 prompt 一致：HTTP 200 + 合法 JSON + 含 videolist/list/total。
    """
    url = api + ("&" if "?" in api else "?") + "ac=videolist&pg=1"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                return False, f"HTTP {resp.status}"
            body = resp.read(MAX_BODY)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, socket.gaierror):
            return False, "DNS 解析失敗"
        if isinstance(reason, socket.timeout):
            return False, f"timeout {TIMEOUT}s"
        return False, f"連線失敗：{str(reason)[:48]}"
    except socket.timeout:
        return False, f"timeout {TIMEOUT}s"
    except Exception as e:                      # noqa: BLE001 — 任何意外都算死源
        return False, f"{type(e).__name__}: {str(e)[:40]}"

    if len(body) >= MAX_BODY:
        # 可能被截斷，硬解析一定失敗。改看關鍵字，寧可寬鬆也不要誤殺活源。
        if any(k in body for k in (b'"videolist"', b'"list"', b'"total"')):
            return True, f"ok（回應 >{MAX_BODY // 1_000_000}MB，用關鍵字判斷）"
        return False, f"回應 >{MAX_BODY // 1_000_000}MB 且不含 videolist/list/total"

    try:
        data = json.loads(body)
    except ValueError:
        head = body[:40].decode("utf-8", "replace").strip()
        return False, f"非 JSON（開頭「{head}」）"
    if not isinstance(data, dict):
        return False, "JSON 不是物件"
    if not any(k in data for k in ("videolist", "list", "total")):
        return False, f"缺 videolist/list/total（鍵：{','.join(list(data)[:4])}）"
    return True, "ok"


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
    for key, (alive, why) in zip(keys, results):
        v = sites[key]
        byhost[host_of(v["api"])].append({
            "key": key, "name": v.get("name", key), "group": v.get("group", "—"),
            "alive": alive, "why": why, "php": is_php(v["api"]),
        })

    dead_total = sum(1 for _, (a, _) in zip(keys, results) if not a)
    whole_down = {h: items for h, items in byhost.items()
                  if all(not i["alive"] for i in items)}
    partial = {h: items for h, items in byhost.items()
               if any(not i["alive"] for i in items) and h not in whole_down}

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
            "newly_down": newly_down, "recovered": recovered,
            "detail": {h: items for h, items in sorted(byhost.items())},
        }, sys.stdout, ensure_ascii=False, indent=1)
        print()
    else:
        php_n = sum(1 for items in byhost.values() for i in items if i["php"])
        print(f"源 {len(keys)} 個，分布在 {len(byhost)} 個主機"
              f"（PHP {php_n} 個）；死 {dead_total} 個")
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

        if recovered:
            print(f"■ 復活 {len(recovered)} 台：{'、'.join(recovered)}")
            print()

        if not whole_down and not partial:
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
