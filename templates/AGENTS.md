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
| File-size budget | TODO or `default` (500/1000 lines) |
| Commit budget | TODO or `default` (300 changed code lines) |

Skills treat their built-in numbers and stack examples as defaults; values declared here win.

## Preflight

Before non-trivial implementation, docs workflow changes, agent behavior changes, runtime/deploy work, or refactors:

1. Read `docs/feedback/index.md`.
2. Read `docs/feedback/baseline.md`.
3. Load only the feedback files selected by the index.
4. Check `docs/HANDBOOK.md`, `docs/project-boundaries.md`, and `docs/build-profiles.md` when the task touches ownership, runtime, packaging, or proof.

## Validation

Every change must end with a concrete proof command or evidence file. If validation is unavailable, record the blocker and do not mark the task complete.

## Epic Closure Gate

Before an epic's status flips to DONE, all of the following are mandatory:

1. `op-drift-check` scoped to the docs the epic touched — no unresolved CRITICAL/WARNING findings.
2. `op-docup --epic <id> --apply` — the epic's stories and the architecture doc agree with the code; the run did not end `DONE_WITH_CONCERNS`/`BLOCKED`.
3. `op-decision-memory` — durable decisions from the epic proposed, accepted ones appended with `--apply`.
4. The epic file's `## Closure Checklist` section is fully checked.

An epic without a completed gate stays in `review`, not `done`.

## Review Cadence

| Level | When | Required |
|---|---|---|
| Story | every story | narrowest proof command + the project's mechanical gates (build, budget ratchet, lint); no skill runs required |
| Epic closure | status flips to DONE | the Epic Closure Gate above |
| Background | monthly or every ~10 closed stories | `op-debt-scan` + `op-drift-check`, to catch hotfixes and work that bypassed epics |
