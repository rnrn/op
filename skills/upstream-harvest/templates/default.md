Use the upstream-harvest skill with context-mode ON discipline.

Task:
Analyze this upstream repository:
{{input}}

Goal:
Create a reliable upstream-harvest checkpoint by acting as a coordinator, not as a single-pass summarizer.

Hard success rule:
A skeleton `UPSTREAM_HARVEST_CHECKPOINT.md` is not enough. The final answer is allowed only after `UPSTREAM_HARVEST_CHECKPOINT.md` exists, contains all required sections, has no `_pending_`, and passes the checklist below.

Coordinator workflow:
1. Draft a plan in the conversation first: required sections, focused agent/task assignments, and acceptance checks. Do not write a separate plan file.
2. Run focused analysis agents/tasks: evidence, source-map, PRD/BMAD, validation.
3. Merge agent results into `UPSTREAM_HARVEST_CHECKPOINT.md`.
4. Run the checklist review.
5. If any point is incomplete, restart only the missing agent/task with a narrower prompt and update `UPSTREAM_HARVEST_CHECKPOINT.md`.
6. Final response must report pass/fail and the artifact path.

Rules:
- `UPSTREAM_HARVEST_CHECKPOINT.md` is the only file written in default mode. Real docs under the docs path require an explicit `--apply` in the request.
- Use context-mode MCP tools for git/file discovery and targeted source reads when available; otherwise use bounded shell/git commands and summarize.
- Do not paste raw command output into the conversation.
- Do not modify the upstream repo.
- Prefer source code facts over README claims.
- Every major claim must have a concrete file path, commit id, or exact git command evidence.
- Keep `UPSTREAM_HARVEST_CHECKPOINT.md` under 200 lines.

Required `UPSTREAM_HARVEST_CHECKPOINT.md` sections:
# Upstream Harvest Checkpoint
## 1. Target And Range
## 2. Commit Evidence
## 3. Proposed Epics
## 4. Proposed Stories
## 5. Test Plan
## 6. Unknowns And Apply Gate

Checklist:
- `UPSTREAM_HARVEST_CHECKPOINT.md` exists.
- `UPSTREAM_HARVEST_CHECKPOINT.md` contains all 6 required sections.
- No `_pending_` placeholders.
- At least 5 commit ids or commit evidence entries.
- At least 10 source/config file paths.
- At least 4 feature epics.
- At least 1 history epic.
- At least 8 story titles with acceptance criteria.
- At least 6 validation tests tied to source/config paths.
- Unknowns include exact command/file needed to prove each item.
- Apply gate states whether real docs were written.
