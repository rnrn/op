---
name: op-story-finder
description: Searches existing planned work units (BMAD stories by default; spec-kit tasks, markdown backlog, or the layout declared in docs/spec-systems.md) by keyword and reports matches with ID, epic/container, status, and file path. Use before creating new units, to check for duplicate work, find related work in a topic area, or review the backlog by feature or component. Read-only.
allowed-tools: Read, Grep, Glob
metadata:
  safety-class: read-only
---

# Story Finder Skill

Find existing stories by keyword search so duplicate work is caught before a new story is created. Also useful for locating related work in a topic area or reviewing the backlog by feature, component, or status.

## Read-Only Contract

This skill never creates, modifies, or deletes files. The report goes to the
conversation only.

## Usage

```
/op-story-finder "rate limiting"
/op-story-finder "authentication JWT"
/op-story-finder "user registration"
```

The only argument is the keyword phrase. Tips:

- Use specific keywords: "JWT authentication" beats just "auth".
- Search by component: "API rate limit", "frontend validation".
- Search by status: add `status: done` to find completed work.

## Workflow

1. **Detect the layout FIRST — never default blindly to the BMAD glob.** Read
   `docs/spec-systems.md` (and `AGENTS.md` Stack Profile / `CLAUDE.md` / `docs/HANDBOOK.md`)
   to learn where this project keeps units, then grep the matching glob:
   - **BMAD** → `docs/**/stories/*.md` (units `# Story X.Y: Title`).
   - **spec-kit** → `specs/**/tasks.md`.
   - **markdown backlog** → `docs/tasks/*.md`, `TODO`/`BACKLOG`.
   - **flat-epic** → `docs/EPIC_*.md` with **inline** units `### Task N. <title> — <status>`
     (also `## Task N`, `- [ ] …`); the container is the `# EPIC:` heading / filename, and an
     `EPIC_*_INDEX.md` hub, when present, holds the authoritative open/done state. This layout
     is common and the BMAD glob returns **zero** hits on it.
   **Detection guard (prevents a false "no units"):** if the BMAD glob returns 0 files AND
   `docs/spec-systems.md` (or any `docs/EPIC_*.md`) exists, STOP and follow the declared layout
   before reporting empty. A genuinely empty project is `DONE` "no units found"; a mis-detected
   one is a bug.
   **Scope:** restrict globs to the declared docs root; **exclude non-authoritative copies** —
   `.claude/worktrees/**`, `**/agent_workspaces/**`, `**/data/**`, `node_modules/**` — or every
   finding triple-counts. (Tracker systems — beads/issues — are queried by op-planner/op-audit
   via their CLIs; this read-only finder greps file-based units.)
2. **Parse matches** (heading/field shapes vary by layout — handle all):
   - ID + title: `# Story X.Y: Title` OR `### Task N. <title>` (unit id = `<EPIC-file>:TaskN`).
   - Container/epic: `**Epic:**` line OR the `# EPIC:` heading / the epic filename.
   - Status: `**Status:**` line OR the token(s) after the last `—`/inside `(…)` in the heading.
     **A bare priority tag (`— P0`…`— P3`) is NOT a status** — treat it as open/unspecified and
     consult any `EPIC_*_INDEX.md` for the authoritative open/done; never report `P0` as a status.
   - Extract file path.
3. **Return structured results** to the conversation (see Output).

Integration with the doc-harvester agent — doc-harvester calls this skill before creating each story:

```
doc-harvester extracts: "Add rate limiting"
    →
Calls: /op-story-finder "rate limiting"
    →
Found match? → Skip (mark as duplicate)
No match? → Call /op-planner to create story
```

## Output

Each match shows ID, epic, status, and file path:

```
Found 2 matching stories for "rate limiting":

1. Story 2.3: Add Rate Limiting
   Epic: api | Status: backlog
   File: docs/api/stories/story-2.3.md

2. Story 5.1: Rate Limit Configuration
   Epic: config | Status: done
   File: docs/config/stories/story-5.1.md
```

If no matches:

```
No existing stories found for: "rate limiting"
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — search completed (with or without matches, including "no story docs found").
- `DONE_WITH_CONCERNS` — search completed but some story files were unparseable; list them.
- `BLOCKED` — project root unreadable.
- `NEEDS_CONTEXT` — no keyword phrase was provided.
