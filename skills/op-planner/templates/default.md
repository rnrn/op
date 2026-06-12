Use the op-planner skill.

User request:
{{input}}

Goal:
Create a BMAD planning checkpoint before writing any docs.

Hard success rule:
Do not treat prose-only analysis as success. Final answer is allowed only after `PLANNER_CHECKPOINT.md` exists in the current workspace and passes the checklist below. The final response must include `Artifact: <absolute path to PLANNER_CHECKPOINT.md>`.

Default safety:
- Default mode is dry-run/checkpoint.
- Do not create or modify real BMAD story/epic files unless the user request explicitly contains `--apply` or says to write/update files.
- If not applying, write only `PLANNER_CHECKPOINT.md` in the current workspace.
- Keep `PLANNER_CHECKPOINT.md` under 140 lines.

Workflow:
1. Inspect existing docs structure with bounded discovery. Prefer context-mode
   tools when available; if they are unavailable, fall back to bounded shell
   commands (for example `ls docs/` and targeted globs over `docs/*/epics/` and
   `docs/*/stories/`) and summarize only relevant evidence.
2. Identify target track, epic choice, story number, dependencies, and duplicate risk.
3. Create `PLANNER_CHECKPOINT.md`.
4. Run checklist.
5. If `--apply` is explicitly present, create/update real BMAD files only after the checkpoint is complete.
6. If `PLANNER_CHECKPOINT.md` is missing, do not answer in prose. Create the file first.

Required `PLANNER_CHECKPOINT.md` sections:
# Planner Checkpoint
## 1. Request Summary
## 2. Existing Docs Evidence
## 3. Duplicate And Scope Check
## 4. Proposed Track And Epic
## 5. Proposed Story
## 6. Acceptance Criteria
## 7. Tasks And Test Plan
## 8. Apply Gate

Checklist:
- Target track is named.
- Existing docs/epics/stories evidence is listed with paths.
- Duplicate risk is stated.
- Proposed epic is selected or new epic is justified.
- Story title, priority, status, and user story are present.
- At least 3 acceptance criteria are testable.
- Tasks map to acceptance criteria.
- Apply gate says whether real files were written.
