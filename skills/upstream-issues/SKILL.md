---
name: upstream-issues
description: Harvest bounded GitHub issues and pull requests into a checkpoint first, with explicit --type issue|pr|all and --state open|closed|all filters. Use when the user wants to review, triage, or document a repository's GitHub issues or pull requests. Default mode writes only UPSTREAM_ISSUES_CHECKPOINT.md; BMAD BMM docs are materialized only when --apply is present.
metadata:
  safety-class: checkpoint
---

# Upstream Issues — Harvest GitHub Issues/PRs into BMAD BMM

Harvest bounded GitHub issue and pull request evidence into a checkpoint first, then optionally materialize BMAD BMM docs under `upstreams_issues/<project>/`.

## Safety Contract

Default mode writes only `UPSTREAM_ISSUES_CHECKPOINT.md` in the current
workspace. Do not create, modify, or delete anything else unless the user
explicitly passed `--apply` in the same request — only then write the full
docs under `<workspace>/upstreams_issues/`. Do not treat prose-only analysis
as success; create or update the real artifact.

## Usage

```text
/upstream-issues nousresearch/hermes-agent
/upstream-issues PurpleAILAB/Decepticon --type=pr --state=closed --limit=20
/upstream-issues PurpleAILAB/Decepticon --apply
```

Filters: `--type=issue` (default) | `pr` | `all`; `--state=open` (default) | `closed` | `all`; `--limit=<N>` (default 20); `--labels=<label[,label...]>`; `--apply` writes full docs after the checkpoint passes.

The argument may be `owner/repo`, a GitHub URL, or a local repo path with a GitHub remote (read `origin`). Disk name: `owner--repo`; before creating docs, reuse an existing matching directory in `<workspace>/upstreams_issues/`.

## Data Collection Rules

Prefer the GitHub Search API. Do NOT use `GET /repos/<owner>/<repo>/issues` as the primary list — that endpoint returns both issues and pull requests.

```text
GET /search/issues?q=repo:<owner>/<repo> type:issue state:<state>&per_page=<limit>
GET /search/issues?q=repo:<owner>/<repo> type:pr state:<state>&per_page=<limit>
```

`--type=all`: run both `type:issue` and `type:pr`, keep separate sections. `--state=all`: run both `state:open` and `state:closed`, merge within each item type.

Detail endpoints only after the primary list is known: `GET /repos/<o>/<r>/issues/<n>` (+`/comments`), `GET /repos/<o>/<r>/pulls/<n>`; PR reviews only when useful and bounded. If forced to fall back to `/repos/.../issues`, filter out items with a `pull_request` field for issue harvests and keep paging until the requested number of real issues is reached or pages are exhausted.

## Workflow

1. Resolve owner/repo and docs dir name; parse filters and record exact type/state/limit/labels.
2. Gather bounded evidence via context-mode tools when available, `gh api`, or GitHub REST. Record commands or URLs used; never paste raw JSON.
3. Group issues and PRs separately by label -> component keyword -> recurring theme -> miscellaneous. Minimum 3 items per epic (merge smaller groups into `Miscellaneous`); one item belongs to one primary epic, cross-references in notes.
4. Create `UPSTREAM_ISSUES_CHECKPOINT.md` (shape under Output, under 160 lines unless a full dump is requested) and run the checklist.
5. If `--apply` and the checkpoint passes, write docs under `<workspace>/upstreams_issues/<DIR_NAME>/`: `INDEX.md` (source URL, harvest date, filters, counts, epic/story links), `epics/epic-N.md`, `stories/story-N.M.md`. Each story: GitHub number+URL, type, state, labels, dates, comment/review counts, bounded body summary, key comments, relevance to the target project if supplied.

Never include: bot noise (unless it is the subject), raw JSON, full comment threads (top 3-5 informative comments only), or `curl`/`wget` commands when context-mode or `gh api` evidence can be recorded instead.

## Output

```markdown
# Upstream Issues Checkpoint

## 1. Target And Query
## 2. Issue/PR Evidence
## 3. Labels And Themes
## 4. Proposed Epics
## 5. Proposed Stories
## 6. Notable Issues
## 7. Unknowns And Apply Gate
```

Checklist before finishing:

- Target owner/repo, source URL, and type/state/limit/labels filters stated; evidence includes the commands or URLs used.
- Issue lists use Search API `type:issue` (or document the fallback PR filtering); PR lists use `type:pr`.
- The sample table contains only the requested type; states and item types not mixed unless `--type=all`/`--state=all`.
- No raw `curl`/`wget` in the artifact; at least 3 issues/PRs summarized when available.
- Labels/themes grouped or absence explained; epics and stories proposed.
- Unknowns include the exact command/URL to resolve them; the apply gate states whether real docs were written.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` - task completed within the skill's scope.
- `DONE_WITH_CONCERNS` - mostly complete, residual risks.
- `BLOCKED` - external blocker.
- `NEEDS_CONTEXT` - missing information.
