# E2E Maintenance Guide

How to write and maintain end-to-end tests so they stay meaningful and non-flaky. The
enforceable rules live in `docs/feedback/test-infra.md` (TI1–TI10) and
`docs/testing/testing-rules.md`; this guide is the practical "how". Replace the `<...>`
placeholders with the project's real paths/tools.

## Layout

- One E2E suite per user flow, under `<tests>/e2e/<flow>/`.
- Centralized config (`<tests>/e2e/<config>`) pointing at the **local** app/API endpoint.
- A single shared personas/fixtures module (`<tests>/e2e/shared/<personas>`) — the one
  authoritative source for actors, credentials, and sample entities (TI7).

## Runtime

- Launch the app locally and run E2E against it; never a shared/staging backend (TI5).
- Stateful dependencies (DB, queues, owned services) run in per-run-isolated containers (TI1).
- Mock only true third-party/paid APIs at their boundary; run your own services live (TI9).

## Test data

- Create every entity through the app's authenticated API/factories, not hardcoded IDs (TI6).
- Use realistic data (e.g. dates a sensible interval in the future), not values that expire
  or fall outside valid ranges.

## Selectors & actor naming

- Select by role / `data-testid` / accessible name — never fragile CSS classes, nth-child,
  or copy-dependent text (TI8).
- Name actors for the context they render in (a list cell vs a detail header may use
  different fields); assert the field the UI actually shows.

## Refactoring discipline

- When markup, routes, or field names change, update selectors and personas in the same
  change and leave an audit-trail note — don't leave stale selectors that pass by accident.
- Removing a legacy screen/route: delete its E2E (or repoint it), don't let it linger green.

## Assertions

- Assert exact outcomes (one expected status code, the exact rendered value), not permissive
  sets that hide regressions.
- Classify every skipped test with a reason + a tracking ref before skipping; a silently
  skipped E2E is a coverage hole.

## Pre-commit E2E checklist

- [ ] Data created via API/factories (no hardcoded seed IDs) (TI6)
- [ ] Selectors are role/testid/contract-based (TI8)
- [ ] Isolated, run-id-keyed containers; local API endpoint (TI1, TI5)
- [ ] Owned services live; only external boundaries mocked (TI9)
- [ ] Assertions exact; skips classified with a reason
- [ ] Runner invoked via the project script from repo root (TI10)
