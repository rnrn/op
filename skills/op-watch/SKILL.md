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
   charter). Absent → **derive**: write the charter from `<intent>`, decompose it
   into units (delegate: `op-audit run`/`run --spec` for remediation, `op-planner`
   for build) with acceptance criteria, set `derive_complete`. *Coverage check:*
   every part of the intent maps to a unit (else the campaign under-scopes).
2. **Dispatch** the next sub-step deterministically from state:
   - active **defect** unit → `op-debug` (root-cause fix)
   - active **build** unit → implement it (delegate)
   - unit `fixed`/built, not confirmed → **verify** (`op-audit verify`, teeth) →
     `verified`, or `deferred_validation` if the real outcome needs a run beyond budget
   - all units `done`/`verified` → **re-baseline** (`op-audit run`) to catch regressions
3. **Run ONE sub-step** (delegates; op-watch owns no analysis).
4. **Update state atomically** (temp+rename); reconcile a unit's status from the
   **repo**, not memory (mark-done from what was actually written).
5. **Verdict** — run `scripts/verdict.mjs --state <file> [--validate "<cmd>"]`;
   echo its `VERDICT: CLEAN|CONTINUE` line. The verdict is computed by the script
   over the state — never asserted — so a goal loop cannot be fooled into stopping early.

## Status buckets & CLEAN

- **active** = `open` | `in_progress` → keep looping.
- **terminal-resolved** = `verified` | `wont_fix` | `done`.
- **terminal-handed-to-human** = `blocked` | `deferred` | `deferred_validation` —
  surfaced in `### Deferred` / `### Blocked`, never silent.
- **CLEAN = no active units** (and `--validate` green); handed-to-human units may
  remain and are listed. `goal` stops on CLEAN.

## The eight invariants (the step's contract — "nothing unresolved")

1. Status totality — every unit in exactly one status; the step moves active → terminal.
2. Goal predicate = "no active unit" (terminals satisfy it) — computed by verdict.mjs.
3. **3-strikes per unit** → `blocked` (op-debug failed 3× → escalate; don't loop).
4. **Non-convergence guard** — track net progress; no improvement over K steps, or
   self-introduced units unbounded → stop+surface. Allow *bounded* decomposition splits.
5. **Budget circuit-breaker** — `budget.spent ≥ budget.total` → move remaining active to
   `deferred`, verdict `budget-out`.
6. **Severity gate** — Critical/structural → `deferred` (surfaced), never auto-fixed.
7. **Verify teeth** — `verified` requires evidence cited in this step; anti-demotion.
8. **Mandatory surfaced `### Deferred` / `### Blocked`** — handed-to-human is always listed.

## Resumability contract (reentrant after crash OR stop)

State-first idempotent transition; **atomic writes**; per-unit work idempotent/reversible
with status reconciled from the repo on resume; **counters + charter persisted** (else
3-strikes resets and the loop never converges, or the WHY is lost); atomic derive (a
crashed derive must not leave a partial backlog). `goal` is the re-armable pump — it
survives compaction; across a crash/new session, re-issue `goal op-watch "<intent>"`
and op-watch resumes from the state file. Durable state = the file, not the hook.
Irreversible sub-steps are gated (never auto-run hands-off) so interruption never
strands a half-done destructive op.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — this step completed and the campaign verdict is CLEAN (print the `VERDICT:` line above it).
- `DONE_WITH_CONCERNS` — this step completed but the campaign verdict is CONTINUE (more steps remain) or units are deferred/blocked; name the count.
- `BLOCKED` — the step cannot proceed (state unreadable, derive impossible, or a gated irreversible action needs the user).
- `NEEDS_CONTEXT` — no intent/charter and no existing campaign state to advance.
