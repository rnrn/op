---
name: op-debug
description: Root-cause-first debugging — reproduce a failure, trace the bad value back to its source, fix at the source (not the symptom), and sweep the codebase for the same bug pattern. Use when something is broken, a test or run fails, behavior is wrong, or you are about to patch a symptom. Stops after 3 failed fixes and escalates as an architecture problem. Default mode investigates and proposes the single fix; writing it requires --apply.
metadata:
  safety-class: checkpoint
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Debug Skill

Find why something is broken **before** changing anything, fix it **at the
source**, and make sure the same class of bug is not hiding elsewhere. The
analysis and the single proposed fix land in the conversation first; real edits
are written only on explicit `--apply`.

## Safety Contract

Default mode is investigation only — it reads, reproduces, and proposes one fix;
it writes nothing. The fix is written only when the user passes `--apply` in the
same request. Write files only — never run `git add`, `git commit`, or
`git reset` (staging/commits belong to the user or `baby-commit`/`dry-commit`).
Probes/repros go in a gitignored `tmp/`, cleaned up after.

## Usage

```
/op-debug <failure description or error>          # investigate + propose one fix
/op-debug <failure description> --apply           # also write the single fix
```

## Iron law

**No fix without a root cause first.** A symptom patch is a failure, not a fix.
Banned reflexes: `try/except: pass` to hide the raise, `.get(key, <default>)` to
paper over a missing value, `sleep(N)` for a timing bug, broadening a type to
dodge an error. Crash loud beats corrupt silently — if the real value is missing,
let it raise and trace WHY it is missing.

## Workflow

1. **Reproduce** — get the exact error and a minimal repro command. If you cannot
   reproduce it, say so and stop (`NEEDS_CONTEXT`/`BLOCKED`) — do not guess-fix.
2. **Trace backward to the source** — follow the bad value from the symptom
   *upstream* to where it was first produced (the wrong assignment, the unhandled
   branch, the bad input). Fix where it originates, not where it surfaces.
3. **Pattern-match** — compare the broken path against a *working* sibling in the
   same codebase ("how does the path that works differ?"). The diff usually is the
   bug.
4. **One hypothesis** — write it as `I think <X> because <Y>` (a falsifiable
   claim citing the traced evidence). One hypothesis, not a list.
5. **One fix at the source** — the smallest change that addresses the root cause.
   On `--apply`, write it; otherwise propose it with the exact `file:line`.
6. **Anti-whack-a-mole sweep** — name the bug's *pattern* in one sentence, then
   `grep` the repo for the same shape. Fix trivial matches in the **same** change;
   file the rest as follow-ups. (Stops the reviewer finding the same class four
   more times.)
7. **Bounded validation** — add a check one or two layers past the fix (not
   scattered everywhere) and re-run the repro to confirm the failure is gone for
   the right reason.

## Three-strikes circuit-breaker

Count fix attempts for the same failure. **After 3 failed fixes, STOP.** This is
no longer a hypothesis problem — it is an architecture problem. Do not try a 4th
patch: summarize the 3 attempts and what each ruled out, name the structural issue
you now suspect, and hand back to the user (`BLOCKED`). Thrashing past three is the
failure mode this gate exists to prevent.

## Output

A debug report in the conversation (and the applied fix under `--apply`):

```text
DEBUG: <failure>
Repro: <command> -> <exact error>
Root cause: <the source — file:line — and why the value/branch is wrong>
Fix: <the single source change — file:line>
Pattern: "<one-sentence bug shape>"  ->  grep found N more: <paths> (fixed M, follow-up K)
Validation: <check added + repro re-run result>
```

Quality bar: a named reproduction; the root cause traced to a source `file:line`
(not the symptom site); exactly one fix; the pattern grep run with its result; the
attempt count visible if >1.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — root cause found and the fix proposed (or applied under `--apply`), pattern swept, repro re-checked.
- `DONE_WITH_CONCERNS` — fix found but pattern matches remain unfixed or validation is partial; list them.
- `BLOCKED` — cannot reproduce, or the 3-strikes gate hit (architecture problem; needs the user).
- `NEEDS_CONTEXT` — the failure or its reproduction cannot be identified from the request.
