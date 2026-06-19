# DocUp sweep mode — mechanics

Reference for the resumable, segment-bounded sweep (`--sweep`). The SKILL body
states *when* and *what*; this file states *how*. MVP is the **sequential**
(Tier-2) pass — portable, runs on any host (no subagent tool required).

## Why bounded + resumable

A single-context pass is `O(commits × whole-doc-corpus)`: the agent reads the
entire docs tree to map a few commits, accumulates everything in one context,
and a single timeout or provider error discards all progress. Sweep fixes both:
each segment is processed in a bounded scope, and progress is written to a
plan-file after every segment so a re-run continues instead of restarting.

## The plan-file (source of truth for resume)

Path: `docs/.docup/sweep-state.json`. Machine-readable; the human
`DOCUP_CHECKPOINT.md` summarizes it. Treat it as transient work-state
(gitignored). On full completion either delete it or leave it with
`status: complete` as a record.

```jsonc
{
  "since": "<base sha or tag>",          // range start (e.g. last synced sha or --commits window)
  "head": "<sha>",                        // range end
  "created": "<iso date>",
  "status": "in_progress",               // in_progress | complete
  "apply": true,                          // was --apply passed for this sweep
  "thresholds": { "segments": 2, "files": 30 },   // from Stack Profile or built-in default
  "tasks": [
    {
      "id": "t1",
      "segment": "docs/<track>",          // the track this task owns
      "scope": {
        "commits": ["<sha>", "..."],      // commits touching this segment
        "files":   ["src/<area>/..."],    // changed code files for this segment
        "trackDocs": ["story-1.1.md", "epic-1.md"]  // NAMES only, bodies fetched on demand
      },
      "status": "pending",                // pending | done | blocked
      "result": null                      // when done: { "wrote": [...], "summary": "...", "notes": "..." }
    }
  ],
  "merge": { "status": "pending", "indexesReconciled": false }
}
```

Keep `result.summary` to ~2–3 lines per segment — the merge phase reads only
these summaries, so they must be compact or the merge re-bloats.

## Phase 1 — scope-freeze (deterministic, metadata only)

Goal: produce the task list WITHOUT reading doc bodies or full diffs, and
**without model judgment on boundaries** (so the segment set is identical across
runs and models — the rev-3 fix for observed deepseek-5 / kimi-2 / Opus-3 drift).

**Primary — run the segmenter (`scripts/segment.js`):**
```
node <skill dir>/scripts/segment.js --root <repo> --since <base> --head HEAD [--apply]
```
It reads only metadata (`git diff --name-only`, `git log --format`, per-commit
`--name-only`), classifies each changed file to a track by the precedence below,
writes one `pending` task per track + a `merge` task to
`docs/.docup/sweep-state.json`, refreshes `docs/.docup/rubrics.json`, lists
skipped config/scaffold, and prints a one-line-per-segment summary. The disk
scans it does (building the reverse-index from existing docs) are cheap local I/O
— they never enter an LLM context; only the tiny summary + plan-file do.

**Classification precedence (file → track), highest first:**
1. declared trackmap globs — `docs/.docup/trackmap.json` `{rules:[{glob,track}]}` (project-owned)
2. reverse-index — file cited in an existing **story/epic** "Files Modified" table → that track
3. rubric index match globs — `docs/.docup/rubrics.json`
4. existing `docs/<track>/` whose name matches a path component of the file
5. structural default — `docs/<top-level-dir>` (source code only)
Skipped: root-level config, top-level dot dirs (`.beads`, `.github`, …),
unmapped non-source files. Ties: longer/more-specific rule wins, then alphabetical.

**Rubric index** `docs/.docup/rubrics.json` (persistent, KB-sized, self-feeding):
per track `{id, track, match:{paths:[]}, coveredFiles:[], canonicalDocs:[]}`.
op-docup's own "Files Modified" writes enrich `coveredFiles`, so segmentation
converges to stable rubrics and per-run input stays corpus-independent.

**Prose fallback (only if you cannot run node):** do steps 1-5 by hand —
`git diff --stat`/`log` for the change set; for each changed source file pick the
track by the same precedence (longest-prefix match against existing `docs/<track>`
names and any story/epic that already cites the file; else top-level dir); skip
config/scaffold; `ls docs/<track>/{stories,epics}` for names; write the plan-file.

In default (no `--apply`) mode, stop after the plan-file and report it in
`DOCUP_CHECKPOINT.md`.

## Phase 2 — per-segment pass (sequential, the MVP)

Loop, one task at a time:

1. Pick the first `pending` task. Load **only** its `scope`: that segment's
   commits, its changed files' diffs, and the named track docs (open bodies now,
   on demand — not the whole corpus).
2. Run the standard Workflow steps 2–5 (classify → map → respect contracts →
   fresh-reader) **scoped to this segment only**.
3. On `--apply`: write/update only this track's stories/epics + this track's
   epic story-tables. Do NOT touch `docs/INDEX.md` or taxonomy (merge owns them).
4. Set the task `status: done` and `result: { wrote, summary, notes }`, then
   **write the plan-file before moving to the next task**. This persistence is
   what makes the run resumable.
5. **Budget guard.** If you are approaching a context/turn budget and tasks are
   still `pending`, stop the loop and end the run with the resume status (below).
   Do not push into an unbounded context.

### Resume-status convention (protocol-safe)

No new completion token. A partial sweep is a *successful* invocation that made
progress, so it ends:

