# Test Infrastructure Feedback Rules

Stable rules for test setup, isolation, and harness reliability — the anti-patterns that
make a suite flaky, slow, or falsely green. Loaded by `$preflight` when a change touches
tests, fixtures, the test DB/bootstrap, or the E2E harness (see `index.md` routing).

Rule IDs are stable for cross-reference (`TI<n>`). Add a project's concrete incidents under
`## Origin` and keep the rule generic; name the **actual paths used in this repo** in the
examples (replace the `<...>` placeholders below).

## Origin

Seed this section per project: the regressions, flaky runs, or reviews that produced each
rule (incident ref / commit / date). Do not keep one-off facts in the rules themselves.

## Rules

### TI1: Each test run gets isolated state
Every run owns its own DB/containers/temp dirs, keyed by a unique run id — never a shared
or developer-local backend.
```
# BAD  — tests share one long-lived DB / a fixed compose project name
docker compose -p app_test up -d        # collides across parallel runs

# GOOD — per-run isolation
docker compose -p app_test_${RUN_ID} up -d
```
**Why:** shared state makes tests order-dependent and intermittently red/green.

### TI2: Fast DB provisioning via template/snapshot reuse
Build the schema once, then clone a template per test/worker — don't re-run all migrations
for every test.
**Why:** per-test full migration is the usual cause of minutes-long suites.

### TI3: Tests must be parallel-safe; declare the worker count
No shared ports, files, or singletons across workers; state the parallelism the suite is
tuned for (e.g. `-n <N>`).
**Why:** hidden shared state surfaces only under parallelism and looks like flakiness.

### TI4: Don't substitute a bare mock for a typed dependency
An async/handler test must receive a real (or properly-typed fake) dependency, not a bare
generic mock that silently accepts any call.
```
# BAD
handler(session=MagicMock())     # passes; asserts nothing real
# GOOD
handler(session=make_test_session())   # real/typed test double
```
**Why:** bare mocks make broken code pass.

### TI5: Local E2E targets the LOCAL app, never a shared/external env
The harness points at the locally-launched API/app, not a staging/shared backend.
**Why:** tests pollute shared state and pass/fail on someone else's data.

### TI6: Create test data through the app's own API/factories
Use authenticated API calls or factories to create fixtures; never hardcode IDs that assume
pre-seeded rows.
**Why:** hardcoded IDs rot the moment the seed changes; API-created data is self-consistent.

### TI7: One authoritative source for personas/fixtures
Shared actors, credentials, and sample entities live in one file (e.g.
`<tests>/shared/<personas>`), imported everywhere — not re-declared per test.
**Why:** duplicated literals drift; a renamed field breaks tests scattered across the suite.

### TI8: E2E selectors target stable contracts
Select by role / `data-testid` / accessible name — not fragile CSS classes, nth-child, or
visible-text that changes with copy.
```
# BAD  page.locator(".btn.btn-primary >> nth=2")
# GOOD page.getByTestId("submit-trip")  /  page.getByRole("button", {name: ...})
```
**Why:** class/position selectors break on every restyle; contract selectors survive refactors.

### TI9: Live backends for owned services; mock only true external boundaries
Integration/E2E run your own services live (in containers); mock only third-party/paid
APIs at their boundary.
**Why:** mocking your own code hides real wiring bugs the test was meant to catch.

### TI10: Invoke the runner the project-correct way, from the repo root
Run tests via the project's package manager / script (e.g. `npx <runner> test`,
`<pm> test`), not a bare global binary, from the repo root.
**Why:** a global/wrong-cwd runner picks up the wrong config or version and gives misleading results.

## Checklist (for preflight)

- [ ] Run uses isolated, run-id-keyed state (DB/containers) — no shared/dev backend (TI1, TI5)
- [ ] DB provisioned by template/snapshot reuse; suite is parallel-safe at the declared worker count (TI2, TI3)
- [ ] No bare mock standing in for a typed dependency (TI4)
- [ ] Test data created via API/factories with real auth; no hardcoded seed IDs (TI6)
- [ ] Personas/fixtures come from the one authoritative source (TI7)
- [ ] E2E selectors are role/testid/contract-based, not fragile CSS/text (TI8)
- [ ] Owned services run live; only external boundaries are mocked (TI9)
- [ ] Runner invoked via the project script from repo root (TI10)
