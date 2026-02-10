# Mulch — Let your agents grow 🌱

Structured expertise files that accumulate over time, live in git, work with any agent, and run locally with zero dependencies.

Agents start every session from zero. The pattern your agent discovered yesterday is forgotten today. Mulch fixes this: agents call `mulch record` to write learnings, and `mulch query` to read them. Expertise compounds across sessions, domains, and teammates.

**Mulch is a passive layer.** It does not contain an LLM. Agents use Mulch — Mulch does not use agents.

## Install

```bash
npm install -g mulch-cli
```

Or use directly with npx — no install required:

```bash
npx mulch-cli <command>
```

## Quick Start

```bash
mulch init                                            # Create .mulch/ in your project
mulch add database                                    # Add a domain
mulch record database --type convention "Use WAL mode for SQLite"
mulch record database --type failure \
  --description "VACUUM inside a transaction causes silent corruption" \
  --resolution "Always run VACUUM outside transaction boundaries"
mulch query database                                  # See accumulated expertise
mulch prime                                           # Get full context for agent injection
mulch prime database                                  # Get context for one domain only
```

## How It Works

```
1. mulch init               → Creates .mulch/ with domain JSONL files
2. Agent reads expertise     → Grounded in everything the project has learned
3. Agent does work           → Normal task execution
4. Agent calls mulch record  → Writes structured learnings back to .mulch/
5. git push                  → Teammates' agents get smarter too
```

The critical insight: step 4 is **agent-driven**. The agent decides what's worth recording. Mulch provides the schema and file structure so those learnings land in a consistent, queryable format.

## What's in `.mulch/`

```
.mulch/
├── expertise/
│   ├── database.jsonl        # All database knowledge
│   ├── api.jsonl             # One JSONL file per domain
│   └── testing.jsonl         # Each line is a typed, structured record
└── mulch.config.yaml         # Config: domains, governance settings
```

Everything is git-tracked. Clone a repo and your agents immediately have the project's accumulated expertise.

## CLI Reference

| Command | Description |
|---------|-------------|
| `mulch init` | Initialize `.mulch/` in the current project |
| `mulch add <domain>` | Add a new expertise domain |
| `mulch record <domain> --type <type>` | Record an expertise record (`--tags`, `--force`, `--relates-to`, `--supersedes`) |
| `mulch edit <domain> <id>` | Edit an existing record by ID or 1-based index |
| `mulch delete <domain> <id>` | Delete a record by ID or 1-based index |
| `mulch query [domain]` | Query expertise (use `--all` for all domains) |
| `mulch prime [domains...]` | Output AI-optimized expertise context (multi-domain, `--context`, `--format`, `--export`) |
| `mulch search [query]` | Search records across domains (`--domain`, `--type`, `--tag` filters) |
| `mulch compact [domain]` | Analyze compaction candidates or apply a compaction (`--analyze`, `--apply`) |
| `mulch status` | Show expertise freshness and counts |
| `mulch validate` | Schema validation across all files |
| `mulch doctor` | Run health checks on expertise records (`--fix` to auto-fix) |
| `mulch setup [provider]` | Install provider-specific hooks (claude, cursor, codex, gemini, windsurf, aider) |
| `mulch onboard` | Generate AGENTS.md/CLAUDE.md snippet |
| `mulch prune` | Remove stale tactical/observational entries |
| `mulch ready` | Show recently added or updated records (`--since`, `--domain`, `--limit`) |
| `mulch sync` | Validate, stage, and commit `.mulch/` changes |
| `mulch learn` | Show changed files and suggest domains for recording learnings |

## Record Types

| Type | Required Fields | Use Case |
|------|----------------|----------|
| `convention` | content | "Use WAL mode for SQLite connections" |
| `pattern` | name, description | Named patterns with optional file references |
| `failure` | description, resolution | What went wrong and how to avoid it |
| `decision` | title, rationale | Architectural decisions and their reasoning |
| `reference` | name, description | Key files, endpoints, or resources worth remembering |
| `guide` | name, description | Step-by-step procedures for recurring tasks |

All records support optional `--classification` (foundational / tactical / observational), evidence flags (`--evidence-commit`, `--evidence-issue`, `--evidence-file`), `--tags`, `--relates-to`, and `--supersedes` for linking.

## Example Output

```
$ mulch query database

## database (6 entries, updated 2h ago)

### Conventions
- Use WAL mode for all SQLite connections
- Migrations are sequential, never concurrent

### Known Failures
- VACUUM inside a transaction causes silent corruption
  → Always run VACUUM outside transaction boundaries

### Decisions
- **SQLite over PostgreSQL**: Local-only product, no network dependency acceptable
```

## Design Principles

- **Zero LLM dependency** — Mulch makes no LLM calls. Quality equals agent quality.
- **Provider-agnostic** — Any agent with bash access can call the CLI.
- **Git-native** — Everything lives in `.mulch/`, tracked in version control.
- **Append-only JSONL** — Zero merge conflicts, trivial schema validation.
- **Storage ≠ Delivery** — JSONL on disk, optimized markdown/XML for agents.

## License

MIT
