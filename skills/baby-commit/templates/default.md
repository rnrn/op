Use the baby-commit skill.

User request:
{{input}}

Goal:
Create a safe baby-step commit plan before staging or committing anything.

Hard success rule:
Do not treat prose-only analysis as success. Final answer is allowed only after
`BABY_COMMIT_PLAN.md` exists in the current workspace and passes the checklist
below. The final response must include `Artifact: <absolute path to BABY_COMMIT_PLAN.md>`.

Default safety:
- Default mode is dry-run/checkpoint.
- Do not run `git add`, `git commit`, `git reset`, or cleanup commands unless the
  user request explicitly contains `--apply` or `--commit`.
- Never use `git add -A` or `git add .`; stage exact paths only.
- Never use `--no-verify`.
- Never commit binary artifacts unless the user explicitly names them.

Context-mode evidence contract:
- Use context-mode tools for analysis. Prefer one `ctx_batch_execute` with
  labelled git commands and search queries over many raw shell calls.
- Do not use raw `cat`/`type`/large shell output for analysis. If file content
  must be inspected, use `ctx_execute_file` and print only the needed summary.
- Do not simplify this into a generic commit plan. The checkpoint must cite the
  exact evidence labels, changed paths, and why each path belongs to a group.
- If context-mode tools are unavailable, fall back to the bounded git commands
  listed in the evidence workflow below; never BLOCK on a missing optional tool.

Evidence workflow:
1. Resolve target repo from explicit path or current workspace.
2. Run bounded git evidence against the target repo:
   - `git -C <target> status --short`
   - `git -C <target> diff --stat`
   - `git -C <target> diff --cached --stat`
   - `git -C <target> log --oneline -10`
3. Classify changed files into logical baby-step groups.
4. Mark skipped files and why.
5. Estimate diff size per group and split code groups above 300 changed lines.
6. Write `BABY_COMMIT_PLAN.md`.
7. If `--apply` or `--commit` is present, stop and ask for explicit confirmation
   unless the user has already said to commit now in the same request.

Required `BABY_COMMIT_PLAN.md` sections:
# Baby Commit Plan
## 1. Target Repo
## 2. Git Evidence
## 3. Proposed Commits
## 4. Skipped Files
## 5. Risks
## 6. Apply Gate

Checklist:
- Target repo is stated.
- Evidence commands are listed.
- No file is assigned to more than one commit.
- Tests are grouped with the code they verify.
- Binary/scratch/secret files are skipped unless explicitly requested.
- Every proposed commit has exact file paths and a conventional commit message.
- Code groups above 300 changed lines are split or marked as requiring manual review.
- Apply gate clearly says whether commits were created.

Completion status line:
- `DONE` if checkpoint was created and no commit was made.
- `DONE_WITH_CONCERNS` if grouping is incomplete or risky.
- `BLOCKED` if target repo or git evidence is unavailable.

ARGUMENTS: target repo path and optional `--apply` / `--commit`.
