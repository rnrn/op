---
name: op-docup
description: Syncs recent code changes with BMAD project documentation, starting from a sync checkpoint. Use when code changed and docs need updating, after implementing a feature or fix, to map commits to stories and epics, or to verify docs before closing an epic (--epic). Default mode writes only DOCUP_CHECKPOINT.md; real doc updates require --apply. For a large change set spanning many tracks, --sweep (also auto-detected) runs a resumable, segment-bounded pass that survives interruption and continues where it left off on re-run.
metadata:
  safety-class: checkpoint
---

# DocUp Skill

Keep project documentation in sync with code changes. Analyze recent commits
and diffs, classify the changes, and map each one to a docs track, epic, and
story (new story, update, or no-docs-needed). The mapping lands in a
checkpoint file first; real documentation is modified only on explicit apply.

## Safety Contract

Default mode writes only `DOCUP_CHECKPOINT.md` in the workspace. Do not
create, modify, or delete anything else unless the user explicitly passed
`--apply` in the same request. Write files only — never run `git add`,
`git commit`, or `git reset`; staging and commits belong to the user or the
`baby-commit`/`dry-commit` skills (an agent that auto-commits can corrupt a
detached worktree and strand later steps).

## Usage

```
/op-docup                  # Analyze recent changes, write DOCUP_CHECKPOINT.md
/op-docup --commits=10     # Analyze last N commits (default: 5)
/op-docup --uncommitted    # Include uncommitted changes
/op-docup --track=NAME     # Limit to one documentation track
/op-docup --epic=ID        # Epic-closure mode: sync scoped to that epic's stories
/op-docup --apply          # Checkpoint, then update/create real docs
/op-docup --sweep --apply  # Large change set: resumable, segment-bounded pass
```

Sweep auto-engages on large change sets and resumes automatically if a prior
sweep was interrupted (see "Sweep mode" below).

**Epic-closure mode (`--epic=<id>`):** scope the analysis to the commits and
stories belonging to that epic. The epic may be declared synced only when the
architecture doc's feature/pages map agrees with the code for the epic's
scope; on disagreement, end with `DONE_WITH_CONCERNS` or `BLOCKED` — never
report the epic as synced. Projects that define an Epic Closure Gate in
`AGENTS.md` run this mode before flipping an epic to DONE.

## Workflow

1. **Gather bounded change evidence** — `git status --short`,
   `git log --oneline -5` (or `--commits=N`), `git diff --stat`. If the
   request names specific files, diff those files; otherwise use a bounded
   git diff/status of the recent change. Record commands used, not raw dumps.
2. **Classify each significant change** — type (feature | bugfix | refactor |
   config | docs | test), scope, impact, files, contract impact, proof, and
   fresh-reader risk. Conventional-commit prefixes guide the type
   (`feat:` -> feature, `fix:` -> bugfix, `refactor:`/`docs:`/`test:`/
   `config:` likewise).
3. **Map changes to documentation** — find the matching track in `docs/*/`
   (epics in `docs/<track>/epics/`, stories in `docs/<track>/stories/`).
   Path-to-track guidance: prefer an existing track whose name matches the
   changed component; otherwise derive the track from the top-level folder of
   the changed files (e.g., `server/...` -> `server`,
   `frontend/src/...` -> `frontend`, `services/payments/...` -> `payments` —
   illustrative examples; any stack's top-level modules work the same way,
   e.g. `internal/ui/...` -> `ui`, `blocks/...` -> `pipeline`);
   changes under `docs/` need no mapping. Decide per change: update an
   existing story, create a new story, or no-docs-needed with a reason.
4. **Respect project contracts** — if `docs/HANDBOOK.md` exists, check
   whether the change affects contract, runtime rung, owner subsystem,
   source of truth, or proof path; update taxonomy/index docs instead of only
   adding story notes when ownership moved; never add a second source of
   truth. **Restore-or-delete rule:** when a documented composition or
   feature has disappeared from the code, propose either restoring it in
   code or deleting/downgrading the doc requirement — never leave both
   standing (that is exactly how dead-but-documented features accumulate).
5. **Fresh-reader check** — for new or changed user-facing docs, verify a
   fresh reader could follow them (prerequisites, commands, expected output,
   failure modes). Record `fresh-reader: pass | blocked | not run - reason`.
6. **Write `DOCUP_CHECKPOINT.md`** — required sections listed under Output;
   keep it under 140 lines.
