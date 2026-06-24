# op-watch — full contract (read when a derive/verdict/gate edge case is non-obvious)

The router (`SKILL.md`) carries every command + the step sequence. This file carries the *why*
and the exhaustive contract. The deterministic scripts (`verdict.mjs`, `accept.mjs`, `mark.mjs`,
`validate-state.mjs`, `init.mjs`, `ingest.mjs`) enforce the hard parts independent of the model.

## The eight invariants (the step's contract — "nothing unresolved")

1. **Status totality** — every unit in exactly one status; the step moves active → terminal.
2. **Goal predicate** = "no active unit" (terminals satisfy it) — computed by `verdict.mjs`.
3. **3-strikes per unit** — persist `attempts`; op-debug failed 3× → set `blocked`. `verdict.mjs`
   **also** trips CLEAN-HANDOFF on any active unit with `attempts ≥ 3`, so a missed escalation
   cannot loop forever.
4. **Non-convergence guard** — append `history[] {step,active,resolved}` each step (via `mark.mjs`);
   `verdict.mjs` trips CLEAN-HANDOFF when net progress stalls over K steps. **Absolute backstop:**
   it also trips at a **step-cap** (`s.max_steps`, default `max(20, units×5)`) so even a
   productive-but-non-converging loop terminates — the counter is script-maintained, honest
   independent of the model.
5. **Budget circuit-breaker** — set `budget.{total,spent}`; `spent ≥ total` → CLEAN-HANDOFF
   (`breaker:budget-out`). Move remaining active to `deferred` so the handoff agenda is honest.
6. **Severity gate** — Critical/structural → `deferred` (surfaced), never auto-fixed.
7. **Verify teeth** — `verified` requires evidence cited in this step; anti-demotion.
8. **Mandatory surfaced `### Deferred` / `### Blocked`** — handed-to-human is always listed.

## Acceptance-gate semantics (`accept.mjs`, verify step 1)

OUTPUT control over the real artifacts, INDEPENDENT of the model's self-report:
- a resolved unit whose claimed `files` are missing → `in_progress` (false-done caught);
- a file outside the declared stack → `deferred` pending a Decision (stack deviation caught).
- `--scan` walks the directories the resolved units actually wrote into and stack-checks **every**
  code file there (incl. gitignored siblings), so a deviation **omitted from `files[]`** is still
  caught — the manifest is only as honest as the model.
- `--min-bytes 40` flags a claimed file that exists but is a hollow stub (existence ≠ substance).
- `--decisions docs/decisions/decisions.yaml` makes a stack deviation carry a **drafted `status:
  pending` ADR** (idempotent per unit) so the handoff is a ready decision record, not just a note;
  op-decision-memory remains the canonical writer that flips it to `accepted`/rejected. **A deviation
  whose files are covered by an `accepted` stack ADR is honored (passes)** — closes the loop so a
  deliberately recorded second language (e.g. Python integration tests beside Go, isolated + opt-in)
  can reach CLEAN-DONE; a `pending`/undecided deviation still demotes. If `--declared` is omitted the
  gate auto-detects the stack from manifests; an undeclared stack with code present sets
  `gate_stack_undeclared` (blocks CLEAN-DONE) rather than silently passing.
- `--build "<cmd>"` adds a compile-level functional gate at epic closure; a failing build records
  `gate_build` (verdict blocks CLEAN-DONE until a passing re-build clears it).

## Test language decided up front (derive + the test-plan preflight)

`charter.test_language` is frozen at derive = the project's primary declared Stack-Profile language
(or, if the spec's reference tests use another language and a `### Decision` already allows it, that).
Freezing it stops a per-story drift where the model silently improvises the test language at
implementation time (the Python-tests-in-a-Go-repo trap). If the declared stack is empty, leave it
null and the gate falls back to the `--declared` arg / manifest auto-detect.

For a test-touching build unit, op-preflight must produce a `Test Plan {language, framework,
isolation, run-cmd}` **before any code**; the planned language is stack-checked vs
`charter.test_language`. A non-declared test language is a **plan-time Decision** (defer the unit +
draft a `pending` ADR via `accept.mjs --decisions`), decided *before* authoring a throwaway suite —
the proactive twin of the output gate. A model never self-accepts its own deviation; it drafts
`pending` and hands off for human acceptance.

## Resumability contract (reentrant after crash OR stop)

State-first idempotent transition; **atomic writes**; per-unit work idempotent/reversible with status
reconciled from the repo on resume; **counters + charter persisted** (else 3-strikes resets and the
loop never converges, or the WHY is lost); atomic derive (a crashed derive must not leave a partial
backlog). `goal` is the re-armable pump — it survives compaction; across a crash/new session,
re-issue `goal op-watch "<intent>"` and op-watch resumes from the state file. Durable state = the
file, not the hook. The driver SHOULD also **cap its own re-invocations** as the outer backstop: a
degenerate spin that never calls `mark.mjs` records no step, so the in-state step-cap can't see it —
only the goal loop's invocation count can. (Two layers: step-cap for productive non-convergence,
driver cap for unproductive spin.) Irreversible sub-steps are gated (never auto-run hands-off) so
interruption never strands a half-done destructive op.
