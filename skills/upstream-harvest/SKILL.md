---
name: upstream-harvest
description: Analyze an upstream project's commit history and propose BMAD BMM documentation (epics, stories with code evidence) and validation tests, starting from a checkpoint. Use when the user wants to document a new upstream project, sync upstream docs after new commits, or regenerate docs and tests for an existing upstream. Default mode writes only UPSTREAM_HARVEST_CHECKPOINT.md; real docs and tests require --apply. Not for applying changes to integration/ (use upstream-cherry for that).
metadata:
  safety-class: checkpoint
---

# Upstream Harvest — Document & Test Upstream Changes

Pull history from an upstream clone, group commits into features, and propose BMAD BMM documentation (PRD, epics, stories) plus validation tests, checkpoint first.

## Safety Contract

Default mode writes only `UPSTREAM_HARVEST_CHECKPOINT.md` in the workspace.
Do not create, modify, or delete anything else unless the user explicitly
passed `--apply` in the same request. Never modify the upstream clone beyond
`git pull`.

## Usage

```
/upstream-harvest LocalTaskClaw                  # checkpoint only
/upstream-harvest LocalTaskClaw --since=abc123   # commits after abc123
/upstream-harvest LocalTaskClaw --update         # incremental docs update
/upstream-harvest LocalTaskClaw --apply          # write real docs + tests
```

## Paths

Relative to the project root (where `.crateon/` lives); `workflow/<PROJECT>/config.yaml` `paths.*` overrides win: upstream clone `../upstreams/<PROJECT>`, docs `../upstreams_docs/<PROJECT>`, air-gap tests `tests/test_upstream_patch_<project>.py`.

## Workflow

1. **Prepare** — find the upstream clone, `git pull`, scope the range: `git log --oneline --no-merges` (all) or `<SINCE>..HEAD`. Assess scale via `--shortstat`. If docs exist and `--update` was passed, use incremental mode below.
2. **Analyze the project** — read key files (README/CLAUDE.md/PLAN.md, entry point, configs, manifests). Determine language, frameworks, architecture, key abstractions, API endpoints, DB schema, configuration. Every fact must come from CODE, not README (README may lie).
3. **Group commits into features** — each gets commits, files, and a type: **feature epic** = current working functionality; **history epic** = approach evolution (old -> new), only if insightful. Never document obsolete approaches as features — only as history.
4. **Write `UPSTREAM_HARVEST_CHECKPOINT.md`** — required sections under Output; keep it under 200 lines.
5. **Apply gate** — stop unless the user explicitly passed `--apply` in the same request; state in the checkpoint that no real docs were written.
6. **Apply mode: write docs** — create `INDEX.md`, `prd.md`, `epics/epic-N.md`, `epics/epic-HN.md`, `stories/story-N.M.md` under the docs path, following `references/doc-templates.md` (templates, story-writing and scoping rules).
7. **Apply mode: tests** — create the docs-accuracy test and (if `integration/<PROJECT>/` exists) the air-gap test per `references/test-specs.md`, then run them. Failing tests mean docs don't match code — fix the stories and rerun. Update `upstream.last_sync_commit`/`last_sync_date` in config.yaml if it exists; report created files and test results.

### Incremental update (--update)

Find `last_sync_commit` in config.yaml or `INDEX.md`; analyze only `git log <last>..HEAD`. Per change: affects existing story -> story update; new feature -> new story (+ epic update); pure refactor -> skip or Technical Note. The checkpoint proposes deltas; with `--apply`, update INDEX.md (counts, dates), epics, stories, and regenerate/rerun tests.

## Output

`UPSTREAM_HARVEST_CHECKPOINT.md` must contain exactly these sections:

```markdown
# Upstream Harvest Checkpoint

## 1. Target And Range
## 2. Commit Evidence
## 3. Proposed Epics
## 4. Proposed Stories
## 5. Test Plan
## 6. Unknowns And Apply Gate
```

Section bar: **Target And Range** — paths, HEAD, analyzed range, full vs incremental. **Commit Evidence** — candidate features with commit ids, key files, type. **Proposed Epics** — one-line scope each. **Proposed Stories** — numbered per epic with 1-2 verifiable acceptance criteria tied to source paths. **Test Plan** — docs-accuracy and air-gap categories tied to concrete paths. **Unknowns And Apply Gate** — exact command/file per unknown; whether real docs were written.

**Example** — `/upstream-harvest LocalTaskClaw`: 42 commits `a1b2c3..d4e5f6` group into "ReAct Agent Loop" (feature) and "HTML -> React Migration" (history); the checkpoint proposes Epic 1 (stories 1.1-1.3, AC like "run.py executes tools in parallel via asyncio.gather"), Epic H1, a test plan, and the gate "no real docs written (no --apply)".

## Final message (non-negotiable, every run)

The conversation reply that ends a run MUST contain this block verbatim-shaped (absolute
paths, exact field labels), immediately before the completion-status line — everything else
in the reply is free-form, this block is not (a missing or renamed field is a protocol
violation, same as the completion token):

```text
Repository:    <upstream URL from `git -C <clone> remote get-url origin`; else "local clone, no remote">
Upstream code: <ABSOLUTE path to the upstream clone, e.g. /abs/path/upstreams/<PROJECT>>
Upstream docs: <ABSOLUTE path to the generated docs, e.g. /abs/path/upstreams_docs/<PROJECT>>
Range:         <analyzed range> · Epics: <n> · Stories: <n> · Tests: <created+run result | checkpoint-only>
```

On a checkpoint-only run (no `--apply`) the docs path is the one the apply WOULD write to,
suffixed ` (not written — no --apply)`.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — checkpoint written (and real docs + passing tests when `--apply` was passed).
- `DONE_WITH_CONCERNS` — artifact written but residual risks (failing accuracy tests, undocumented areas).
- `BLOCKED` — external blocker (upstream clone missing or unreachable).
- `NEEDS_CONTEXT` — project name or paths cannot be resolved.
