#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${TMPDIR:-/tmp}/moontv-e2e-search-isolation.log"

cd "$ROOT_DIR"

pnpm dev >"$LOG_FILE" 2>&1 &
DEV_PID=$!

cleanup() {
  kill "$DEV_PID" 2>/dev/null || true
  wait "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT

PORT=""
for _ in {1..60}; do
  if grep -q "Local:        http://localhost:" "$LOG_FILE"; then
    PORT="$(sed -n 's/.*Local:        http:\/\/localhost:\([0-9][0-9]*\).*/\1/p' "$LOG_FILE" | tail -n1)"
    break
  fi
  sleep 1
done

if [[ -z "${PORT}" ]]; then
  echo "❌ 找不到 dev server 埠號"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

for _ in {1..40}; do
  if curl -sSf "http://127.0.0.1:${PORT}/api/search/resources" >/tmp/moontv_search_resources.json 2>/dev/null; then
    break
  fi
  sleep 1
done
curl -sSf "http://127.0.0.1:${PORT}/api/adult/resources" >/tmp/moontv_adult_resources.json

export PORT
python3 - <<'PY'
import json
import os
import urllib.parse
import urllib.request

port = os.environ["PORT"]

with open("/tmp/moontv_adult_resources.json", "r", encoding="utf-8") as f:
    adult = json.load(f)
with open("/tmp/moontv_search_resources.json", "r", encoding="utf-8") as f:
    family = json.load(f)

adult_keys = [x.get("key") for x in adult if isinstance(x, dict) and x.get("key")]
family_keys = [x.get("key") for x in family if isinstance(x, dict) and x.get("key")]

if not adult_keys:
    raise SystemExit("❌ 成人來源清單為空，無法驗證")

source = adult_keys[0]
browse_url = f"http://127.0.0.1:{port}/api/browse?source={urllib.parse.quote(source)}&category=adult&page=1"
browse_data = json.loads(urllib.request.urlopen(browse_url, timeout=30).read().decode("utf-8"))
results = browse_data.get("results", [])
if not results:
    raise SystemExit(f"❌ 成人來源 {source} 無內容，無法驗證")

title = (results[0].get("title") or "").strip()
if not title:
    raise SystemExit("❌ 無法取得測試片名")

kw = title[:4] if len(title) >= 4 else title
q = urllib.parse.quote(kw)

outer = json.loads(
    urllib.request.urlopen(f"http://127.0.0.1:{port}/api/search?q={q}", timeout=30)
    .read()
    .decode("utf-8")
)
adult_search = json.loads(
    urllib.request.urlopen(f"http://127.0.0.1:{port}/api/adult/search?q={q}", timeout=30)
    .read()
    .decode("utf-8")
)

outer_results = outer.get("results", [])
adult_results = adult_search.get("results", [])
adult_set = set(adult_keys)
leaks = [r for r in outer_results if r.get("source") in adult_set]
overlap = set(adult_keys) & set(family_keys)

print(f"PORT={port}")
print(f"ADULT_SOURCE_COUNT={len(adult_keys)}")
print(f"FAMILY_SOURCE_COUNT={len(family_keys)}")
print(f"ADULT_IN_FAMILY_OVERLAP={len(overlap)}")
print(f"TEST_SOURCE={source}")
print(f"TEST_TITLE={title}")
print(f"TEST_KEYWORD={kw}")
print(f"OUTER_SEARCH_RESULT_COUNT={len(outer_results)}")
print(f"ADULT_SEARCH_RESULT_COUNT={len(adult_results)}")
print(f"OUTER_LEAK_COUNT={len(leaks)}")

if overlap:
    raise SystemExit("❌ 成人來源出現在外層來源清單")
if not adult_results:
    raise SystemExit("❌ 彩虹頻道搜尋沒有結果，驗證無效")
if leaks:
    raise SystemExit("❌ 外層搜尋仍出現成人來源結果")

print("✅ 搜尋隔離驗證通過")
PY
