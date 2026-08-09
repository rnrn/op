---
name: op-closeout
description: Post-implementation closeout gate that verifies completion claims before a unit's status flips to done/verified/PROVEN. Use when a task or epic claims done, before marking a story verified, when a completion report needs independent verification, or when tests are green but the live system misbehaves. Every green claim needs the exact command + commit SHA + result; red is named by nodeid or declared absent; new red is classified against the base commit; timing-sensitive surfaces need a live run, not a mocked suite. Writes nothing — the closeout report goes to the conversation.
metadata:
  safety-class: checkpoint
---

# Closeout Skill

The missing second half of the gate pair: `op-preflight` blocks predictable regressions BEFORE code; this skill verifies completion claims AFTER it. Roughly half of any serious checklist is only checkable post-work (commit shape, final sizes, the red list, silent new imports) — without a first-class closeout phase, "I'll check it after" means "I won't check it".

## Safety Contract

Writes nothing — the closeout report goes to the conversation only. Running the
named proof commands (tests, validators, builds) is the point and is allowed;
mutating the repo is not: never edit files, never run `git add`, `git commit`,
`git reset`, or `git checkout` on the working tree. The one sanctioned git
operation is a TEMPORARY detached worktree for base-commit classification
(`git worktree add --detach <dir> <base>`), always removed afterwards
(`git worktree remove <dir>`); it creates no branches and touches no tracked
files in the main tree.

## Usage

```
/op-closeout                       # verify the current task's completion claims
/op-closeout <unit-ref|report>     # verify a specific unit / completion report
```

## Workflow

1. **Collect the claims.** Read the completion report, unit notes, or the conversation's "done" assertion. Enumerate every verifiable claim: "tests green", "N passed", "no regressions", "same known failures", "validator clean". Each claim gets a verdict below; a claim nobody can restate is already a finding.
2. **Demand the proof triple: exact command + commit SHA + result.** An aggregate ("2760 passed") without the command that produced it and the commit it ran on is unverifiable — score it `UNPROVEN`, and re-run the narrow command yourself at the current SHA when it is cheap. A proof you cannot re-run is a report, not a proof.
3. **Account for red by name.** Terminal rule for a passing verdict: every failing test is listed as `nodeid + cause`, or the report states "no red" and a re-run confirms it. "Same N known failures" without the list is the single most common falsehood in completion reports (field: "same 2 known failures" vs 12 measured, 6 behavioral) — never accept the phrase without the enumeration.
4. **Classify every new red against the base commit** before calling it a regression: `git worktree add --detach <tmp> <base>` → same narrow run → compare → `git worktree remove <tmp>`. Cheapest check in the whole gate and it kills false alarms (field: 3 of them, including the reviewer's own) — mandatory before the words "this change broke it" or "pre-existing".
5. **Split test-proof from live-proof.** Identify surfaces where timing matters: concurrency, event ordering, done-before-persist windows, anything where a mock replaces a slow operation (DB, network, sleep). For those, a green suite proves nothing — the mock that removes the delay removes the race window with it. Require a live-run proof (real transport, real persistence) or record the gap explicitly. Heuristic to carry: **green test + red live run → suspect the mock before the code** (then hand the debugging to `op-debug`).
6. **Re-score the preflight residue.** Every `WATCH` item the preflight left open gets a post-code verdict (`PASS`/`FAIL` with evidence — no `WATCH` at closeout). Every feedback rule applied during the work must name its enforcing mechanism (test, lint, guard); a rule with no mechanism is recorded as `declarative` — it describes the boundary and must not be counted as protecting it.
7. **Verdict.** `PROVEN` only when steps 2–6 hold; otherwise list exactly what is missing per claim. Scope discipline: this skill verifies THIS unit's claims — whole-codebase sweeps belong to `op-audit`, doc drift to `op-drift-check`.

## Output

```text
CLOSEOUT: <unit/claim ref> @ <SHA>

Claims: <n> — proven <n> · unproven <n> · false <n>
- "<claim>": PROVEN — `<command>` @ <SHA> → <result>
- "<claim>": UNPROVEN — aggregate without command/SHA; re-run: <what happened>
Red: <none | list of nodeid — cause>, base-classified: <regression n / pre-existing n>
Live-proof: <surfaces needing it, and whether it ran>
Preflight residue: <each former WATCH → PASS/FAIL>
Rules without a mechanism: <ids or none> (declarative — not guarantees)
Verdict: PROVEN | NOT PROVEN — <missing items>
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — every claim proven (verdict PROVEN); red accounted by name; live-proof covered where required.
- `DONE_WITH_CONCERNS` — verdict reached but with named exceptions (declarative rules, an accepted live-proof gap, pre-existing red); list them.
- `BLOCKED` — claims are unverifiable (no command/SHA to re-run) or proof commands cannot run here.
- `NEEDS_CONTEXT` — no completion claim or unit identified to verify; name what is needed.
