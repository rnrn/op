---
name: op-feedback-harvest
description: Harvest durable preflight feedback rules from git commits, bug fixes, reviews, incident notes, and agent-contract rules (AGENTS.md/CLAUDE.md) into docs/feedback. Use when the user asks to collect feedback from commits, update docs/feedback after bugs, backfill preflight rules, or bootstrap feedback rules for a fresh project. Default mode writes only a checkpoint; updating docs/feedback requires explicit `--apply`.
metadata:
  safety-class: checkpoint
---

# Feedback Harvest

Convert recent project history into durable `docs/feedback` rules for `op-preflight`. This is a maintenance/bootstrap workflow, not normal preflight; never run it implicitly from `op-preflight`.

## Safety Contract

Default mode writes only `docs/feedback/audits/op-feedback-harvest-YYYYMMDD-HHMM.md`
in the workspace. Do not create, modify, or delete anything else unless the
user explicitly passed `--apply` (or clearly said to apply/update rules) in
the same request. Write files only — never run `git add`, `git commit`, or
`git reset`; staging and commits belong to the user or the `baby-commit`/
`dry-commit` skills.

Never store secrets, API keys, tokens, passphrases, proxy credentials, or raw logs in feedback. Redact command output and error payloads to the smallest evidence needed.

## Usage

- `feedback-harvest --last 50`
- `feedback-harvest --since 2026-05-03`
- `feedback-harvest <commit-range>`
- `feedback-harvest --apply ...`

No range given -> commits since the latest commit that touched `docs/feedback`; if none exists, the last 50 commits.

## Workflow

1. Resolve the project root from the requested path or cwd.
2. Read `docs/feedback/index.md` if it exists, plus `baseline.md`, `process.md`, and `rules-and-skills.md` when present.
3. Determine the commit window (explicit flags > since last `docs/feedback` change > last 50). **An explicit list of commit hashes IS a valid window** — treat the named set as the window directly.
4. Classify commits into candidates: bug/regression fixes; test additions encoding a new invariant; protocol/client/runtime/deploy/security changes; workflow/skill/agent behavior changes; repeated operator friction.
   - **Declared rule sources are first-class candidates too:** `AGENTS.md`, `CLAUDE.md` critical-rules / review-checklist sections, and lesson entries in project CHANGELOGs. Cite the source file per rule. This matters most on a fresh scaffold, where the project's real rules predate `docs/feedback` and live in the agent contract — exactly the case `op-preflight` flags as template-only.
5. Inspect only bounded evidence per candidate: commit subject/body, changed file names, targeted diff hunks, referenced story/epic notes.
6. Extract durable rules, not change summaries. Good: "When CLI flags override saved config, persist the resolved runtime endpoint before launching the client." Bad: "Fixed bug in commit abc123."
7. Place each rule before mapping it. First decide whether it is a **design invariant already owned by a source-of-truth doc** (`docs/**/architecture.md`, `design.md`, `docs/HANDBOOK.md`, `baseline.md`): if so, the feedback rule must be **pointer-form** ("follow `<doc>#<rule>`"), never a restatement that can later drift — **but pointer-form requires a cited `doc#anchor` that actually exists**; if you assert an invariant is owned upstream you must cite the exact `doc#anchor`, and if you cannot find one, it is NOT owned upstream → write the full rule (don't emit a pointer to a non-existent anchor). If the invariant belongs upstream but is missing there, route it to that doc (or flag it in Open Questions), not only into feedback. Only genuinely incident-born rules get a full checklist entry in `docs/feedback`. Then map the rule to an existing feedback file or propose a narrow new one, and run duplicate detection against current `docs/feedback/*.md` (and against the source-of-truth docs above) — procedure, examples, and the file-mapping table are in `references/rules-guide.md`.
8. Write the audit checkpoint (shape under Output) with commit range, selected/rejected commits, proposed rules, duplicate matches, target files, and unresolved questions.
9. With `--apply`: re-run duplicate detection; update `docs/feedback` files and `index.md` selector entries only for non-duplicate `APPLY` rules (never `DUPLICATE`/`WATCH`/`REJECT`); keep rules checklist-oriented and project-local; run the apply-mode validation in `references/rules-guide.md` — its mechanical form is `node scripts/validate-feedback.mjs --root <project-root>` (dead index routes, missing `Checklist (for preflight)` sections, dead `doc#anchor` pointers, checkpoint shape, secret patterns; exit 0 = clean).

## Rule Quality Bar

Promote a candidate only when it is durable (prevents future regressions), actionable (checkable by `op-preflight`), project-local, non-duplicative (of other feedback rules **and** of invariants already owned by a source-of-truth doc — those become pointer-form, see step 7), and tied to a test, command, incident, bug, or documented operator path. Useful but not ready -> keep it in the checkpoint as `WATCH`, not as a rule. Already covered -> mark `DUPLICATE`, name the existing rule id/file, do not apply.

## Output

Return to the conversation: commit range inspected, checkpoint path, rule files proposed/changed, duplicate count and targets, selected/rejected commit counts, remaining `WATCH` items.

Write checkpoints to `docs/feedback/audits/op-feedback-harvest-YYYYMMDD-HHMM.md` — it **must contain exactly these sections, in order** (`## Selected Commits`, `## Rejected Commits`, `## Proposed Rules`, `## Index Updates`, `## Open Questions`):

```markdown
# Feedback Harvest YYYY-MM-DD HH:MM

Range: <range>
Mode: checkpoint | apply

## Selected Commits

- `<hash>` <subject> -> <reason>

## Rejected Commits

- `<hash>` <subject> -> <reason>

## Proposed Rules

### <target feedback file>

- Rule: <durable checklist rule, or pointer to the owning source-of-truth doc>
- Origin: incident (<commit/date>) | design-invariant (owner: <doc>) | imported-baseline
- Evidence: <commit/test/story reference>
- Status: APPLY | WATCH | DUPLICATE | REJECT
- Duplicate of: <file>#<rule-id> when status is DUPLICATE

## Index Updates

- <selector or priority update>

## Open Questions

- <question or none>
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — checkpoint written (and rules applied, if `--apply`); no unresolved questions.
- `DONE_WITH_CONCERNS` — checkpoint written but open questions or `WATCH` items remain; list them.
- `BLOCKED` — no git history available or `docs/feedback` cannot be created.
- `NEEDS_CONTEXT` — commit range ambiguous and no `docs/feedback` baseline exists to infer one.
