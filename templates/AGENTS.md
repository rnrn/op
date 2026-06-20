# Project Agent Rules

Use these rules for all agent-assisted development in this repository.

## Operating Method

Work contract-first:

1. Capture the User Spec before changing code.
2. Name the changed Contract.
3. Identify the Owner subsystem.
4. Identify the Runtime rung.
5. Identify the Source of truth.
6. Define the Proof path before implementation.

Do not start non-trivial implementation while any of these fields are unknown.

## Required Docs

Treat these files as the active project-method scaffold:

- `docs/INDEX.md`
- `docs/HANDBOOK.md`
- `docs/task-intake.md`
- `docs/docs-taxonomy.md`
- `docs/subsystem-doc-contracts.md`
- `docs/project-boundaries.md`
- `docs/build-profiles.md`, or explicit `N/A` rationale for single-surface projects
- `docs/feedback/index.md`
- `docs/feedback/baseline.md`
- `docs/feedback/process.md`

## Stack Profile

Declare the project's stack once so skills and agents use these values instead of their built-in defaults and examples:

| Field | Value |
|---|---|
| Language(s) | TODO |
| Project archetype | TODO — service / GUI app / CLI / library / ML pipeline / embedded / mixed |
| Build command | TODO |
| Test / proof command | TODO |
| Docs layout | TODO — e.g. `docs/<track>/epics\|stories` (default) or the actual layout |
| Task / spec system | TODO or `auto`. One of: BMAD (`docs/<track>/{epics,stories}/`, `prd.md`) · spec-kit (`specs/<feature>/{spec,plan,tasks}.md`, `.specify/`) · beads (`.beads/`, `bd`) · markdown (`docs/tasks/*.md`, `TODO/BACKLOG`) · issues (gh/linear/jira) · none. See `docs/spec-systems.md`. |
| Spec unit format | TODO or `default` — the file shape a planned unit takes in that system |
| File-size budget | TODO or `default` (500/1000 lines) |
| Commit budget | TODO or `default` (300 changed code lines) |

Skills treat their built-in numbers and stack examples as defaults; values declared here win. The **Task / spec system** drives how planning and audit skills create / find / export work units — see `docs/spec-systems.md` for detection and per-system recipes.

## Preflight

Before non-trivial implementation, docs workflow changes, agent behavior changes, runtime/deploy work, or refactors:

1. Read `docs/feedback/index.md`.
2. Read `docs/feedback/baseline.md`.
3. Load only the feedback files selected by the index.
4. Check `docs/HANDBOOK.md`, `docs/project-boundaries.md`, and `docs/build-profiles.md` when the task touches ownership, runtime, packaging, or proof.

## Validation

Every change must end with a concrete proof command or evidence file. If validation is unavailable, record the blocker and do not mark the task complete.

## Git boundary

Skills and agents **write files; they do not stage or commit.** Never run `git add`, `git commit`, or `git reset` from a skill run — staging and commits belong to the user, or to the dedicated `baby-commit` / `dry-commit` skills invoked explicitly. (An agent that auto-commits — common with `--dangerously-skip-permissions` — can corrupt a detached worktree and strand later steps.)

## Epic Closure Gate

Before an epic's status flips to DONE, run these **in order** — the steps are a
sequence, not an unordered set, because drift-check detects what docup fixes:

1. `op-drift-check` scoped to the docs the epic touched — detect divergences.
2. If it reported CRITICAL/WARNING: `op-docup --epic <id> --apply` to reconcile
   stories/architecture with the code, then re-run `op-drift-check`. Repeat until
   it reports no CRITICAL/WARNING (cap ~3 iterations; if still failing, the epic
   is `BLOCKED` — fix the code/doc divergence, do not close).
3. `op-decision-memory` **last** — once docs are settled, propose the epic's
   durable decisions and append accepted ones with `--apply` (recording
   decisions before docup reconciles the docs risks capturing a stale rationale).
4. The epic file's `## Closure Checklist` section is fully checked.

An epic without a completed gate stays in `review`, not `done`.

## Review Cadence

| Level | When | Required |
|---|---|---|
| Story | every story | narrowest proof command + the project's mechanical gates (build, budget ratchet, lint); no skill runs required |
| Epic closure | status flips to DONE | the Epic Closure Gate above |
| Background | monthly or every ~10 closed stories | `op-debt-scan` + `op-drift-check`, to catch hotfixes and work that bypassed epics |
