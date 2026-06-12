---
name: op-story-finder
description: Searches existing BMAD stories by keyword and reports matches with story ID, epic, status, and file path. Use before creating new stories, to check for duplicate work, find related stories in a topic area, or review the backlog by feature or component. Read-only.
allowed-tools: Read, Grep, Glob
metadata:
  safety-class: read-only
---

# Story Finder Skill

Find existing stories by keyword search so duplicate work is caught before a new story is created. Also useful for locating related work in a topic area or reviewing the backlog by feature, component, or status.

## Read-Only Contract

This skill never creates, modifies, or deletes files. The report goes to the
conversation only.

## Usage

```
/op-story-finder "rate limiting"
/op-story-finder "authentication JWT"
/op-story-finder "user registration"
```

The only argument is the keyword phrase. Tips:

- Use specific keywords: "JWT authentication" beats just "auth".
- Search by component: "API rate limit", "frontend validation".
- Search by status: add `status: done` to find completed work.

## Workflow

1. **Search story files:**
   ```
   Grep: "[keywords]" in docs/**/stories/*.md
   ```
   If the project declares a different docs layout (in `AGENTS.md`, `CLAUDE.md`, or `docs/HANDBOOK.md`), search that layout instead. A project with no story docs at all is a valid result — report it as `DONE` with "no story docs found", not as a blocker.
2. **Parse matches:**
   - Extract story ID and title from `# Story X.Y: Title`
   - Extract epic from `**Epic:**` line
   - Extract status from `**Status:**` line
   - Extract file path
3. **Return structured results** to the conversation (see Output).

Integration with the doc-harvester agent — doc-harvester calls this skill before creating each story:

```
doc-harvester extracts: "Add rate limiting"
    →
Calls: /op-story-finder "rate limiting"
    →
Found match? → Skip (mark as duplicate)
No match? → Call /op-planner to create story
```

## Output

Each match shows ID, epic, status, and file path:

```
Found 2 matching stories for "rate limiting":

1. Story 2.3: Add Rate Limiting
   Epic: api | Status: backlog
   File: docs/api/stories/story-2.3.md

2. Story 5.1: Rate Limit Configuration
   Epic: config | Status: done
   File: docs/config/stories/story-5.1.md
```

If no matches:

```
No existing stories found for: "rate limiting"
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — search completed (with or without matches, including "no story docs found").
- `DONE_WITH_CONCERNS` — search completed but some story files were unparseable; list them.
- `BLOCKED` — project root unreadable.
- `NEEDS_CONTEXT` — no keyword phrase was provided.
