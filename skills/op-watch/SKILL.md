---
name: op-watch
description: Drive a remediation or build campaign to done under a `goal` loop — one bounded step per call (read state, dispatch the sub-step, update state, emit a deterministic verdict). Use when working a backlog or audit ledger to done autonomously (`goal op-watch "<intent>"`), or to advance a campaign one step. Thin dispatcher; delegates to op-audit/op-debug/op-planner.
metadata:
  safety-class: checkpoint
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Skill
---

# Watch Skill

Drive a campaign (remediation = fix a ledger; build = ship a backlog) to done **one bounded step
per invocation**, so a `goal` loop pumps it hands-off. Thin dispatcher: pick+run the right sub-step,
persist durable state, compute an honest verdict. Loop control lives in `goal`; honesty lives in the
deterministic scripts. **Full contract — the 8 invariants, resumability, gate/test-language internals
and the "why": read `protocol.md` in this skill dir** when a derive/verdict/gate edge case is
non-obvious (the scripts enforce the hard parts regardless).

## Safety Contract
Writes only the campaign state (`docs/.work/<slug>.json`); delegates real changes to sub-skills
(which keep their own `--apply` gates). Never runs `git add/commit/reset`. Obeys the AGENTS.md
autonomy boundary; **never auto-fixes Critical/structural units** — those defer to the user.

## Usage
```
goal op-watch "<intent>"   # goal pumps op-watch until CLEAN
op-watch "<intent>"        # one step (creates/advances), then verdict
op-watch --state docs/.work/<slug>.json   # advance an existing campaign one step
```
`<intent>` = the **charter** (the WHY), stored in state — not the termination test. Termination is
the verdict over state. `goal op-watch "ledger clean"` is the remediation special case.

## One step (every invocation)
1. **Read state** `docs/.work/<slug>.json`. Absent → **derive** (atomic — a crashed derive leaves no partial backlog):
   - Freeze a **`charter`** `{intent, done_condition, anchor, spec_system, branch, test_language}`.
     **Set `done_condition` deterministically — never leave it unset:** a **build** charter →
     `epic-closure-gate` when AGENTS.md/HANDBOOK define an Epic Closure Gate (then SEED the gate units
     below), else `units-verified`; a **remediation** charter → `ledger-clean`. `test_language` = the
     project's primary declared Stack-Profile language, fixed up front (stops per-story language drift
     — see protocol.md). Subsequent steps READ the charter, never rewrite it.
   - **Decompose by charter stance** (op-audit: discovery seeds, scoped serves): remediation
     (`ledger-clean`) seeds from `op-audit run` (scope **project**); build uses `op-planner` +
     `op-audit run --spec` (audit the plan) + per-unit preflight. **Never run discovery for a build
     charter** (re-importing project-wide findings is the distraction the charter prevents).
     **Write state with a script:** `scripts/init.mjs --state <file> --charter "<intent>" --units
     <units.json>` (dedups ids, atomic). For remediation, ingest first: `scripts/ingest.mjs --state
     <file> --findings <ledger.json> --write` (natural-key dedup). Coverage: every part of the intent maps to a unit.
   - **Gate-as-units:** when `done_condition` is `epic-closure-gate`, seed `gate:drift, gate:docup,
     gate:drift2, gate:decision, gate:checklist` (ordered) — CLEAN-DONE is unreachable until they
     resolve (findings-empty ≠ epic-done).
   - **Branch guard:** on `main`/`master` with a write due → set the unit `deferred` ("switch to a
     work branch"); never auto-create a branch (GP4). Set `derive_complete`.
2. **Dispatch** the next sub-step deterministically from state. **Priority: a `built`/`fixed` unit
   awaiting verify is dispatched (verified) BEFORE starting a new build** — verify-as-you-go keeps
   `resolved` rising and avoids accumulating unverified work (which otherwise stalls the loop).
   - active **defect** → `op-debug` (root-cause fix).
   - active **build** → **`op-preflight` scoped to the unit first** (loads `docs/feedback` incl.
     `test-infra.md`; a preflight `FAIL` defers the unit — don't implement past a red gate), then
     implement (delegate). **Test-touching unit: preflight produces a `Test Plan {language,
     framework, isolation, run-cmd}` BEFORE any code**; the planned language is stack-checked vs
     `charter.test_language` — a non-declared test language is a plan-time Decision (defer + draft an
     ADR), decided before writing the suite, never self-accepted (protocol.md).
   - unit `fixed`/`built`, unconfirmed → **verify, deterministic-first:**
     1) **acceptance gate (always):** `scripts/accept.mjs --state <file> --root <repo> [--declared
        <langs>] --scan --min-bytes 40 --decisions docs/decisions/decisions.yaml --fix` — output
        control on real artifacts: missing claimed files → `in_progress` (false-done); non-declared
        stack file → `deferred` + drafted `pending` ADR. `--scan` catches deviations omitted from
        `files[]`; `--min-bytes` catches hollow stubs; an `accepted` stack ADR is honored. Add
        `--build "<cmd>"` at epic closure. (Full gate semantics: protocol.md.)
     2) **scoped semantic audit** for a HIGH-risk unit or at closure: `op-audit verify --scope
        charter --paths <unit diff>` — a real finding blocks `verified`. Else `deferred_validation`
        if the real outcome needs a run beyond budget.
   - all units `done`/`verified` → **re-baseline** (`op-audit run`, then ingest by natural key) to
     catch regressions — a re-found defect re-opens its original unit; siblings append as new `open`.
