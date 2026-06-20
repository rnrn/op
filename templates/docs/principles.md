# Shared principles (read once, applied everywhere)

Cross-cutting conventions every op-* skill and agent obeys. Stated here once so
skills do not re-state them; a skill logs a line only to **deviate** from one of
these (naming which), never to repeat it.

## GP1 — Declared values win over defaults
Read the `AGENTS.md` Stack Profile first (language, archetype, build/test commands,
docs layout, **task/spec system** → `docs/spec-systems.md`, file/commit budgets).
A skill's built-in numbers and stack examples are illustrative defaults; declared
values replace them. Manifest/archetype/system sets are **open** — never hardcode a
closed list.

## GP2 — Checkpoint-first; write only on --apply
Default mode writes a checkpoint/report only. Real files are created/changed only
when the user passes `--apply`/`--fix`/`--commit` in the same request.

## GP3 — Git boundary
Skills **write files; they do not stage or commit.** Never run `git add`,
`git commit`, or `git reset` — staging/commits belong to the user or to
`baby-commit`/`dry-commit`. (Auto-commit under `--dangerously-skip-permissions`
corrupts detached worktrees.)

## GP4 — Autonomy boundary (hands-off ≠ more authority)
Running without a user present: **never invent a required-but-unspecified value**
(use the stated/prior value or defer). Reversibility ladder: rename-before-delete ·
add-before-replace · stash-not-reset · branch-never-main · stop-not-destroy; if
unsure it is reversible, assume not, and defer. Split hands-off checkpoints into
`### Decisions` vs `### Deferred (needs user input)` — deferred is never silent.

## GP5 — Proof targets the outcome
Validation/proof targets the User Spec's success **signal**, not a stand-in. When
only a **proxy** is runnable (local smoke vs real-scale/remote/user-env outcome),
name the gap; a passing proxy is `WATCH`, not `PASS`/`verified`.

## GP6 — Verify teeth
A `verified`/`fixed`/`passed` verdict cites evidence re-read **in this run** (a
`file:line`, a command output) — "linter passed" / "agent said done" / "should
work" are not evidence. No silent demotion of an unresolved item to "future work".

## GP7 — Resumable state, status cursor
A long run externalizes its state to a durable file with a machine-readable status
cursor (write atomically; reconcile from the repo, not memory) so a fresh agent
resumes after a crash, stop, or compaction. Persist counters and the charter.

## GP8 — Completion-status protocol (non-negotiable)
The VERY LAST line starts with exactly one token — `DONE` · `DONE_WITH_CONCERNS` ·
`BLOCKED` · `NEEDS_CONTEXT` — optionally followed by ` — <one-line reason>`. Never
invent other status wording. (Each skill's own section is authoritative for its
token meanings.)

## GP9 — Brevity (artifacts are an audit trail, not a retelling)
**Omit, don't fill** — a subsection that would say "none"/"n/a" is deleted; its
absence is the signal. Evidence only on surprise. Never re-narrate a diff (a SHA +
short name suffices). **Wiring test:** keep a reference a stranger could `grep` for
(another skill/file); cut conversation-bleed (model names, "added for the X flow",
"NOT Z" where Z was a removed suggestion).
