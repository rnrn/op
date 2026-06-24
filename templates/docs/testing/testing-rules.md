# Testing Rules

Canonical source for how tests are structured and isolated in this project. Enforceable
anti-patterns are in `docs/feedback/test-infra.md` (TI1–TI10); the E2E "how" is in
`e2e-maintenance-guide.md`. Replace `<...>` with the project's real layout.

## Test types & location

| Type | Lives in | Scope |
|---|---|---|
| Unit | co-located with the code (or `<tests>/unit/`) | one function/module, no I/O |
| Integration | `<tests>/integration/` | real DB / owned services, no external 3rd-party |
| E2E | `<tests>/e2e/<flow>/` | the running app via its local API + a real browser/client |

## Isolation

- Each run owns its state, keyed by a unique run id; no shared/dev backend (TI1, TI5).
- Provision the DB by template/snapshot reuse, not per-test full migration (TI2).
- Tests are parallel-safe at the declared worker count (TI3).

## Mock boundary

- Mock **only** true external/third-party/paid services, at their boundary (TI9).
- Never mock your own services in integration/E2E, and never substitute a bare mock for a
  typed dependency in unit tests (TI4).

## Test data & selectors

- Create data through the app's API/factories with real auth; no hardcoded seed IDs (TI6).
- Shared personas/fixtures from one authoritative module (TI7).
- E2E selects by role / `data-testid` / accessible name, not fragile CSS/text (TI8).

## Before adding or changing a test

- `Scope` — which files/services/runtimes the test touches.
- `Invariants` — the behavior it must keep proving (don't weaken assertions to make it pass).
- `Risk` — where this kind of test has been flaky before (see `test-infra.md` Origin).
- Run it via the project script from repo root (TI10); confirm it fails when the behavior breaks.