7. **Apply gate** — only if the user explicitly passed `--apply` in the same
   request: update existing stories (mark completed ACs `[x]`, set status,
   add implementation notes) and create new stories using the template in
   `references/templates.md`, updating epic story tables and track indexes.
   Otherwise state in the checkpoint that no real docs were written.

Read `references/templates.md` when applying (BMAD story-update template).

## Sweep mode (large change sets, resumable)

A single-context pass over a large change set blows tokens and is all-or-nothing
(one timeout loses everything). Sweep **bounds context per segment** and
externalizes progress to a durable plan-file, so an interrupted run **resumes
instead of restarting**. Read `references/sweep.md` for the plan-file schema and
the loop recipe.

**Trigger.** The default single-pass Workflow above stays for small changes — no
regression. Sweep engages on `--sweep`, or auto when changed top-level segments
> 2 or touched files > 30 (override the threshold in the `AGENTS.md` Stack
Profile).

**Resume first (every invocation).** Before anything else, look for
`docs/.docup/sweep-state.json`. If it exists with `status` ≠ `complete`,
**resume**: skip scope-freeze and continue from the first `pending` task. Absent
→ start at Phase 1.

1. **Scope-freeze (cheap, names-only).** From `git diff --stat <since>..HEAD`
   derive the changed segments (tracks) and, per segment, its changed files +
   commit shas + that track's story/epic **names**. Do NOT read doc bodies or
   full diffs here. Flag segments that touch shared indexes/taxonomy. Write one
   `pending` task per segment plus a final `merge` task into
   `docs/.docup/sweep-state.json`.
2. **Per-segment pass (sequential, bounded).** Walk `pending` tasks one at a
   time. Each task sees **only its segment scope** (that track's commits + named
   docs; fetch bodies on demand) — run Workflow steps 2–5 scoped to that
   segment, and on `--apply` write only that track's stories/epics. Mark the
   task `done` and **persist the plan-file before the next task**. If you near a
   context/turn budget with tasks still `pending`, **stop** and end with
   `DONE_WITH_CONCERNS` whose reason names `X/Y segments synced, Z pending —
   re-run op-docup --apply to continue` (no new status token; the count lives in
   the plan-file and a re-run resumes).
3. **Merge (once, when all segment tasks are `done`).** Read the compact
   per-segment summaries from the plan-file (NOT the corpus); reconcile
   `docs/INDEX.md`/taxonomy once; enforce single source of truth (cross-segment
   dedup — never document the same thing in two tracks). Set `merge.status` and
   top-level `status: complete`, write the final `DOCUP_CHECKPOINT.md`, end
   `DONE`.

Per-segment budget target ≤ ~50–80k tokens; total scales with Σ segments, not
the product. Skills write files only — never commit (a resumed or interrupted
run must not strand a worktree). Where the host provides a Workflow/Task tool,
segments MAY be dispatched to subagents for parallel speed; the sequential pass
above is the portable default and the correctness baseline.

## Output

`DOCUP_CHECKPOINT.md` must contain exactly these sections:

```markdown
# DocUp Checkpoint
## 1. Change Evidence
## 2. Change Classification
## 3. Documentation Mapping
## 4. Proposed Documentation Updates
## 5. No-Docs-Needed Items
## 6. Risks And Unknowns
## 7. Apply Gate
```

Checkpoint quality bar: evidence names the git commands or file paths used;
changes are grouped by type; every significant change maps to a docs action
or a no-docs-needed reason; proposed updates name exact docs paths; unknowns
include the exact command or file needed to resolve them; the apply gate says
whether real docs were written.

**Example** — `/op-docup` after a fix adding retry logic to the API client:
evidence `git log -3` shows `fix: retry transient 5xx in api client` touching
`server/client/http.go` + test; classification bugfix, scope `server`, proof =
retry unit tests; mapping: track `server`, epic-3-reliability exists, no story
covers retries -> propose new `docs/server/stories/story-3.4.md` + epic table
row; checkpoint gate reads "no real docs written (no --apply)". With
`--apply`: create story-3.4.md, update the epic row, report paths touched.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — checkpoint written (and real docs updated when `--apply` was passed).
- `DONE_WITH_CONCERNS` — checkpoint written but with unresolved mapping or fresh-reader risks.
- `BLOCKED` — an external blocker prevents analysis (e.g., not a git repository and no file evidence).
- `NEEDS_CONTEXT` — the target repository or change set cannot be identified from the request.
