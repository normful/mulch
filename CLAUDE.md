# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build          # tsc → dist/
npm run dev            # tsc --watch
npm run test           # vitest run (all tests)
npm run test:watch     # vitest (watch mode)
npx vitest run test/commands/record.test.ts  # single test file
npm run lint           # tsc --noEmit (type-check only)
```

## Architecture

Mulch is a passive CLI tool (`mulch-cli`) that manages structured expertise files for coding agents. It has no LLM dependency — agents call `mulch record` / `mulch query`, and Mulch handles storage and retrieval.

### Storage Model

- **Expertise entries**: JSONL files in `.mulch/expertise/<domain>.jsonl` (one record per line, append-only)
- **Config**: YAML at `.mulch/mulch.config.yaml`
- **Storage ≠ delivery**: JSONL on disk is machine-optimized; `mulch prime` outputs agent-optimized markdown

### Record Types & Classifications

Six record types: `convention`, `pattern`, `failure`, `decision`, `reference`, `guide` — each with type-specific required fields defined in `src/schemas/record.ts`.

Three classifications with shelf lives for pruning: `foundational` (permanent), `tactical` (14 days), `observational` (30 days).

### Command Pattern

Each command lives in `src/commands/<name>.ts` and exports a `register<Name>Command(program)` function. All commands are registered in `src/cli.ts`. Entry point is `src/cli.ts`.

### Provider Integration (setup command)

`src/commands/setup.ts` contains provider-specific "recipes" (claude, cursor, codex, gemini, windsurf, aider). Each recipe implements idempotent `install()`, `check()`, and `remove()` operations.

## TypeScript Conventions

- **ESM-only**: All relative imports must end with `.js` extension (`import { foo } from "./bar.js"`)
- **Ajv import**: Must use `import _Ajv from "ajv"; const Ajv = _Ajv.default ?? _Ajv;` for ESM/CJS interop
- **Schemas in `.ts` files**: Never put JSON schemas in `.json` files — tsc won't copy them to `dist/`. Export from TypeScript files instead (see `src/schemas/record-schema.ts`)
- **Strict mode**: No `any`, no `@ts-ignore`, no `@ts-expect-error`
- **Ajv strict mode**: Always include `type: "object"` alongside `required` and `properties` in JSON schema definitions

## Testing Conventions

- **No mocks**: Tests use real filesystems — create temp dirs with `mkdtemp`, write real config/JSONL, assert against real file contents, clean up in `afterEach`
- **Test location**: `test/commands/` mirrors `src/commands/`, `test/utils/` mirrors `src/utils/`
- Use `process.exitCode = 1` instead of `process.exit(1)` for testability

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

## Project Expertise (Mulch)

This project uses [Mulch](https://github.com/jayminwest/mulch) for structured expertise management.

**At the start of every session**, run:
```bash
mulch prime
```

This injects project-specific conventions, patterns, decisions, and other learnings into your context.

**Before completing your task**, review your work for insights worth preserving — conventions discovered,
patterns applied, failures encountered, or decisions made — and record them:
```bash
mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
```

Run `mulch status` to check domain health and entry counts.
Run `mulch --help` for full usage.

### Before You Finish

1. Store insights from this work session:
   ```bash
   mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
   ```
2. Validate and commit:
   ```bash
   mulch validate && git add .mulch/ && git commit -m "mulch: record learnings"
   ```
