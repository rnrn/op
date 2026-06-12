Use the dry-commit skill.

User request:
{{input}}

Goal:
Create a grouped commit plan before staging or committing anything.

Hard success rule:
Do not treat prose-only analysis as success. Final answer is allowed only after
`COMMIT_PLAN.md` exists in the current workspace and passes the checklist below.
The final response must include `Artifact: <absolute path to COMMIT_PLAN.md>`.

Default safety:
- Default mode is dry-run/checkpoint.
- Do not run `git add`, `git commit`, `git reset`, `git clean`, or cleanup commands
  unless the request explicitly contains `--apply` or `--commit`.
- Never use `git add -A` or `git add .`.
- Never use `--no-verify`.
- Skip scratch files and secrets by default.

Context-mode evidence contract:
- Use context-mode tools for analysis. Prefer one `ctx_batch_execute` with
  labelled git commands and search queries over many raw shell calls.
- Use `ctx_execute_file` for targeted file/diff analysis when grouping cannot be
  decided from status/stat alone.
- Do not simplify this into a generic grouping. The checkpoint must cite exact
  evidence labels, changed paths, line-ending checks, and group rationale.
- If context-mode tools are unavailable, fall back to the bounded git commands
  listed in the evidence workflow below; never BLOCK on a missing optional tool.

Evidence workflow:
1. Resolve target repo from explicit path or current workspace.
2. Gather:
   - `git -C <target> status -u --short`
   - `git -C <target> diff --stat`
   - `git -C <target> diff --cached --stat`
   - `git -C <target> log --oneline -5`
3. Detect line-ending-only changes with `git diff --ignore-cr-at-eol --stat <file>`
   for suspicious large text diffs.
4. Group files by logical theme.
5. Estimate changed code lines per group; split groups above 300 changed code lines.
6. Write `COMMIT_PLAN.md`.
7. If `--apply` or `--commit` is present, require explicit confirmation unless the
   user already requested actual commits in the same message.

Required `COMMIT_PLAN.md` sections:
# Commit Plan
## 1. Target Repo
## 2. Git Evidence
## 3. Grouped Commits
## 4. Line Ending / Binary / Scratch Detection
## 5. Risks
## 6. Apply Gate

Checklist:
- Target repo is stated.
- Evidence commands are listed.
- Each group has exact paths, line estimate, and commit message.
- Tests are grouped with related code.
- Line-ending-only changes are identified separately.
- Binaries, temp files, root scratch JSON/scripts, and `.env` files are skipped.
- Apply gate says whether commits were created.

Completion status line:
- `DONE` if checkpoint was created and no commit was made.
- `DONE_WITH_CONCERNS` if grouping needs human review.
- `BLOCKED` if target repo or git evidence is unavailable.

ARGUMENTS: target repo path and optional `--apply` / `--commit`.
