---
name: dry-commit
description: Group uncommitted changes by logical theme into a COMMIT_PLAN.md checkpoint with conventional commit messages and per-group size estimates. Use when the user wants commit grouping, themed commit messages, or a safe dry-run plan before real git staging. Default mode writes only the checkpoint; real staging and commits require explicit --apply or --commit in the same request.
metadata:
  safety-class: checkpoint
---

# Dry Commit Skill

Group all uncommitted changes by logical theme, write a conventional commit
message for each group, and record the plan as a `COMMIT_PLAN.md` checkpoint.
Each group respects the baby-step rule (max 300 changed code lines per commit;
a project-declared commit budget in `AGENTS.md` Stack Profile or
`docs/HANDBOOK.md` replaces the 300 default).

**When to use which:** `dry-commit` produces a themed grouped plan across the
whole working tree; the `baby-commit` skill enforces the 300-changed-code-lines
baby-step split as the primary goal.

## Safety Contract

Default mode writes only `COMMIT_PLAN.md` in the workspace. Do not create,
modify, or delete anything else unless the user explicitly passed `--apply`
or `--commit` in the same request.

Git rules in every mode:

- Never use `git add -A` or `git add .`; stage exact paths only.
- Never use `--no-verify`.
- In default mode, do not run `git add`, `git commit`, `git reset`, cleanup,
  or binary staging — analysis commands only.

When launched through a runnable-skill harness, `templates/default.md` is the
prompt and `COMMIT_PLAN.md` must exist before the final response.

## Usage

```
/dry-commit              # Analyze changes, write COMMIT_PLAN.md, commit nothing
/dry-commit --apply      # Confirm, then stage exact paths and commit each group
/dry-commit --commit     # Same as --apply
```

Optional argument: target repo path (defaults to the current workspace).

## Workflow

1. **Inventory changes** — `git status -u`, `git diff --stat`,
   `git diff --cached --stat`, `git log --oneline -5`.
2. **Detect cosmetic diffs** — for suspicious large text diffs run
   `git diff --ignore-cr-at-eol --stat <file>`. If the full diff is large but
   the ignore-CR view is tiny, it is a line-ending-only change; group those
   into a separate "normalize line endings" commit.
3. **Classify files into logical groups** by what the change does, not where
   the file lives: `feat(<scope>)`, `fix(<scope>)`, `refactor(<scope>)`,
   `test(<scope>)`, `docs(<scope>)`, `chore(build)`, `chore(scripts)`,
   `feat(config)`. Tests go WITH the feature they verify, not in a separate
   test commit. Binary files get their own `chore(build)` commit.
4. **Check baby-step limits** — each group may have at most 300 changed
   source-code lines (insertions + deletions), whatever the language
   (`.go`, `.py`, `.ts`, `.mq5`, ...). Only documentation (`.md`), data and
   config files (`.json`, `.yaml`, lock files), and binaries are exempt
   from the count. Split oversized groups by layer
   (types -> logic -> handlers -> tests) or by sub-feature; a single large
   line-ending-only file may be committed alone.
5. **Write `COMMIT_PLAN.md`** with the required sections (see Output).
6. **Apply gate** — only when `--apply` or `--commit` is in the same request
   (and confirmed): for each group `git add <exact paths>`, verify size with
   `git diff --cached --stat`, then commit. If a pre-commit hook fails,
   `git reset HEAD`, split the group smaller, and retry — never `--no-verify`.
7. **Verify** — `git log --oneline -<N>` and `git status -u --short`; report
   commits created and any files skipped with reasons.

### Commit message format

```
<type>(<scope>): <imperative summary under 72 chars>

<Optional body: 1-3 lines explaining WHY, not WHAT.>
```

The message ends at the body. Project-specific trailers may be added only if
the repository's commit convention requires one.

### Files to SKIP (never commit by default)

- Compiled binaries and build artifacts in the repo root
- Scratch test scripts (`test-*.sh`, `test-*.ps1`) in the repo root
- Scratch data files in the repo root
- `.env` and any file containing secrets
- Temporary directories

## Output

The default-mode deliverable is `COMMIT_PLAN.md` containing exactly these
sections, in this order:

```markdown
# Commit Plan
## 1. Target Repo
## 2. Git Evidence
## 3. Grouped Commits
## 4. Line Ending / Binary / Scratch Detection
## 5. Risks
## 6. Apply Gate
```

Example (abridged):

```markdown
## 1. Target Repo
/home/dev/acme-api (branch: main, clean index)
## 2. Git Evidence
- `git diff --stat`: 9 files changed, 412 insertions, 96 deletions
## 3. Grouped Commits
| # | Message | Files | Code lines |
|---|---------|-------|------------|
| 1 | feat(storage): warm up counters from DB on startup | src/storage.js, src/storage.test.js | 230 |
## 4. Line Ending / Binary / Scratch Detection
- test-scratch.json, .env: SKIP — scratch data / secrets, never commit
## 5. Risks
- Group 1 is near the 300-line limit; split if the hook rejects it.
## 6. Apply Gate
No `--apply` / `--commit` in the request. Nothing staged, nothing committed.
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — checkpoint created; no commits in default mode (or all groups
  committed cleanly under `--apply`).
- `DONE_WITH_CONCERNS` — plan created but grouping or size limits need
  human review.
- `BLOCKED` — target repo or git evidence is unavailable.
- `NEEDS_CONTEXT` — the target repository or intent is ambiguous; ask first.
