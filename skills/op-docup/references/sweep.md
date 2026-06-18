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

## Phase 1 — scope-freeze (names only, cheap)

Goal: produce the task list WITHOUT reading doc bodies or full diffs.

1. `git diff --stat <since>..HEAD` (and `git log --oneline <since>..HEAD`) → the
   changed files + commits. `<since>` = the last synced point if recorded,
   else the `--commits=N` window.
2. Group changed files by **segment** = the existing `docs/<track>` whose name
   matches the changed component, else the top-level module of the changed files
   (same path-to-track rule as the standard Workflow step 3). Changes under
   `docs/` need no segment.
3. For each segment, `ls docs/<track>/stories docs/<track>/epics` → record
   **names** only into `scope.trackDocs`. Do not open them.
4. Flag any segment whose changes touch a shared index/taxonomy doc
   (`docs/INDEX.md`, taxonomy) — the merge phase owns those, individual segments
   must not.
5. Write `docs/.docup/sweep-state.json` with one `pending` task per segment plus
   the final `merge` task. Stop here in default (no `--apply`) mode and report
   the plan in `DOCUP_CHECKPOINT.md`.

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

## Tier-1 accelerator (optional, follow-up — not the MVP)

Where the host exposes a Workflow/Task tool, the `pending` tasks of Phase 2 MAY
be dispatched to subagents (one segment each, in its own context, returning the
compact `result` summary) for true within-run offload + parallelism. It writes
the SAME plan-file, so it is interchangeable with and falls back to the
sequential pass. The sequential Tier-2 pass remains the portable default and the
correctness baseline; do not require the tool.