```
DONE_WITH_CONCERNS — <X>/<Y> segments synced, <Z> pending; re-run op-docup --apply to continue
```

The machine-readable remaining count lives in the plan-file (`tasks[].status`),
so a driver loop polls the file, not the prose:

```
while jq -e '.status != "complete"' docs/.docup/sweep-state.json >/dev/null; do
  op-docup --sweep --apply
done
```

A re-invocation reads the plan-file first (see "Resume first" in the SKILL) and
continues from the next `pending` task with a fresh context — that is where the
real context offload happens.

## Phase 3 — merge (once, when all segment tasks are done)

1. Read the compact `result.summary` of every task (NOT the doc corpus).
2. Reconcile cross-segment concerns once: update `docs/INDEX.md` / taxonomy;
   enforce **single source of truth** — if two segments documented the same
   capability, keep one canonical doc and make the other a pointer
   (`See <path>`), never a second copy. Dedup by a content-addressed natural key
   (`domain | line-stripped-paths | controlled-anchor`), not by free-text title.
3. Set `merge.status: done`, `merge.indexesReconciled: true`, top-level
   `status: complete`. Write the final `DOCUP_CHECKPOINT.md` (standard Output
   sections, aggregating per-segment results). End `DONE`.

## Idempotency & safety

- Every invocation reads the plan-file first; existing → resume, absent →
  Phase 1. Re-running a `complete` sweep is a no-op that reports nothing to do.
- A segment already `done` is never reprocessed → no duplicate docs across
  re-runs; combined with the "no second source of truth" rule, resume is safe.
- Write files only — never `git add`/`commit`/`reset`. An interrupted or resumed
  run must never strand a detached worktree.

## Tier-1 accelerator (subagent fan-out)

Where the host exposes a Workflow/Task tool, dispatch the `pending` segments to
subagents — one per track, each in its OWN context — for true within-run context
offload + parallelism. The engine ships as `scripts/sweep-workflow.js`.

**Invoke (preferred):** the Workflow tool with
`scriptPath = <skill dir>/scripts/sweep-workflow.js` and

```jsonc
args = {
  root: "<repo absolute path>", since: "<base sha>", head: "<sha>",
  apply: true,                         // mirror op-docup --apply
  segments: [ /* the plan-file's pending tasks: {id, segment, scope} */ ]
}
```

It returns `{ segments: [{ id, segment, status, wrote[], summary, notes }] }`.
Each segment agent reads ONLY its track's commits + named docs, writes ONLY that
track's stories/epics (on apply), and returns a 2-3 line summary. Fold every
returned item back into the plan-file (`status: done`, `result`), then run
**Phase 3 merge exactly as in Tier-2** — the engine does NOT reconcile indexes;
the skill still owns the single cross-segment merge using the returned summaries.

**Parallel-safe without worktree isolation.** Each segment owns a distinct
`docs/<track>/` dir and is forbidden from touching `docs/INDEX.md` / taxonomy
(merge owns those), so concurrent agents never write the same file. Do not pay
for `isolation: 'worktree'`.

**Fallbacks (capability ladder).**
- Workflow tool present → run the engine (parallel).
- Only a `Task`/subagent tool present → spawn the same per-segment prompt as
  sequential `Task` agents (the engine's `perSegmentPrompt` is the contract).
- Neither → Tier-2 sequential. **This is the correctness baseline and the
  portable default; never require the tool.**

**Resume still holds.** A segment whose agent died comes back `status: blocked`
(or simply stays `pending` if never dispatched) → the next invocation re-runs
only those. Folding results into the plan-file before merge keeps Tier-1 and
Tier-2 interchangeable across re-runs.

## Driver loop (reliable completion on stall-prone / weak models)

`--batch` is advisory — a slow model may ignore it or stall mid-segment. The
**hard, cross-model** completion mechanism is `scripts/sweep-driver.mjs`: an
*external* loop that re-invokes the model **once per segment** over the
plan-file, so each invocation gets a fresh, bounded context and cannot stall on
accumulated state.

```
node <skill dir>/scripts/sweep-driver.mjs --root <repo> --since <base> --head HEAD \
  --cmd '<host invocation template with {ROOT} {PROMPT} {TO}>' [--per-call 1] [--to 600]
```
- Host-agnostic: you supply `--cmd` (the driver substitutes `{ROOT}` `{PROMPT}`
  `{TO}`). Example (kimi via the claude client):
  `cd {ROOT} && timeout {TO} crt ask claude --key KIMI_API --model kimi-k2.7-code --timeout {TO} {ROOT} "$(cat {PROMPT})" -- --dangerously-skip-permissions`
- It runs `segment.js` first (deterministic scope-freeze), then loops: scoped
  prompt for one `pending` segment → invoke → mark `done`. **Robust to
  status-lag** — if the model wrote the segment's docs but forgot to mark it, the
  driver marks it from the docs that appeared; a clean no-write call → no-docs;
  an errored/timed-out call → retry once, then `blocked` (never an infinite loop).
- Finishes with one bounded **merge** call, sets `status: complete`, exits 0.

Empirically this rescues a model that stalls under Tier-2: regular kimi (which
never finished a 20- or 6-commit sweep in one invocation) completed all 5
segments + merge across 6 bounded driver calls. Use it for weak/slow lanes; for
fast lanes Tier-2 in one invocation or Tier-1 fan-out is simpler.
