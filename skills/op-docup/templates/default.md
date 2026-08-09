Use the op-docup skill.

User request:
{{input}}

Goal:
Create a documentation sync checkpoint before modifying project docs.

Target repo rule:
- If `{{input}}` contains a filesystem path, treat that path as the target repository.
- All git/file discovery must run against the target repository, not the current smoke workspace.
- If current workspace differs from target repository, state both paths in `DOCUP_CHECKPOINT.md`.
- If the target repository is not a git repository, say that explicitly and fall back to file-system evidence only.

Hard success rule:
Do not treat prose-only analysis as success. Final answer is allowed only after `DOCUP_CHECKPOINT.md` exists in the current workspace and passes the checklist below. The final response must include `Artifact: <absolute path to DOCUP_CHECKPOINT.md>`.

Default safety:
- Default mode is dry-run/checkpoint.
- Do not create or modify real docs unless the user request explicitly contains `--apply` or says to write/update files.
- If not applying, write only `DOCUP_CHECKPOINT.md` in the current workspace.
- Keep `DOCUP_CHECKPOINT.md` under 140 lines.

Workflow:
1. Resolve target repository path from the user request.
2. Gather bounded git evidence with explicit target commands:
   - `git -C <target> status --short`
   - `git -C <target> log --oneline -30`
   - `git -C <target> diff --stat`
   - If the request names specific files, diff those files with
     `git -C <target> diff -- <named files>`; otherwise use bounded
     `git -C <target> diff`/`status` of the recent change.
3. If context-mode is available, use context-mode tools for command execution/search and keep raw output out of the conversation.
4. If context-mode is unavailable or disabled, still use bounded `git -C <target>` commands and summarize only relevant evidence.
5. Map changes to docs tracks, epics, stories, or “no docs needed”.
6. Create `DOCUP_CHECKPOINT.md`.
7. Run checklist.
8. If `--apply` is explicitly present, update real docs only after the checkpoint is complete.
9. If `DOCUP_CHECKPOINT.md` is missing, do not answer in prose. Create the file first.

Required `DOCUP_CHECKPOINT.md` sections:
# DocUp Checkpoint
## 1. Change Evidence
## 2. Change Classification
## 3. Documentation Mapping
## 4. Proposed Documentation Updates
## 5. No-Docs-Needed Items
## 6. Risks And Unknowns
## 7. Apply Gate

Checklist:
- Target repository path is stated.
- Current workspace path is stated if different from target.
- Git evidence includes command names or file paths.
- Git evidence uses `git -C <target>` or explains why git is unavailable.
- If the request named specific files, evidence includes diffs of those files or explains why they do not exist.
- Changed files are grouped by feature/bugfix/refactor/config/docs.
- Each significant change maps to a docs action or no-docs-needed reason.
- Proposed updates name exact docs paths.
- Unknowns include exact command/file needed to resolve them.
- Apply gate says whether real docs were written.
