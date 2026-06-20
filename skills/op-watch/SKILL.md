---
name: op-watch
description: Drive a remediation or build campaign to completion under a goal loop. One invocation runs ONE bounded step — it reads the campaign state, dispatches the right sub-step (audit/plan/debug/verify), updates state, and returns a deterministic CLEAN/CONTINUE verdict that a `goal` loop reads to keep going or stop. Use to autonomously work a backlog or audit ledger to done with `goal op-watch "<intent>"`, or to advance one step manually. Resumable after a crash or stop. Thin dispatcher — it delegates to op-audit/op-debug/op-planner and owns no analysis.
metadata:
  safety-class: checkpoint
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Skill
---

# Watch Skill

Drive a campaign — a remediation (fix an audit ledger) or a build (ship a backlog)
— to completion **one bounded step per invocation**, so a `goal` loop can pump it
without you babysitting. op-watch is a **thin dispatcher**: it picks and runs the
right sub-step, persists durable state, and computes an honest verdict. The loop
control lives in `goal`; the *honesty* lives in a deterministic verdict script.

## Safety Contract

op-watch itself writes only the campaign state file (`docs/.work/<slug>.json`) and
delegates real changes to the underlying skills, which keep their own `--apply`
gates. It never runs `git add`/`git commit`/`git reset`. It obeys the AGENTS.md
**autonomy boundary** (no invented defaults; reversibility ladder; gate irreversible
sub-steps) and **never auto-fixes** Critical/structural units — those are deferred
to the user.

## Usage

```
goal op-watch "<intent>"     # the simple launch: goal pumps op-watch until CLEAN
op-watch "<intent>"          # one step (creates/advances the campaign), then verdict
op-watch --state docs/.work/<slug>.json   # advance an existing campaign one step
```
The `<intent>` is the **charter** (the WHY), stored in the state file — not the
termination test. Termination is the verdict over state. `goal op-watch "ledger
clean"` is the remediation special case where the campaign IS an existing ledger.

## One step (every invocation)

1. **Read state** `docs/.work/<slug>.json` (units, statuses, budget, counters,
   charter, history). Absent → **derive** (atomic; a crashed derive leaves no partial
   backlog):
   - Write a **frozen `charter`** — `{intent, done_condition, anchor, spec_system,
     branch}`. `done_condition` is the termination shape (e.g. `epic-closure-gate`
     or `ledger-clean`); `anchor` is the epic/spec-unit id; `branch` is the current
     git branch. Subsequent steps **read** the charter; they never rewrite it (a
     re-derived charter post-compaction would be non-idempotent).
   - **Decompose** into units (delegate: `op-audit run`/`run --spec` for remediation,
     `op-planner` for build) with acceptance criteria. **Ingest** the findings ledger
     by natural key — `scripts/ingest.mjs --state <file> --findings <ledger.json>
     --write` — so a defect reported independently by audit + drift + debt collapses
     to **one** unit (each unit carries its `key`). *Coverage check:* every part of
     the intent maps to a unit (else the campaign under-scopes).
   - **Gate-as-units:** when `done_condition` is an epic gate, seed the Epic Closure
     Gate steps as their own units — `gate:drift`, `gate:docup`, `gate:drift2`,
     `gate:decision`, `gate:checklist` (ordered; see AGENTS.md). `CLEAN-DONE` is then
     unreachable until the gate units resolve — findings-empty ≠ epic-done.
   - **Branch guard:** if `charter.branch` is the default (`main`/`master`) and a
     **write** sub-step is due, set that unit `deferred` with a one-line reason
     ("on main; switch to a work branch") — never auto-create a branch (a git op) or
     write to main hands-off (GP4 reversibility ladder).
   - Set `derive_complete`.
2. **Dispatch** the next sub-step deterministically from state:
   - active **defect** unit → `op-debug` (root-cause fix)
   - active **build** unit → implement it (delegate)
   - unit `fixed`/built, not confirmed → **verify** (`op-audit verify`, teeth) →
     `verified`, or `deferred_validation` if the real outcome needs a run beyond budget
   - all units `done`/`verified` → **re-baseline** (`op-audit run`, then ingest by
     natural key) to catch regressions — ingest **matches** existing units by `key`,
     so a re-found defect re-opens its original unit and never duplicates one that
     verify just closed. A fix that uncovers sibling occurrences appends them as new
     `open` units (key-deduped — the consistency-sweep).
3. **Run ONE sub-step** (delegates; op-watch owns no analysis).
4. **Update state atomically** — `scripts/mark.mjs --state <file> --unit <id> --status
   <status> [--notes ...]` sets the status, increments `attempts`, appends a `history`
   entry with recomputed active/resolved counts, bumps `step`, and writes via temp+rename.
   Reconcile a unit's status from the **repo**, not memory (mark from what was actually
   written). Using the script keeps the counters verdict.mjs depends on honest.
5. **Verdict** — run `scripts/verdict.mjs --state <file> [--validate "<cmd>"]`;
   echo its `VERDICT: CLEAN-DONE|CLEAN-HANDOFF|CONTINUE` line. The verdict is
   computed by the script over the state — never asserted — so a goal loop can be
   fooled neither into stopping early (false-CLEAN) nor into running forever: the
   script reads the breakers (budget, per-unit `attempts`, `history` net-progress),
   not agent prose.

