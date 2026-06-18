---
name: op-planner
description: Converts user requests into BMAD BMM epics and stories, starting from a planning checkpoint. Use when planning features, creating epics, generating user stories, or turning a request into a backlog item. Default mode writes only PLANNER_CHECKPOINT.md; real story/epic files require --apply.
metadata:
  safety-class: checkpoint
---

# Planner Skill

Convert a user request into a BMAD BMM plan: pick the right docs track and
epic, check for duplicates, and propose a numbered story with testable
acceptance criteria. The plan lands in a checkpoint file first; real BMAD
files are materialized only on explicit apply.

## Safety Contract

Default mode writes only `PLANNER_CHECKPOINT.md` in the workspace. Do not
create, modify, or delete anything else unless the user explicitly passed
`--apply` in the same request. Write files only — never run `git add`,
`git commit`, or `git reset`; staging and commits belong to the user or the
`baby-commit`/`dry-commit` skills (an agent that auto-commits can corrupt a
detached worktree and strand later steps).

## Usage

```
/op-planner <request>                  # Plan and write PLANNER_CHECKPOINT.md
/op-planner <request> --epic=NAME      # Force an existing epic
/op-planner <request> --new-epic=NAME  # Force creation of a new epic (on apply)
/op-planner <request> --apply          # Checkpoint, then write real story/epic/sprint files
```

## Workflow

1. **Read the request** — identify intent, scope (feature, bugfix, refactor,
   enhancement), referenced files, and priority. Priority one-liner:
   P0 = critical/blocking/security, P1 = important features and bugs,
   P2 = nice-to-have polish.
2. **Explore existing docs** — Glob `docs/*/epics/*.md` and
   `docs/*/stories/*.md`. If present, also read `docs/HANDBOOK.md`,
   `docs/task-intake.md`, `docs/subsystem-doc-contracts.md`, and
   `docs/docs-taxonomy.md` and respect their contracts (User Spec for
   operator-facing work; contract/runtime rung/owner/source-of-truth/proof
   path for structural work).
3. **Check for duplicates** — search existing stories for the same capability;
   never create a parallel docs track when an existing track or owner already
   covers the work.
4. **Pick track, epic, and number** — prefer an existing track, then derive
   from referenced file paths, then from project structure, then a semantic
   name. Select the best-fit epic or justify a new one; next story number is
   max existing + 1 within the epic. Detailed rules and an examples table:
   read `references/conventions.md`.
5. **Apply scope rule** — one story = one layer/subsystem of the project's
   actual architecture (backend/frontend/infrastructure for web; core/UI/
   platform for desktop apps; stage/harness/infra for pipelines); split
   multi-layer features into separate stories.
6. **Write `PLANNER_CHECKPOINT.md`** — required sections listed under Output;
   keep it under 140 lines.
7. **Apply gate** — only if the user explicitly passed `--apply` in the same
   request: write the real story file, update the epic story table, and —
   only when the project already tracks a sprint/board file — update it,
   using the templates in `references/templates.md`.
   When materializing or updating an epic file and the project provides an
   epic-closure-checklist template (`docs/*/epics/epic-closure-checklist.md`
   or a path declared in `docs/HANDBOOK.md`), include its
   `## Closure Checklist` section in the epic so the closure gate cannot be
   skipped silently; the checkpoint records whether such a template was
   found. Otherwise state in the checkpoint that no real files were written.

Read `references/templates.md` when applying (story, epic, and sprint YAML
templates). Read `references/conventions.md` for track detection, acceptance
criteria guidelines, MVP-vs-Production scoping, and the story status flow.

## Output

`PLANNER_CHECKPOINT.md` must contain exactly these sections:

```markdown
# Planner Checkpoint
## 1. Request Summary
## 2. Existing Docs Evidence
## 3. Duplicate And Scope Check
## 4. Proposed Track And Epic
## 5. Proposed Story
## 6. Acceptance Criteria
## 7. Tasks And Test Plan
## 8. Apply Gate
```

Checkpoint quality bar: target track named; docs evidence listed with paths;
duplicate risk stated; epic selected or new epic justified; story has title,
priority, status, and user story; at least 3 testable acceptance criteria;
tasks map to acceptance criteria; apply gate says whether real files were
written.

**Example** — request: "Add rate limiting to API endpoints in server/routes/"

1. `ls docs/` finds `docs/server/`, `docs/frontend/` — file reference
   `server/routes/` selects track `server`.
2. Best-fit epic: `docs/server/epics/epic-2-security.md`; existing stories
   2.1 and 2.2, so the new story is 2.3. No duplicate story found.
3. Write `PLANNER_CHECKPOINT.md` proposing
   `docs/server/stories/story-2.3.md` ("Add Rate Limiting", P1, backend-only)
   with ACs such as "Returns 429 status when rate limit exceeded", and an
   apply gate reading "no real files written (no --apply)".
4. With `--apply`: create story-2.3.md, add its row to epic-2-security.md,
   update the project's sprint/board file if it uses one, and report what was
   created.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — checkpoint written (and real files written when `--apply` was passed).
- `DONE_WITH_CONCERNS` — checkpoint written but with unresolved duplicate or scope risks.
- `BLOCKED` — an external blocker prevents planning (e.g., workspace not writable).
- `NEEDS_CONTEXT` — the request is too vague to name a track, story, or acceptance criteria.
