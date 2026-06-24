// op-docup sweep — Tier-1 fan-out engine. Invoked via the Workflow tool with a
// scriptPath pointing here. The skill does the cheap names-only scope-freeze and
// passes the frozen segment list in `args`; this engine dispatches ONE bounded
// doc-sync agent per segment (each writes ONLY its own track in its own context)
// and returns compact per-segment summaries. The skill folds those into the
// durable plan-file and runs the single cross-segment merge afterwards.
//
//   args = {
//     root:     "<repo root absolute path>",
//     since:    "<range base sha/tag>", head: "<sha>",
//     apply:    true | false,                       // mirror op-docup --apply
//     segments: [{ id, segment, scope:{ commits[], files[], trackDocs[] } }],
//   }
//
// Returns: { segments: [{ id, segment, status, wrote[], summary, notes }] }
//
// Parallel-safe WITHOUT worktree isolation: each segment owns a distinct
// docs/<track>/ dir and is forbidden from touching docs/INDEX.md / taxonomy
// (the skill's merge phase owns those), so concurrent agents never write the
// same file.

export const meta = {
  name: 'docup-sweep',
  description: 'Segment-bounded documentation sync: one agent per documentation track maps that track\'s commits to its stories/epics in an isolated context and returns a compact summary. Bounds context per segment so large change sets do not blow a single context.',
  phases: [
    { title: 'Segments', detail: 'one bounded doc-sync agent per documentation track' },
  ],
}

const A = args || {}
const ROOT = A.root || '.'
const APPLY = !!A.apply
const SEGMENTS = A.segments || []

const SEGMENT_RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['segment', 'status', 'wrote', 'summary', 'notes'],
  properties: {
    segment: { type: 'string', description: 'the docs/<track> this agent owned' },
    status: { type: 'string', enum: ['done', 'blocked'] },
    wrote: { type: 'array', items: { type: 'string' }, description: 'exact doc paths created/updated (empty in no-apply or no-docs-needed)' },
    summary: { type: 'string', description: '2-3 line per-segment verdict for the cross-segment merge step' },
    notes: { type: 'string', description: 'no-docs-needed reasons, unknowns, or what blocked it' },
  },
}

function perSegmentPrompt(s) {
  const sc = s.scope || {}
  return `You are a DOC-SYNC agent for ONE BMAD documentation track. Work ONLY within this track's
scope. Do NOT read or modify other tracks, docs/INDEX.md, or any taxonomy/index doc — a later
merge step owns cross-segment reconciliation. Read REAL files with your tools (absolute paths).

Repo root: ${ROOT}
Track (segment): ${s.segment}
Commits in scope: ${(sc.commits || []).join(', ') || '(none)'}
Changed code files: ${(sc.files || []).join(', ') || '(none)'}
Existing docs in this track (names only — open bodies on demand): ${(sc.trackDocs || []).join(', ') || '(none yet)'}

Steps (op-docup per-segment contract):
1. For each in-scope commit, read its diff for the changed files only (git show / git diff). Do NOT
   list or read the whole docs corpus — stay inside ${s.segment}.
2. Classify each change (feature | bugfix | refactor | config | docs | test) and map it to this
   track: update an existing story, create a new story, or no-docs-needed with a reason. Never add a
   second source of truth for something already documented.
3. ${APPLY
    ? `WRITE now: update/create ONLY this track's stories/epics + this track's epic story-table, using
   the Write/Edit tools. Match the BMAD format of the track's existing stories (read one first). Mark
   completed acceptance criteria, set status, add implementation notes citing the commit.`
    : `Do NOT write any file. Only propose the mapping in your summary.`}
4. NEVER run git add / git commit / git reset. Write files only.

Return the structured result: status (done unless something external blocked you), wrote (exact doc
paths you created/updated; empty if none), a 2-3 line summary for the merge step, and notes.`
}

phase('Segments')
log(`Dispatching ${SEGMENTS.length} per-segment doc-sync agent(s) over ${ROOT} (apply=${APPLY}).`)

// Tier policy embedded verbatim — canonical: scripts/lib/fan-out-lane.mjs ("fan-out-lane:v1").
// A WRITE lane (--apply, doc-sync writes files) → capable model; a read/propose lane
// (checkpoint-only) → cheap model. (Self-escalation for cheap lanes lives in the lib;
// these doc-sync lanes are write-or-propose, not escalating.)
// Tier ids arrive via `args` (aliased A) — the Workflow sandbox has no `process` (env would throw).
// The skill resolves OP_FANOUT_* in-session and forwards {cheapModel, capableModel} in args.
const laneModel = (kind) => (kind === 'write' ? (A.capableModel || undefined) : (A.cheapModel || 'haiku'))
const segModel = laneModel(APPLY ? 'write' : 'read')

const results = await parallel(
  SEGMENTS.map((s) => () =>
    agent(perSegmentPrompt(s), { label: `sweep:${s.segment}`, phase: 'Segments', model: segModel, schema: SEGMENT_RESULT_SCHEMA })
      .then((r) => (r
        ? { id: s.id, segment: s.segment, status: r.status, wrote: r.wrote || [], summary: r.summary || '', notes: r.notes || '' }
        : { id: s.id, segment: s.segment, status: 'blocked', wrote: [], summary: '', notes: 'agent produced no result (skipped or died); re-run resumes this segment' }))
  )
)

const segments = results.filter(Boolean)
log(`Segments done: ${segments.filter((x) => x.status === 'done').length}/${segments.length}.`)
return { segments }
