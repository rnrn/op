# Feedback Process

Use this process to maintain `docs/feedback` without turning normal preflight into a heavy audit.

## Install

1. Copy `templates/AGENTS.md` and `templates/docs/` into the target project when bootstrapping a new project-method repository.
2. Keep `docs/feedback/baseline.md` in every project.
3. Add project-specific feedback files only after real regressions, reviews, failed tasks, or explicit bootstrap harvesting.
4. Update `docs/feedback/index.md` whenever a new feedback file is added.

## Normal Preflight

Normal preflight reads:

1. `docs/feedback/index.md`
2. `docs/feedback/baseline.md`
3. only the topic files selected by the index

Normal preflight must not scan commit history.

## New Project / Generated Project Scaffold

Before implementation starts in a new or generated project, create this minimum project-method scaffold:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/HANDBOOK.md`
4. `docs/task-intake.md`
5. `docs/docs-taxonomy.md`
6. `docs/subsystem-doc-contracts.md`
7. `docs/project-boundaries.md`
8. `docs/build-profiles.md`, or an explicit `N/A` rationale when the project has only one build/runtime/package surface
9. `docs/feedback/index.md`
10. `docs/feedback/baseline.md`
11. `docs/feedback/process.md`

`docs/project-boundaries.md` owns module/runtime responsibility boundaries. `docs/build-profiles.md` owns core versus optional packaging surfaces. Missing files are a preflight `FAIL` for generated projects using the project method.

## Explicit Feedback Harvest

Run this only when the user asks to harvest feedback from history.

1. Inspect recent commits, failed tasks, reviews, closeout notes, and regressions.
2. Extract reusable lessons only.
3. Create or update topic files with:
   - `Origin`
   - rule statement
   - `BAD` anti-example
   - `GOOD` example
   - `Checklist (for preflight)`
4. Update `index.md` with routing metadata.
5. Keep one-off historical facts out of baseline rules.
