---
name: baby-commit
description: Split uncommitted changes into small baby-step commits of at most 300 changed code lines each, recorded first as a BABY_COMMIT_PLAN.md checkpoint. Use when the user wants baby-step commits, small atomic commits, or to split a big diff into reviewable pieces. Default mode writes only the checkpoint; real staging and commits require explicit --apply or --commit in the same request.
metadata:
  safety-class: checkpoint
---

# Baby-Step Commits

Split uncommitted changes into small, logical commits instead of one big
commit. The core rule: **max 300 changed code lines per commit** — every
group above that limit must be split before it can be applied. 300 is the
default budget; a commit budget the project declares (in `AGENTS.md` Stack
Profile or `docs/HANDBOOK.md`) replaces it.

**When to use which:** `baby-commit` is for enforcing the
300-changed-code-lines baby-step split as the primary goal; the `dry-commit`
skill produces a grouped plan with themed commit messages across the whole
working tree.

## Safety Contract

Default mode writes only `BABY_COMMIT_PLAN.md` in the workspace. Do not
create, modify, or delete anything else unless the user explicitly passed
`--apply` or `--commit` in the same request.

Git rules in every mode:

- Never use `git add -A` or `git add .`; stage exact paths only.
- Never use `--no-verify`.
- In default mode, do not run `git add`, `git commit`, `git reset`, cleanup,
  or binary staging — analysis commands only.

When launched through a runnable-skill harness, `templates/default.md` is the
prompt and `BABY_COMMIT_PLAN.md` must exist before the final response.

## Usage

```
/baby-commit             # Analyze changes, write BABY_COMMIT_PLAN.md, commit nothing
/baby-commit --apply     # Confirm, then stage exact paths and commit each group
/baby-commit --commit    # Same as --apply
```

Optional argument: target repo path (defaults to the current workspace).

## Workflow

1. **Analyze changes** — `git status -s`, `git diff --stat`,
   `git diff --cached --stat`, `git log --oneline -10` (the log also reveals
   the repo's commit message style).
2. **Group into logical units of work**, in priority order:
   new file + its test -> one commit; related changes to the same feature ->
   one commit; docs only -> separate commit; binary artifacts -> separate
   commit or skip; config/infra -> separate commit. Tests always go with the
   code they verify, never in a separate "tests" commit.
3. **Enforce the 300-line rule** — estimate changed source-code lines
   (insertions + deletions) per group, whatever the language; only
   documentation (`.md`), data/config files (`.json`, `.yaml`, lock files),
   and binaries are exempt from the count. Split any code group above 300
   lines by layer or sub-feature, or mark it as requiring manual review.
   Prefer more smaller commits over fewer large ones; each commit should
   still build.
4. **Write `BABY_COMMIT_PLAN.md`** with the required sections (see Output),
   using conventional messages matching the repo style
   (`feat(scope): ...`, `fix(scope): ...`, `test(scope): ...`, `docs: ...`,
   `chore: ...`). Messages end at the body; project-specific trailers may be
   added only if the repository's commit convention requires one.
5. **Apply gate** — only when `--apply` or `--commit` is in the same request
   (and confirmed): for each group `git add <exact paths>`, commit, then
   `git status -s` to verify remaining changes. If a pre-commit hook fails,
   fix and retry as a NEW commit — never `--no-verify`.
6. **Report** — `git log --oneline -N` and a summary of created commits and
   skipped files.

### Files to SKIP (never commit by default)

- Compiled binaries and build artifacts in the repo root
- Scratch test scripts (`test-*.sh`, `test-*.ps1`) in the repo root
- Scratch data files in the repo root
- `.env` and any file containing secrets
- Temporary directories

## Output

The default-mode deliverable is `BABY_COMMIT_PLAN.md` containing exactly
these sections, in this order:

```markdown
# Baby Commit Plan
## 1. Target Repo
## 2. Git Evidence
## 3. Proposed Commits
## 4. Skipped Files
## 5. Risks
## 6. Apply Gate
```

Example (abridged):

```markdown
## 1. Target Repo
/home/dev/acme-api (branch: main)
## 2. Git Evidence
- `git diff --stat`: 8 files changed, 510 insertions, 42 deletions
## 3. Proposed Commits
1. feat(billing): add invoice rounding rules (180 code lines)
   - src/billing/invoice.py, src/billing/rounding.py
2. test(billing): rounding edge cases (120 code lines)
   - tests/billing/test_rounding.py
## 4. Skipped Files
- .env — secrets, never commit
## 5. Risks
- Commit 1 touches billing math; run the unit suite per commit.
## 6. Apply Gate
No `--apply` / `--commit` in the request. Nothing staged, nothing committed.
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — checkpoint created; no commits in default mode (or all groups
  committed cleanly under `--apply`).
- `DONE_WITH_CONCERNS` — plan created but a group could not be split below
  300 code lines or grouping is risky.
- `BLOCKED` — target repo or git evidence is unavailable.
- `NEEDS_CONTEXT` — the target repository or intent is ambiguous; ask first.
