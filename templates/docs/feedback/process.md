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

## Recommended Topic Templates

Beyond the always-on `baseline.md`, the bundle ships ready-to-adopt topic templates — copy
and de-genericize them when the project gains that surface:

- `docs/feedback/test-infra.md` (`TI1-TI10`) — test setup/isolation, DB bootstrap, flaky-harness
  prevention, E2E authoring. Pair with `docs/testing/testing-rules.md` and
  `docs/testing/e2e-maintenance-guide.md`. Route them in `index.md` so `$preflight` loads
  them whenever a change touches tests or the E2E harness.

## Authoring Rules

- Prefer **one file per operational topic**, not one per incident.
- Keep rules concrete and machine-usable; **name the actual paths used in this repo**.
- Anti-examples must be realistic, not toy nonsense; pair every `BAD` with a `GOOD`.
- Use **stable rule IDs** (`<PREFIX><n>`) so rules can be cross-referenced.
- If a rule becomes obsolete, **remove or replace** it — never layer contradictory guidance.
- Every new rule updates `index.md` (topic, open-when conditions, ID range, quick selector).

## Preflight Content Standard

Every non-trivial preflight states these explicitly (so the gate is auditable, not vibes):

- `Scope` — exact files, packages, scripts, services, or runtimes touched.
- `Invariants` — behavior that must not regress.
- `Risk list` — where the change is likely to fail or recreate a prior incident.
- `Validation` — the tests/smoke checks/evidence that will prove correctness (the success
  signal, not a proxy).

**Blocker criteria:** feedback blocks implementation when a violation would recreate a known
incident or break a critical invariant.
