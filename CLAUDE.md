# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Claude Code practice/training repository with multiple day-based projects. Each `day*` directory is a self-contained project with its own toolchain.

## Projects

### day1-hn-summary (Shell)

Fetches and summarizes Hacker News articles with Japanese translation.

```bash
./day1-hn-summary/hn-top10.sh
./day1-hn-summary/hn-summary-jp.sh [number_of_articles]
```

Dependencies: `curl`, `jq`, `python3`, MyMemory translation API (free, no keys).

### day2-inventory (TypeScript + libSQL)

CLI-based inventory management system. All commands run from `day2-inventory/`.

```bash
npm run build          # TypeScript compile (tsc)
npm run dev            # Run CLI via tsx (e.g. npm run dev -- product list)
npm test               # Run all tests (vitest)
npm run test:watch     # Watch mode
npx vitest run tests/product.test.ts  # Run single test file
npm run lint           # ESLint
npm run lint:fix       # ESLint autofix
npm run db:migrate     # Run DB migrations standalone
```

**Tech stack**: TypeScript (ESM, Node16 resolution), libSQL/SQLite (`@libsql/client`), Commander.js, Zod v3, Vitest.

**Architecture**: Three-layer design where CLI commands (`src/commands/`) delegate to services (`src/services/`), which use Zod schemas (`src/schemas/`) for validation and a shared DB client (`src/db/client.ts`).

- `src/db/client.ts` — Singleton libSQL client. Tests inject in-memory DB via `setClient()`.
- `src/db/migrate.ts` — All 7 CREATE TABLE statements. Runs automatically on every CLI invocation via Commander `preAction` hook.
- Services are the business logic layer. Tests exercise services directly, not CLI output.
- Stock levels are computed from `stock_movements` (no denormalized inventory table). Core query: `SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END)`.
- Orders use a two-step flow: create (pending) then confirm (stock deducted). Cancelling a confirmed order returns stock.

**ESM gotcha**: All TypeScript imports require `.js` extensions (e.g., `import { getClient } from './db/client.js'`). Vitest handles `.ts` imports natively in test files.

**DB**: `PRAGMA foreign_keys = ON` must be set per connection. Default DB file is `file:inventory.db`; override via `DATABASE_URL` env var. Tests use `:memory:`.

## プロジェクト固有のルール

### DB アクセス
- すべての DB 操作は src/db/ 内の関数を経由する
- 直接 SQL を書くのは db/queries/ 内のみ
- トランザクションは明示的に開始・コミットする

### エラーハンドリング
- カスタム Error クラス（src/errors/）を使用
- CLI 出力時は必ずユーザーフレンドリーなメッセージに変換

> **エラーハンドリング方針**
> このレッスンでは標準的な `throw` + `try-catch` パターンを使用します。
> Rust の `Result` 型に近い neverthrow ライブラリもありますが、本レッスンでは扱いません。

### テスト
- 各モジュールに対応するテストファイルを作成
- テスト用 DB はインメモリを使用

### コマンド
- ビルド: npm run build
- テスト: npm test
- 単一テスト: npm test -- --grep "テスト名"
- lint: npm run lint
