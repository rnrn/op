---
name: op-decision-memory
description: Extract durable architectural decisions (ADRs) from completed epics, significant stories, git history, and code changes into a decision log. Use when closing out an epic, after architecture-impacting commits, to record why a technical choice was made, or to query past decisions. Default mode only proposes decisions in the report; appending to the ADR log requires --apply.
metadata:
  safety-class: checkpoint
---

# Decision Memory Skill

Extract and record durable architectural decisions from completed epics, significant implemented stories, git history, and code changes. This is a closeout or batch skill, not a per-edit gate: run it after an epic or architecture-impacting story is implemented, or when a batch of commits changed dependencies, runtime boundaries, protocols, deployment model, security posture, or project structure.

## Safety Contract

Default mode writes nothing — proposed decisions go to the conversation
report only. Do not create, modify, or delete anything unless the user
explicitly passed `--apply` in the same request. With `--apply`, append the
accepted decisions to `docs/decisions/decisions.yaml` (and regenerate
`docs/decisions/DECISIONS.md` when `--export` is also given) and touch
nothing else. Write files only — never run `git add`, `git commit`, or
`git reset`; staging and commits belong to the user or the `baby-commit`/
`dry-commit` skills.

## Usage

```
/op-decision-memory
/op-decision-memory --apply
/op-decision-memory --query "database"
/op-decision-memory --apply --export
```

| Argument | Meaning |
|----------|---------|
| `--apply` | Append proposed decisions to `docs/decisions/decisions.yaml` (the ADR log) |
| `--query <keyword>` | Read existing `docs/decisions/decisions.yaml`, search decisions by keyword in decision, rationale, category; display matches with full context (read-only) |
| `--export` | Generate `docs/decisions/DECISIONS.md` as a formatted markdown table, grouped by category, sorted by date (requires `--apply`) |

Lifecycle placement: after epic implementation (accepted architecture/config/protocol/security/deploy decisions); after a significant story (only if it creates a reusable decision or tradeoff); after a commit batch (decisions made implicitly in code but not documented); after project reorganization (ownership boundaries, docs taxonomy, source-of-truth moves). When the project defines an Epic Closure Gate (in `AGENTS.md`), this skill is part of that gate: run it before the epic's status flips to DONE, not ad hoc afterwards. Not a replacement for `op-docup` (which syncs stories/epics/notes) and not transcript memory — this is decision-log/ADR memory only. **ADR vs changelog:** `changelog`/release-notes record WHAT shipped per release; this records WHY a technical choice was made and what was rejected (the `rationale` + `alternatives` fields) — the two never share an entry.

## Workflow

1. Read existing decisions from `docs/decisions/decisions.yaml` (if any). On a virgin log (no file / no entries), seed the first id at `ADR-001`.
2. Scan the completed epic/story notes and `git log` for the last N commits; look for keywords like "migrate", "switch", "replace", "upgrade", "add", "remove" and detect new dependencies, config changes, framework switches, API changes.
3. Identify commits with architectural significance. **Granularity: one ADR per durable decision, not per commit** — collapse a multi-commit epic into the smallest set of decisions a future maintainer would each want to revisit independently (do NOT emit one ADR per commit; do NOT split one decision across several).
4. For each significant change: read the changed files, determine what decision was made, **extract rationale from the story/epic notes FIRST, then the commit message/PR description** (story docs usually carry the "why" that terse commits omit), note alternatives considered, and check whether the decision is already recorded.
5. Categorize each decision:

   | Category | Triggers |
   |----------|----------|
   | `dependency` | New package in go.mod/package.json, removed dependency |
   | `architecture` | New service, changed file structure, new patterns |
   | `database` | Schema changes, new migrations, DB engine change |
   | `security` | Auth changes, encryption, access control |
   | `infrastructure` | Docker, CI/CD, deployment changes |
   | `api` | New endpoints, changed contracts, versioning |
   | `project-method` | Task intake, docs taxonomy, subsystem ownership, proof requirements |
   | `source-of-truth` | Provider/runtime/client/deploy config ownership changes |

6. Propose the new decisions in the conversation report (default mode ends here).
7. With `--apply`, append the accepted decisions to `docs/decisions/decisions.yaml`; with `--apply --export`, also regenerate `docs/decisions/DECISIONS.md`. **Idempotent append:** before writing each entry, skip any whose identity already exists in the log — match on `category` + a normalized `decision`/`affects` key, not the `ADR-NNN` id. This makes the append safe to re-run: when a goal-driven `op-watch` step crashes after the append but before its state write, the re-entry re-proposes the same decision and must **not** create a duplicate ADR.

## Output

Default-mode report — **must contain exactly these lines/sections** (`Scanned:`, `Already recorded:`, `Proposed decisions`), and every proposal carries `[category]` + decision + `Rationale:` + `Evidence:`:

```
## Decision Memory Report

Scanned: 24 commits (a1b2c3d..f9e8d7c) + epic docs/api/epics/epic-3.md
Already recorded: ADR-001, ADR-002
Proposed decisions (not written - rerun with --apply to append):

1. [dependency] Switch from Express to Fastify
   Rationale: better performance, TypeScript-first, schema validation built-in
   Evidence: commits abc1234, def5678
(...)
```

Decision entry appended to `docs/decisions/decisions.yaml` with `--apply`:

```yaml
decisions:
  - id: ADR-003
    date: "2026-01-15"
    category: dependency
    decision: "Switch from Express to Fastify"
    rationale: "Better performance, TypeScript-first, schema validation built-in"
    affects:
      - server/routes/
      - package.json
    alternatives:
      - "Stay with Express"
      - "Use Koa"
    status: accepted
    commits:
      - "abc1234"
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — decisions proposed (or appended with `--apply`); none missed in the scanned range.
- `DONE_WITH_CONCERNS` — decisions recorded but rationale was missing for some commits; list them.
- `BLOCKED` — no git history or epic/story notes available to scan.
- `NEEDS_CONTEXT` — ambiguous commit range or `--query` keyword missing.
