#!/bin/bash
#
# hn-summary-jp.sh
# Fetches top Hacker News articles, extracts key sentences, and translates to Japanese.
#
# Requirements: curl, jq, python3
# No API keys needed.
#
# Usage:
#   ./hn-summary-jp.sh [number_of_articles]

set -uo pipefail

# --- Help ---
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage: ./hn-summary-jp.sh [number_of_articles]

Fetches top Hacker News articles, extracts key sentences, and translates to Japanese.
Output is saved as a timestamped file in the script's directory.

Arguments:
  number_of_articles  Number of articles to summarize (default: 5)

Options:
  -h, --help          Show this help message

Requirements: curl, jq, python3
USAGE
  exit 0
fi

# --- Configuration ---
NUM_ARTICLES="${1:-5}"
HN_API="https://hacker-news.firebaseio.com/v0"
MAX_BODY_CHARS=3000
SUMMARY_SENTENCES=5
MYMEMORY_API="https://api.mymemory.translated.net/get"

# --- Preflight checks ---
for cmd in curl jq python3; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is required but not installed." >&2
    exit 1
  fi
done

# --- Functions ---

# Fetch JSON from a URL
fetch_json() {
  local result
  result=$(curl -sf --max-time 10 "$1" 2>/dev/null) || {
    echo "Error: Failed to fetch $1" >&2
    return 1
  }
  echo "$result"
}

# Extract readable text from HTML using Python
html_to_text() {
  python3 -c "
import sys, html, re

raw = sys.stdin.read()
# Remove script, style, nav, header, footer blocks
text = re.sub(r'<(script|style|nav|header|footer|noscript)[^>]*>.*?</\1>', '', raw, flags=re.DOTALL | re.IGNORECASE)
# Replace block tags with newlines
text = re.sub(r'<(br|p|div|h[1-6]|li|tr)[^>]*/?>', '\n', text, flags=re.IGNORECASE)
# Strip remaining HTML tags
text = re.sub(r'<[^>]+>', '', text)
# Decode HTML entities
text = html.unescape(text)
# Collapse all whitespace: tabs, multiple spaces, multiple newlines
text = re.sub(r'[ \t]+', ' ', text)
lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 1]
print('\n'.join(lines))
"
}

# Fetch article body text from a URL
fetch_article_text() {
  local url="$1"
  local body
  body=$(curl -sfL --max-time 10 -A "Mozilla/5.0 (HN Summary Bot)" "$url" 2>/dev/null) || return 1
  echo "$body" | html_to_text | head -c "$MAX_BODY_CHARS"
}

# Extract the first N meaningful sentences from text using Python
extract_summary() {
  local text="$1"
  local num_sentences="$2"
  python3 -c "
import re, sys

text = sys.argv[1]
# Split into sentences (period, exclamation, question followed by space or end)
sentences = re.split(r'(?<=[.!?])\s+', text)
# Filter: real prose sentences (40+ chars, has letters, has spaces = multi-word)
good = []
for s in sentences:
    s = s.strip()
    if len(s) < 40:
        continue
    if not re.search(r'[a-zA-Z]', s):
        continue
    if s.count(' ') < 3:
        continue
    good.append(s)
    if len(good) >= int(sys.argv[2]):
        break
# Cap at 450 chars total so translation needs only 1 API call
result = ' '.join(good)[:450]
print(result)
" "$text" "$num_sentences"
}

# Translate text to Japanese using MyMemory API (free, no key, 500-char limit)
translate_to_japanese() {
  local text="$1"
  local encoded
  encoded=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1][:450]))" "$text")
  local response
  response=$(curl -sf --max-time 5 "${MYMEMORY_API}?q=${encoded}&langpair=en|ja" 2>/dev/null) || {
    echo "(翻訳エラー)"
    return
  }
  echo "$response" | jq -r '.responseData.translatedText // "(翻訳失敗)"'
}

# --- Main ---

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="${SCRIPT_DIR}/news-summary-$(date '+%Y%m%d-%H%M%S').txt"

# Tee all stdout to the output file
exec > >(tee "$OUTPUT_FILE")

echo "========================================"
echo " Hacker News トップ記事 日本語サマリー"
echo " $(date '+%Y-%m-%d %H:%M')"
echo "========================================"
echo ""

# 1. Fetch top story IDs
echo "記事を取得中..." >&2
top_ids=$(fetch_json "${HN_API}/topstories.json" | jq -r ".[:${NUM_ARTICLES}][]" 2>/dev/null)
if [[ -z "$top_ids" ]]; then
  echo "Error: Failed to fetch top stories from HN API." >&2
  exit 1
fi

article_num=0
for id in $top_ids; do
  article_num=$((article_num + 1))

  # 2. Fetch story details
  sleep 1
  item_json=$(fetch_json "${HN_API}/item/${id}.json")
  if [[ -z "$item_json" ]]; then
    echo "----------------------------------------"
    echo "【${article_num}】(記事の取得に失敗しました - ID: ${id})"
    echo ""
    continue
  fi
  title=$(echo "$item_json" | jq -r '.title // "タイトルなし"')
  url=$(echo "$item_json" | jq -r '.url // empty')
  score=$(echo "$item_json" | jq -r '.score // 0')
  comment_count=$(echo "$item_json" | jq -r '.descendants // 0')

  echo "[${article_num}/${NUM_ARTICLES}] ${title} を処理中..." >&2

  # 3. Fetch article body (skip if no URL, e.g. Ask HN)
  body=""
  if [[ -n "$url" ]]; then
    body=$(fetch_article_text "$url" 2>/dev/null) || {
      echo "  Warning: Could not fetch article body for ${url}" >&2
      body=""
    }
  fi

  # 4. Extract summary sentences
  if [[ -n "$body" ]]; then
    summary_en=$(extract_summary "$body" "$SUMMARY_SENTENCES")
  else
    summary_en="$title"
  fi

  # 5. Translate to Japanese
  summary_jp=$(translate_to_japanese "$summary_en")

  # 6. Output
  echo "----------------------------------------"
  echo "【${article_num}】${title}"
  echo "  URL:      ${url:-"(外部リンクなし)"}"
  echo "  スコア:   ${score} ポイント / ${comment_count} コメント"
  echo ""
  echo "  EN: ${summary_en}"
  echo ""
  echo "  JP: ${summary_jp}"
  echo ""
done

echo "========================================"
echo " 完了: ${NUM_ARTICLES} 件の記事を処理しました"
echo "========================================"
