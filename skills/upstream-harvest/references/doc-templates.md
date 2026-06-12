# Upstream Harvest — BMAD BMM Document Templates

Templates for the real docs written under `upstreams_docs/<PROJECT>/` in apply
mode. All data comes from CODE, not README (README may lie). English only.

## PRD — `prd.md`

```markdown
# PRD: <PROJECT>

## Product Overview
<what it is, who it's for, key features>

## Architecture
<ASCII architecture diagram>

## Key Metrics
<limits, defaults, key numbers from code>

## Tech Stack
<language, frameworks, DB, transport>
```

## Index — `INDEX.md`

```markdown
# <PROJECT> — BMAD BMM Documentation Index

**Source:** <upstream_clone path>
**Generated:** <date>, updated with git history analysis
**Commits analyzed:** <first>..<last> (<count> commits, <date>)

## PRD
- [Product Requirements](prd.md)

## Feature Epics
| # | Epic | Stories | Priority |
|---|------|---------|----------|
| 1 | [Epic Name](epics/epic-1.md) | 1.1–1.N | P0 |

## History Epics
| # | Epic | Key Insight |
|---|------|-------------|
| H1 | [Evolution Name](epics/epic-H1.md) | What changed and why |

## Stories
### Epic 1: Name
- [1.1 Story Title](stories/story-1.1.md) — short description
```

## Feature epic — `epics/epic-N.md`

```markdown
# Epic N: <Name>

## Overview
<what this module/subsystem does>

## Stories
| ID | Story | Priority | Status |
|----|-------|----------|--------|
| N.1 | Story Name | P0 | done |

## Architecture
<ASCII diagram if needed>
```

## History epic — `epics/epic-HN.md`

```markdown
# Epic HN: <Evolution Name>

## Overview
**Type:** history (approach evolution)
<what changed and why>

## Timeline
| Phase | Commits | What happened |
|-------|---------|---------------|
| v1 | abc..def | First approach |
| v2 | ghi..jkl | Why it changed |

## Key Insight
<main lesson — why the final approach is better>
```

## Story — `stories/story-N.M.md`

```markdown
# Story N.M: <Title>

**Epic:** N — <Epic Name>
**Priority:** P0|P1|P2
**Status:** done

## Description
<what this part of the system does>

## Acceptance Criteria
- [x] AC-1: <verifiable criterion>
- [x] AC-2: <verifiable criterion>

## Implementation

**File:** `<path>` (<N> lines)

### <Section>

```<lang>
<key code fragment — not the entire file, just the essence>
```

## Technical Notes
- <important implementation details>
- <gotchas, non-obvious decisions>
```

## Story-writing rules

1. **Include code** — key fragments (function signatures, data structures,
   SQL schema). NOT the entire file, just the essence.
2. **Verify against code, not README** — README may be outdated. Read the
   actual file.
3. **Don't document obsolete things** — if code uses httpx, don't write
   "uses openai SDK" from an old README.
4. **Indicate line counts** — `core/api.py (1005 lines)` helps estimate scale.
5. **ACs must be verifiable** — "function X exists", "uses httpx not openai",
   "table Y has column Z".

## What to document

- Functions/classes with behavior description
- SQL schema with columns
- API endpoints with parameters
- Configuration with defaults
- Security patterns
- Architectural decisions (why httpx not openai SDK)

## What NOT to document

- Entire files (only key fragments)
- Obsolete approaches (only in history epics as "was -> became")
- Frontend styles/CSS
- CI/CD configs (unless critical)
- Test fixtures

## Code quality in stories

- Code in stories is a **reference**, not a copy. Show signatures, key logic,
  SQL schema.
- If a function is 200 lines — show 20 key ones, explain the rest in words.
- Always indicate file and line count: `**File:** core/api.py (1005 lines)`.
