# Feedback Rules Index

Project-specific implementation feedback derived from failed tasks, regressions, reviews, and closeout findings.

Use this index to answer one question before changing code:
which feedback files apply to this task, and what anti-patterns must be avoided?

## Source Of Truth

- `docs/feedback/index.md` is the selector and routing layer.
- `docs/feedback/baseline.md` is the always-loaded baseline rule file.
- Other `docs/feedback/*.md` files are project-specific incident or domain rules.
- `$preflight` must load this index first, then open `baseline.md` and only the relevant topic files.

## Conflict Resolution

If two rules seem to disagree, resolve them in this order:

1. More specific path/topic rule beats a generic rule.
2. A newer incident-derived rule beats an older generic habit.
3. `AGENTS.md`, `CLAUDE.md`, or equivalent project rules beat skill defaults.
4. If the conflict is real, update the feedback docs before implementing code.

Do not silently average contradictory rules.

## Preflight Workflow

1. Read this index.
2. Load `baseline.md`.
3. Map the planned files, services, runtimes, docs, skills, agents, and external integrations touched by the change.
4. Open only the matching feedback files.
5. Apply the selected file checklists.
6. If a needed stable rule is missing, add it to `docs/feedback/` before or with the fix.

## Feedback Files

| File | Topic | Open when | Rule IDs |
|---|---|---|---|
| [baseline.md](baseline.md) | Baseline preflight frame, safety, validation, contracts, artifact layers, harness capabilities, and selective install | Always | `B0-B16` |

## Quick Selector

If the task touches a project-specific area, add a topic file and route it here.

| Area | First feedback files to load |
|---|---|
| Any non-trivial implementation, migration, refactor, docs/workflow/skill/agent change | `baseline.md` |

## Feedback Harvesting

Do not scan commit history during normal preflight.

Run history-based feedback harvesting only when the user explicitly asks for it. When requested:

1. Review recent commits, regressions, failed tasks, reviews, and closeout notes.
2. Extract only reusable lessons, not one-off facts.
3. Write each stable lesson as a topic file with `Origin`, `BAD`, `GOOD`, and `Checklist (for preflight)`.
4. Update this index with the new file, topic, applies-when guidance, and rule ID range.

## Maintenance Standard

When adding a new feedback file or rule:

1. Record the triggering bug, regression, review, or task in `Origin`.
2. Add at least one `BAD` anti-example and one `GOOD` example.
3. Add a short checklist section usable by `$preflight`.
4. Update this index.
