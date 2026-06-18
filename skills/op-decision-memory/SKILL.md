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

Lifecycle placement: after epic implementation (accepted architecture/config/protocol/security/deploy decisions); after a significant story (only if it creates a reusable decision or tradeoff); after a commit batch (decisions made implicitly in code but not documented); after project reorganization (ownership boundaries, docs taxonomy, source-of-truth moves). When the project defines an Epic Closure Gate (in `AGENTS.md`), this skill is part of that gate: run it before the epic's status flips to DONE, not ad hoc afterwards. Not a replacement for `op-docup` (which syncs stories/epics/notes) and not transcript memory — this is decision-log/ADR memory only.

## Workflow

1. Read existing decisions from `docs/decisions/decisions.yaml` (if any).
2. Scan the completed epic/story notes and `git log` for the last N commits; look for keywords like "migrate", "switch", "replace", "upgrade", "add", "remove" and detect new dependencies, config changes, framework switches, API changes.
3. Identify commits with architectural significance.
4. For each significant change: read the changed files, determine what decision was made, extract rationale from commit message/PR description, note alternatives considered, and check whether the decision is already recorded.
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
7. With `--apply`, append the accepted decisions to `docs/decisions/decisions.yaml`; with `--apply --export`, also regenerate `docs/decisions/DECISIONS.md`.

## Output

Default-mode report:

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

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — decisions proposed (or appended with `--apply`); none missed in the scanned range.
- `DONE_WITH_CONCERNS` — decisions recorded but rationale was missing for some commits; list them.
- `BLOCKED` — no git history or epic/story notes available to scan.
- `NEEDS_CONTEXT` — ambiguous commit range or `--query` keyword missing.
