#!/usr/bin/env python3
"""找出 config.json 裡「不同域名、同一個後端」的重複源。

2026-10-23 新增。起因是 10/19 的週清查自己發現：🔞 群組登記 33 個源，但有好
幾組其實是同一個後端換域名，所以「保持 30 個活源」這個目標一直在自我安慰。

為什麼不能只看主機名
---------------------
同一台主機可以用不同路徑／參數提供不同內容（例如 155api.com 同時有綜合和韓國
兩個端點），那是兩個源不是重複。反過來 thzy.me 和 thzy1.me 是兩個域名指向同一
份內容，那才是重複。所以要比對實際回傳的內容。

指紋怎麼取
-----------
  分類指紋：?ac=list 回傳的分類名稱集合
  內容指紋：?ac=videolist&pg=1 第一頁的片名集合

兩個源的「分類指紋」和「內容指紋」都一樣才判定為同一後端。只有分類一樣不算
（很多蘋果CMS 用同一套預設分類），只有內容一樣也不算（可能剛好都在抓同一批新片）。

用法
-----
    python3 scripts/backend_dedup.py --group 🔞            # 看某個群組
    python3 scripts/backend_dedup.py --group 🔞 --group 🔞韓國 --group 🔞歐美
    python3 scripts/backend_dedup.py --all                 # 全部群組
    python3 scripts/backend_dedup.py --group 🔞 --json

只分析不改檔。要套用由人決定保留哪一條。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(REPO, "config.json")

TIMEOUT = 10
WORKERS = 12
MAX_BODY = 5_000_000
TITLE_SAMPLE = 20
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 moontv-dedup"


def fetch(api: str, params: str) -> tuple[dict | None, str]:
    url = api + ("&" if "?" in api else "?") + params
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                return None, f"HTTP {resp.status}"
            body = resp.read(MAX_BODY)
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, socket.gaierror):
            return None, "DNS 失敗"
        return None, f"連線失敗：{str(reason)[:40]}"
    except Exception as e:                      # noqa: BLE001
        return None, f"{type(e).__name__}"
    try:
        return json.loads(body), "ok"
    except ValueError:
        return None, "非 JSON"


def categories(api: str) -> tuple[frozenset[str], str]:
    data, why = fetch(api, "ac=list")
    if data is None:
        return frozenset(), why
    names = set()
    for item in (data.get("class") or []):
        if isinstance(item, dict):
            n = item.get("type_name") or item.get("name")
            if n:
                names.add(str(n).strip())
    return frozenset(names), "ok"


def titles(api: str) -> tuple[frozenset[str], str]:
    data, why = fetch(api, "ac=videolist&pg=1")
    if data is None:
        return frozenset(), why
    rows = data.get("list") or data.get("videolist") or []
    out = []
    for r in rows[:TITLE_SAMPLE]:
        if isinstance(r, dict):
            t = r.get("vod_name") or r.get("name") or r.get("title")
            if t:
                out.append(str(t).strip())
    return frozenset(out), "ok"


def short(fs: frozenset[str]) -> str:
    """集合的短指紋，方便人眼比對。"""
    if not fs:
        return "—"
    h = hashlib.sha1("\u0000".join(sorted(fs)).encode()).hexdigest()
    return h[:8]


def main() -> int:
    ap = argparse.ArgumentParser(description="找出同一後端的重複源")
    ap.add_argument("--config", default=CONFIG)
    ap.add_argument("--group", action="append", default=[], help="可重複指定")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--json", action="store_true", dest="as_json")
    ap.add_argument("--probe", default=None, metavar="DOMAINS",
                    help="逗號分隔的候選域名（或 @檔案），測它們是不是「新的」後端")
    ap.add_argument("--probe-path", default="/api.php/provide/vod",
                    help="候選域名的 API 路徑（預設蘋果CMS）")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        sites = json.load(f)["api_site"]
    if not args.all:
        if not args.group:
            print("要給 --group 或 --all", file=sys.stderr)
            return 1
        sites = {k: v for k, v in sites.items() if v.get("group") in args.group}
    if not sites:
        print("沒有符合條件的源", file=sys.stderr)
        return 1

    keys = list(sites)

    def work(k):
        api = sites[k]["api"]
        cats, cwhy = categories(api)
        tits, twhy = titles(api)
        return k, cats, tits, cwhy, twhy

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(work, keys))

    groups: dict[tuple, list[dict]] = defaultdict(list)
    broken: list[dict] = []
    for k, cats, tits, cwhy, twhy in results:
        v = sites[k]
        rec = {
            "key": k, "name": v.get("name", k), "group": v.get("group", "—"),
            "host": urlsplit(v["api"]).netloc, "api": v["api"],
            "cats": len(cats), "titles": len(tits),
            "cat_fp": short(cats), "title_fp": short(tits),
            "why": f"list={cwhy} videolist={twhy}",
        }
        if not cats and not tits:
            broken.append(rec)
            continue
        groups[(cats, tits)].append(rec)

    dupes = {fp: rows for fp, rows in groups.items() if len(rows) > 1}
    singles = [rows[0] for rows in groups.values() if len(rows) == 1]

    if args.as_json:
        json.dump({
            "registered": len(keys),
            "independent_backends": len(groups),
            "duplicate_clusters": len(dupes),
            "broken": broken,
            "clusters": [
                {"cat_fp": rows[0]["cat_fp"], "title_fp": rows[0]["title_fp"],
                 "members": rows}
                for rows in sorted(groups.values(), key=lambda r: -len(r))
            ],
        }, sys.stdout, ensure_ascii=False, indent=1)
        print()
        return 0

    print(f"登記條目 {len(keys)} 個")
    print(f"獨立後端 {len(groups)} 個"
          f"（重複群 {len(dupes)} 組、單獨 {len(singles)} 個、測不到 {len(broken)} 個）")
    print()

    if dupes:
        print("■ 同一後端的重複（分類與第一頁片名都相同）")
        for rows in sorted(dupes.values(), key=lambda r: -len(r)):
            print(f"  後端指紋 分類={rows[0]['cat_fp']} 內容={rows[0]['title_fp']}"
                  f"（{rows[0]['cats']} 分類）→ {len(rows)} 個登記條目")
            for r in rows:
                print(f"    {r['name']:18} [{r['group']}] {r['host']}")
            print()

    if broken:
        print(f"■ 測不到 {len(broken)} 個（兩個端點都失敗）")
        for r in broken:
            print(f"    {r['name']:18} [{r['group']}] {r['host']} — {r['why']}")
        print()

    print(f"■ 單獨後端 {len(singles)} 個")
    for r in sorted(singles, key=lambda x: x["group"]):
        print(f"    {r['name']:18} [{r['group']}] {r['host']}"
              f"（{r['cats']} 分類）")

    if args.probe:
        print()
        probe_pool(args, existing_fps=set(groups))
    return 0


def probe_pool(args, existing_fps: set) -> None:
    """測候選域名，回報哪些是「現有 config 裡沒有的新後端」。

    重點不是「這個域名活著嗎」，而是「它帶來新內容嗎」。備用池常常是同一個
    後端掛十幾個域名，補進去只是把登記數字衝高，實際可看的片源沒有變多。
    """
    spec = args.probe
    if spec.startswith("@"):
        with open(spec[1:], encoding="utf-8") as f:
            domains = [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
    else:
        domains = [d.strip() for d in spec.split(",") if d.strip()]

    def work(d):
        api = d if d.startswith("http") else f"https://{d}{args.probe_path}"
        cats, cwhy = categories(api)
        tits, twhy = titles(api)
        return d, api, cats, tits, f"list={cwhy} videolist={twhy}"

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        rows = list(pool.map(work, domains))

    dead, dup_existing, new_clusters = [], [], defaultdict(list)
    for d, api, cats, tits, why in rows:
        if not cats and not tits:
            dead.append((d, why))
        elif (cats, tits) in existing_fps:
            dup_existing.append((d, len(cats)))
        else:
            new_clusters[(cats, tits)].append((d, len(cats)))

    print(f"■ 候選池 {len(domains)} 個域名")
    print(f"  死的 {len(dead)}、與現有後端重複 {len(dup_existing)}、"
          f"新後端 {len(new_clusters)} 個（分布在 "
          f"{sum(len(v) for v in new_clusters.values())} 個域名上）")
    print()
    if new_clusters:
        print("  ✅ 真正能增加內容的新後端：")
        for members in sorted(new_clusters.values(), key=lambda m: -m[0][1]):
            names = "、".join(d for d, _ in members)
            print(f"    {members[0][1]:3} 分類  {names}")
        print()
    if dup_existing:
        print("  ⟳ 活著但內容和現有後端完全相同（補進去沒有意義）：")
        print(f"    {'、'.join(d for d, _ in dup_existing)}")
        print()
    if dead:
        print(f"  ✗ 測不到 {len(dead)} 個：{'、'.join(d for d, _ in dead)}")


if __name__ == "__main__":
    sys.exit(main())
