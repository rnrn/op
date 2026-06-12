Use the upstream-issues skill.

User request:
{{input}}

Goal:
Create a GitHub issues/PR harvest checkpoint before writing any upstream docs.

Hard success rule:
Do not treat prose-only analysis as success. Final answer is allowed only after `UPSTREAM_ISSUES_CHECKPOINT.md` exists in the current workspace and passes the checklist below. The final response must include `Artifact: <absolute path to UPSTREAM_ISSUES_CHECKPOINT.md>`.

Default safety:
- Default mode is dry-run/checkpoint.
- Do not create or modify `<workspace>/upstreams_issues` unless the user request explicitly contains `--apply`.
- If not applying, write only `UPSTREAM_ISSUES_CHECKPOINT.md` in the current workspace.
- Keep `UPSTREAM_ISSUES_CHECKPOINT.md` under 160 lines.

Target repo rule:
- Resolve GitHub target from `owner/repo`, GitHub URL, or explicit repo path/remote.
- If target cannot be resolved, write the checkpoint with a clear blocker and exact missing input.
- State source URL, item type filter, state filter, labels filter, and limit.
- Defaults: type=issue, state=open, limit=20 for checkpoint smoke.
- Supported item types: `--type=issue`, `--type=pr`, `--type=all`.
- Supported states: `--state=open`, `--state=closed`, `--state=all`.

Evidence workflow:
1. Resolve owner/repo and docs dir name.
2. Gather bounded issue/PR evidence using context-mode tools if available.
3. Prefer GitHub Search API for issue/PR lists:
   - Issues: `GET /search/issues?q=repo:<owner>/<repo> type:issue state:<state>&per_page=<limit>`
   - PRs: `GET /search/issues?q=repo:<owner>/<repo> type:pr state:<state>&per_page=<limit>`
   - For `--type=all`, run both `type:issue` and `type:pr`, then keep separate sections.
   - For `--state=all`, run both `state:open` and `state:closed`, then merge within each item type.
   - Do not rely on `GET /repos/<owner>/<repo>/issues?state=<state>` as the primary issue list because GitHub returns both issues and pull requests there.
4. Use `GET /repos/<owner>/<repo>/issues/<number>` only for issue details and issue comments. Use `GET /repos/<owner>/<repo>/pulls/<number>` only for PR details.
5. If `/repos/.../issues` is used as fallback, filter out items with a `pull_request` field and keep fetching pages until the requested number of real issues is reached or pages are exhausted.
6. Do not use or recommend raw `curl`/`wget` commands in the final artifact. If GitHub REST is used, record the HTTP method and URL, or a context-mode/fetch tool call summary.
7. Record exact commands or URLs used, but do not paste raw JSON.
8. Group issues and PRs separately by label/component/theme.
   - Primary sample table must match the requested `--type`.
   - Cross-type references are allowed only in `Notable Issues` / `Unknowns` and must be labeled as related/out-of-scope.
9. Create `UPSTREAM_ISSUES_CHECKPOINT.md`.
10. Run checklist.
11. If `--apply` is explicitly present, create real `upstreams_issues/<project>` docs only after checkpoint passes.

Required `UPSTREAM_ISSUES_CHECKPOINT.md` sections:
# Upstream Issues Checkpoint
## 1. Target And Query
## 2. Issue/PR Evidence
## 3. Labels And Themes
## 4. Proposed Epics
## 5. Proposed Stories
## 6. Notable Issues
## 7. Unknowns And Apply Gate

Checklist:
- Target owner/repo and source URL are stated.
- Type/state/limit/labels filters are stated.
- Evidence includes commands or URLs used.
- Issue list evidence uses Search API `type:issue`, or explicitly documents fallback PR filtering.
- PR list evidence uses Search API `type:pr` when `--type=pr` or `--type=all` is requested.
- Primary sample table contains only the requested type, unless `--type=all`.
- Final artifact does not include raw `curl` or `wget` commands.
- At least 3 issues/PRs are summarized when available.
- Labels/themes are grouped or absence is explained.
- Proposed epics and stories are listed.
- Unknowns include exact command/URL needed to resolve them.
- Apply gate says whether real docs were written.
