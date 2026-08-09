# Planner Apply Templates

Use these templates only in apply mode (the user explicitly passed `--apply`).
Default mode writes only `PLANNER_CHECKPOINT.md`.

## BMAD BMM Story Template

Create story files in `docs/<track>/stories/story-X.Y.md`:

```markdown
# Story X.Y: [Concise Title]

**Epic:** [N - Epic Name](../epics/epic-N.md)
**Status:** TODO
**Priority:** P0|P1|P2
**Assigned:** -

## User Spec

- **Why:** [user/operator problem]
- **Capabilities:** [what the system must allow]
- **Constraints:** [safety, compatibility, runtime, security limits]
- **Non-goals:** [what this story must not solve]
- **Success signal:** [observable proof that user value exists]

## Contract Frame

- **Contract:** CLI UX | provider config | runtime mode | deploy | proxy protocol | client setup | docs/workflow | skills | admin UI | N/A
- **Runtime rung:** solo | named compose | server deploy | production | N/A
- **Owner subsystem:** [canonical owner from project docs, or N/A]
- **Config source of truth:** [file, command, registry, runtime state, or N/A]
- **Proof path:** [exact tests, smoke, e2e matrix, validation script, or blocked external proof]

## User Story

As a [user type], I want to [action] so that [benefit].

## Acceptance Criteria

- [ ] AC-1: [Specific, testable criterion]
- [ ] AC-2: [Specific, testable criterion]
- [ ] AC-3: [Specific, testable criterion]

## Implementation Details

- **Files to modify:** [list existing files]
- **New files:** [list files to create]
- **Dependencies:** [external libs, services]

## Tasks

1. [Main task description]
   - [ ] Subtask 1
   - [ ] Subtask 2

2. [Second task description]
   - [ ] Subtask 1
   - [ ] Subtask 2

## Definition of Done

- [ ] All AC verified with passing tests
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Review Notes

(Added by QA during review)
```

## BMAD BMM Epic Template

Create epic files in `docs/<track>/epics/epic-N-name.md`:

```markdown
# Epic N: [Epic Name]

**Priority:** P0|P1|P2
**Status:** TODO

## Overview

[Brief description of what this epic delivers]

## User Spec

- **Why:** [operator problem or N/A - reason]
- **Capabilities:** [capabilities delivered by the epic]
- **Constraints:** [must preserve]
- **Non-goals:** [explicit exclusions]
- **Success signal:** [proof of value]

## Contract Frame

- **Contract:** [changed contract]
- **Runtime rung:** [solo/named compose/server deploy/production/N/A]
- **Owner subsystem:** [canonical owner]
- **Config source of truth:** [canonical source]
- **Proof path:** [required evidence]

## Goals

- [Goal 1]
- [Goal 2]

## Stories

| ID | Name | Priority | Status |
|----|------|----------|--------|
| [X.1](../stories/story-X.1.md) | Story Title | P0 | TODO |
| [X.2](../stories/story-X.2.md) | Story Title | P1 | TODO |

## Success Criteria

- [ ] [Measurable criterion]
- [ ] [Measurable criterion]

## Definition of Done

- [ ] All stories completed
- [ ] Tests passing
- [ ] Documentation updated
```

## Sprint / Board Update (optional)

The bundle does not own or scaffold a sprint/board file. Only when the project
already tracks one — update it after creating a story, using the path the
project declares (in `AGENTS.md` / `docs/HANDBOOK.md`). Skip this step entirely
when the project has no such file:

```yaml
epics:
  - id: epic-N
    stories:
      - id: "X.Y"
        name: Story Title
        priority: P0
        status: TODO
        description: Brief description
        file: docs/<track>/stories/story-X.Y.md
        acceptance_criteria: N  # count
        estimated_tasks: N      # count
```
