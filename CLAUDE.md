# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Claude Code practice/training repository. It contains shell scripts for fetching and summarizing Hacker News articles, including Japanese translation support.

## Project Structure

- `day1-hn-summary/` — Shell scripts and output files for HN article fetching/summarizing
  - `hn-top10.sh` — Fetches top 10 HN article IDs, titles, scores, and URLs
  - `hn-summary-jp.sh` — Fetches top HN articles, extracts key sentences, translates to Japanese via MyMemory API

## Running Scripts

```bash
# Fetch top 10 HN articles
./day1-hn-summary/hn-top10.sh

# Fetch and summarize N articles with Japanese translation (default: 5)
./day1-hn-summary/hn-summary-jp.sh [number_of_articles]
```

## Dependencies

- `curl`, `jq`, `python3` (no API keys required)
- MyMemory translation API (free, 500-char limit per call)
