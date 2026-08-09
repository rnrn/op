# Task Intake

Use this path to convert an arbitrary request into implementation work.

## Intake Fields

| Field | Required answer |
|---|---|
| User Spec | What outcome did the user request? |
| Contract | What interface, behavior, workflow, doc, or runtime contract changes? |
| Owner subsystem | Which subsystem owns the change? |
| Runtime rung | Which runtime/deploy/test rung is affected? |
| Source of truth | Which file, command, service, or registry owns the data? |
| Scope | Which files/services/docs may change? |
| Invariants | What must not regress? |
| Risks | What can break? |
| Proof path | What validates completion? |

## Flow

1. Write the User Spec.
2. Check `docs/feedback/index.md` and selected feedback files.
3. Check `docs/project-boundaries.md` for ownership.
4. Check `docs/build-profiles.md` for affected runtime/package surface.
5. Create or update the story/plan.
6. Implement only within the owned scope.
7. Run proof and record evidence.
8. Update docs when contracts changed.

## Closeout

Close only when proof passes or a concrete blocker is recorded.