## Dispatch result → unit status (WATCH-4)

Map each delegated sub-skill's completion token to a unit status deterministically —
never re-dispatch a token that means "stop":

| Sub-skill returned | Unit becomes | Note |
|---|---|---|
| `DONE` | `fixed` (→ `verified` after a teeth-verify step) | normal advance |
| `DONE_WITH_CONCERNS` | `fixed` + `notes` | carry the concern into the verify step |
| `BLOCKED` | `blocked` | handed-to-human; surfaced, never retried |
| `NEEDS_CONTEXT` | `blocked` **after 1 occurrence** | **terminal-after-1** — re-dispatching a context-starved step just loops; hand it to the user |

Increment the unit's `attempts` on each dispatch; a defect unit that op-debug fails
3× becomes `blocked` (and verdict.mjs trips the 3-strikes breaker regardless). On
resume, reconcile a unit's status from the **repo** (what was actually written), not
the stored status — a crash mid-step must not strand or double-apply (decision-memory
appends are idempotent by key; see that skill).

## Status buckets & the three outcomes

- **active** = `open` | `in_progress` | `fixed` | `built` → keep looping (`fixed`/`built`
  are await-verify: the change landed but the teeth-verify step is still pending).
- **terminal-resolved** = `verified` | `wont_fix` | `done`.
- **terminal-handed-to-human** = `blocked` | `deferred` | `deferred_validation` —
  surfaced in `### Deferred` / `### Blocked`, never silent.

verdict.mjs emits one of three (both CLEAN-* exit 0 so `goal` stops; the token +
the `done:` line say whether it actually finished):

- **CLEAN-DONE** — no active units, none handed-to-human, no unknown status, validate green.
- **CLEAN-HANDOFF** — the loop stops but the campaign is **not** done: either active
  work remains and a **breaker** tripped (budget-out · a unit hit 3 strikes ·
  no net progress over K steps), or no active work remains yet units are
  deferred/blocked/unknown or validate is red. The agenda is listed.
- **CONTINUE** — active work remains and no breaker tripped.

## The eight invariants (the step's contract — "nothing unresolved")

1. Status totality — every unit in exactly one status; the step moves active → terminal.
2. Goal predicate = "no active unit" (terminals satisfy it) — computed by verdict.mjs.
3. **3-strikes per unit** — persist `attempts`; op-debug failed 3× → set `blocked`.
   verdict.mjs **also** trips CLEAN-HANDOFF on any active unit with `attempts ≥ 3`,
   so a missed escalation cannot loop forever.
4. **Non-convergence guard** — append `history[] {step,active,resolved}` each step
   (use `mark.mjs`); verdict.mjs trips CLEAN-HANDOFF when net progress stalls over K
   steps. **Absolute backstop:** it also trips at a **step-cap** (`s.max_steps`, default
   `max(20, units×5)`) so even a productive-but-non-converging loop terminates — the
   counter is script-maintained, so this is honest independent of the model.
5. **Budget circuit-breaker** — set `budget.{total,spent}`; `spent ≥ total` →
   verdict.mjs trips CLEAN-HANDOFF (`breaker:budget-out`). Move remaining active to
   `deferred` so the handoff agenda is honest.
6. **Severity gate** — Critical/structural → `deferred` (surfaced), never auto-fixed.
7. **Verify teeth** — `verified` requires evidence cited in this step; anti-demotion.
8. **Mandatory surfaced `### Deferred` / `### Blocked`** — handed-to-human is always listed.

## Resumability contract (reentrant after crash OR stop)

State-first idempotent transition; **atomic writes**; per-unit work idempotent/reversible
with status reconciled from the repo on resume; **counters + charter persisted** (else
3-strikes resets and the loop never converges, or the WHY is lost); atomic derive (a
crashed derive must not leave a partial backlog). `goal` is the re-armable pump — it
survives compaction; across a crash/new session, re-issue `goal op-watch "<intent>"`
and op-watch resumes from the state file. Durable state = the file, not the hook. The
driver SHOULD also **cap its own re-invocations** as the outer backstop: a degenerate
spin that never calls `mark.mjs` records no step, so the in-state step-cap can't see it —
only the goal loop's invocation count can. (Two layers: step-cap for productive
non-convergence, driver cap for unproductive spin.)
Irreversible sub-steps are gated (never auto-run hands-off) so interruption never
strands a half-done destructive op.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — this step completed and the campaign verdict is `CLEAN-DONE` (print the `VERDICT:` line above it).
- `DONE_WITH_CONCERNS` — this step completed but the verdict is `CONTINUE` (more steps remain) or `CLEAN-HANDOFF` (loop stopped, not done: breaker tripped or units deferred/blocked); name the count.
- `BLOCKED` — the step cannot proceed (state unreadable, derive impossible, or a gated irreversible action needs the user).
- `NEEDS_CONTEXT` — no intent/charter and no existing campaign state to advance.
