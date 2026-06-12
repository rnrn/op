# DocUp Apply Templates

Use these templates only in apply mode (the user explicitly passed `--apply`).
Default mode writes only `DOCUP_CHECKPOINT.md`.

## BMAD BMM Story-Update Template

When creating a new story for an already-implemented change, write
`docs/<track>/stories/story-X.Y.md`:

```markdown
# Story X.Y: [Title from change description]

**Epic:** [N - Epic Name](../epics/epic-N.md)
**Status:** Done
**Priority:** P0|P1|P2

---

## User Story

As a [user type], I want to [what the change enables] so that [benefit].

---

## Contract Frame

- **Contract:** [changed contract or N/A]
- **Runtime rung:** [affected runtime or N/A]
- **Owner subsystem:** [canonical owner or N/A]
- **Config source of truth:** [canonical source or N/A]
- **Proof path:** [evidence used]

---

## Acceptance Criteria

- [x] AC-1: [Criterion - verified by implementation]
- [x] AC-2: [Criterion - verified by implementation]

---

## Technical Specification

### Implementation Summary

[Brief description of what was implemented]

### Files Modified

| File | Action | Description |
|------|--------|-------------|
| `path/to/file.ext` | UPDATE | Description of changes |
| `path/to/new.ext` | CREATE | New file purpose |

---

## Tasks

- [x] Task 1: [What was done]
- [x] Task 2: [What was done]

---

## Definition of Done

- [x] Feature implemented
- [x] Code committed
- [x] Documentation updated
```

## Updating Existing Stories

- Mark completed acceptance criteria as `[x]`.
- Update story status to `Done` when all ACs are verified.
- Add implementation notes under `## Implementation Details` or
  `## Technical Specification`.
- Add the story row to the epic's stories table and to the track index when
  one exists.

## Priority Guidelines

- **P0:** core functionality, security fixes, breaking changes.
- **P1:** important features, significant improvements.
- **P2:** minor enhancements, cleanup, nice-to-have.
