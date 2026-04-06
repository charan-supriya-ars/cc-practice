#!/bin/bash
#
# hn-top10.sh
# Retrieves the IDs of the top 10 Hacker News articles.
#
# Requirements: curl, jq
# Usage: ./hn-top10.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="${SCRIPT_DIR}/hn-top10-$(date '+%Y%m%d-%H%M%S').txt"
HN_API="https://hacker-news.firebaseio.com/v0"

for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is required but not installed." >&2
    exit 1
  fi
done

{
  echo "========================================"
  echo " Hacker News Top 10 Article IDs"
  echo " $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"
  echo ""

  top_ids=$(curl -sf --max-time 10 "${HN_API}/topstories.json" 2>/dev/null | jq -r '.[:10][]' 2>/dev/null)
  if [[ -z "$top_ids" ]]; then
    echo "Error: Failed to fetch top stories from HN API." >&2
    exit 1
  fi

  rank=0
  for id in $top_ids; do
    rank=$((rank + 1))
    sleep 1
    item=$(curl -sf --max-time 10 "${HN_API}/item/${id}.json" 2>/dev/null) || {
      echo "  ${rank}. [ID: ${id}] (Failed to fetch article details)"
      echo ""
      continue
    }
    title=$(echo "$item" | jq -r '.title // "N/A"')
    score=$(echo "$item" | jq -r '.score // 0')
    url=$(echo "$item" | jq -r '.url // "N/A"')
    echo "  ${rank}. [ID: ${id}] ${title}"
    echo "     Score: ${score} | URL: ${url}"
    echo ""
  done

  echo "========================================"
} | tee "$OUTPUT_FILE"

echo ""
echo "Saved to: ${OUTPUT_FILE}" >&2