3. **Run ONE sub-step** (delegates; op-watch owns no analysis).
4. **Update state via scripts — never hand-edit the JSON.** `scripts/mark.mjs --state <file> --unit
   <id> --status <status> [--notes ...]` sets the status, increments `attempts`, appends a `history`
   entry with recomputed active/resolved counts, bumps `step`, writes via temp+rename. Reconcile a
   unit's status from the **repo**, not memory. Then **gate the ledger:** `scripts/validate-state.mjs
   --state <file> --fix` (repairs a duplicate unit id, rejects unparseable state).
5. **Verdict** — `scripts/verdict.mjs --state <file> [--validate "<cmd>"]`; echo its
   `VERDICT: CLEAN-DONE|CLEAN-HANDOFF|CONTINUE` line. Computed over state, never asserted — a goal
   loop can be fooled neither into stopping early nor running forever (the script reads the breakers).

## Dispatch result → unit status (WATCH-4)
Map each delegated sub-skill's completion token to a unit status deterministically — never
re-dispatch a token that means "stop":

| Sub-skill returned | Unit becomes | Note |
|---|---|---|
| `DONE` | `fixed` (→ `verified` after a teeth-verify step) | normal advance |
| `DONE_WITH_CONCERNS` | `fixed` + `notes` | carry the concern into the verify step |
| `BLOCKED` | `blocked` | handed-to-human; surfaced, never retried |
| `NEEDS_CONTEXT` | `blocked` **after 1 occurrence** | terminal-after-1; hand it to the user |

Increment `attempts` on each dispatch; a defect unit that op-debug fails 3× → `blocked`. On resume,
reconcile a unit's status from the **repo** (what was actually written), not the stored status.

## Status buckets & the three outcomes
- **active** = `open|in_progress|fixed|built` (`fixed`/`built` = await-verify) → keep looping.
- **terminal-resolved** = `verified|wont_fix|done`. **terminal-handed-to-human** =
  `blocked|deferred|deferred_validation` — surfaced in `### Deferred`/`### Blocked`, never silent.
- **CLEAN-DONE** — no active units, none handed-to-human, no unknown status, validate green.
- **CLEAN-HANDOFF** — loop stops but NOT done: active work remains and a breaker tripped, OR only
  deferred/blocked/unknown remain (or validate red). The agenda is listed.
- **CONTINUE** — active work remains and no breaker tripped.

Breakers (read by `verdict.mjs` from state, script-maintained — not agent prose): budget-out ·
3-strikes · no-progress over K · step-cap · dup-ids · open gate (`gate_build`/`gate_stack_undeclared`).
Both CLEAN-* exit 0 so `goal` stops; the token + `done:` line say whether it finished. Details: protocol.md.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — this step completed and the campaign verdict is `CLEAN-DONE` (print the `VERDICT:` line above it).
- `DONE_WITH_CONCERNS` — this step completed but the verdict is `CONTINUE` (more steps remain) or `CLEAN-HANDOFF` (loop stopped, not done: breaker tripped or units deferred/blocked); name the count.
- `BLOCKED` — the step cannot proceed (state unreadable, derive impossible, or a gated irreversible action needs the user).
- `NEEDS_CONTEXT` — no intent/charter and no existing campaign state to advance.
