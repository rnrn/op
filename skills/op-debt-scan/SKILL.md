---
name: op-debt-scan
description: Scan the codebase for technical debt — TODO/FIXME markers, oversized files, missing tests, dependency health, and architecture drift — and rank findings by an ROI priority score. Use when the user asks to find tech debt, audit code health, list TODOs and FIXMEs, or decide which debt to fix first. Read-only.
allowed-tools: Read, Grep, Glob, Bash(wc:*), Bash(git log:*)
metadata:
  safety-class: read-only
---

# Debt Scan Skill

Scan the codebase for technical debt indicators — code markers, file complexity, test coverage gaps, architecture drift, and dependency health — then rank findings by ROI and architecture impact so remediation effort goes where it pays off.

## Read-Only Contract

This skill never creates, modifies, or deletes files. The report goes to the
conversation only.

## Usage

```
/op-debt-scan
/op-debt-scan --severity MEDIUM
/op-debt-scan --create-stories
```

| Argument | Meaning |
|----------|---------|
| `--severity <level>` | Only show findings at or above the level: HIGH shows only HIGH; MEDIUM shows MEDIUM + HIGH; LOW shows all |
| `--create-stories` | Group related findings (3-5 debt items each) into BMAD stories. Writing the stories is delegated to the `op-planner` skill, which is checkpoint-gated; op-debt-scan itself never writes files |

## Workflow

1. **Scan for code markers:** grep for `TODO`, `FIXME`, `HACK`, `XXX`, `WORKAROUND` comments; count and categorize by severity and location. Treat `delete_me`/`deleteme`/`fill-this`/`fixme-later` stubs as a **stronger** sub-class than a plain `TODO`.
   - **Suspicious-artifacts pass (highest-value, often the real finding):** flag tracked files that look like leaked state even though they carry no marker — a stray `nul`/`con` redirect artifact, `*.dump`, a large tracked JSON, or any file containing `system_prompt`/`secret`/`api_key`/private-key material. These score **HIGH** (potential secret/PII leak) and belong in the report regardless of the marker grep. (Only a name *containing* `bypass`/`insecure` that resolves to a defined safe boolean default is NOT a finding — don't flag legit feature flags.)
2. **Check file complexity:** files > 500 lines (consider splitting), functions > 100 lines (consider refactoring), deeply nested code. These numbers are language-relative defaults — when the project declares its own **numeric** budgets (file-budget baseline, `AGENTS.md` Stack Profile, or `docs/HANDBOOK.md`), the declared values replace them. A Stack Profile / HANDBOOK that declares **no number** does NOT override the defaults — the 500/1000 defaults stand; don't over-search to confirm the negative.
3. **Find test coverage gaps:** source files without corresponding test files, thin test directories, critical paths without tests. **Test-lookup order (apply consistently):** (a) a `test_<basename>` / `<basename>.test` / `<basename>_test` file **anywhere** under a `tests/`|`test/`|`__tests__/` tree — not just the source's own dir — else (b) the `<basename>` symbol referenced from any test file, else (c) genuinely missing. Basename-in-same-dir alone flips many files falsely.
4. **Check architecture drift as debt** (if `docs/**/architecture.md` exists):
   - Undocumented features = documentation debt
   - Duplicate command surfaces, hidden wrappers, or two active docs paths for one user task = architecture debt
   - Missing owner subsystem, runtime rung, source of truth, or proof path in active epics/stories = planning debt
   - Hardcoded provider/client names where a registry or probe exists = integration debt
   - Documented but unimplemented features = implementation debt
5. **Check project-method debt:** missing User Spec, missing proof, stale legacy docs, duplicate config sources, unowned subsystem boundaries.
6. **Check dependency health from manifests/lockfiles only:** read `requirements.txt`/`pyproject.toml`/`poetry.lock`/`package.json`/`package-lock.json`/`go.mod` etc. and note pinned-but-stale majors, deprecated packages, and unused declarations. **Do NOT run `pip`/`npm outdated`** — this skill's `allowed-tools` grant only `Bash(wc)` and `Bash(git log)`, so a live registry query is unexecutable as shipped; report staleness from the lockfile contents, not a live check.
7. **Read the project's budget baseline as seeded debt** (when one exists): look for `scripts/file-budget-baseline.json` or a baseline path declared in `docs/feedback` or `AGENTS.md`. Each entry is a known-oversized file frozen at a recorded size with ratchet semantics:
   - file grew past its frozen size = ratchet violation -> MEDIUM finding (HIGH if it also crosses the project's hard gate);
   - file shrank = report as shrink progress, not a finding;
   - baseline entry raised without a decomposition note = new debt, not noise.
   The size limits themselves are project-local; this skill only honors the convention.
8. **Score and rank** MEDIUM/HIGH findings (see below), classify, sort, and generate the report.
9. With `--create-stories`, hand grouped findings to `op-planner` (priority = highest severity in the group).

### Severity Classification

| Severity | Criteria |
|----------|----------|
| HIGH | Security issues, FIXME in critical paths, files > 1000 lines |
| MEDIUM | TODO in business logic, missing tests for handlers, files > 500 lines |
| LOW | Style TODOs, missing tests for utilities, minor refactoring |

Size criteria use the project-declared budgets when they exist (see step 2); the table shows the defaults.

### ROI / Architecture Impact Ranking

Do not treat all TODOs or missing tests equally. For each MEDIUM or HIGH finding, include:

| Field | Meaning |
|---|---|
| `user-impact` | 1-5: how directly it affects user/operator success |
| `failure-likelihood` | 1-5: how likely it is to break again |
| `effort` | 1-5: estimated implementation cost, where 1 is easy and 5 is expensive |
| `architecture-impact` | 1-5: whether it clarifies boundaries, source of truth, runtime safety, or protocol correctness |
| `unblock-value` | 1-5: whether fixing it unlocks other work |
| `priority-score` | `(user-impact + failure-likelihood + architecture-impact + unblock-value) - effort` |

**Anchor each 1–5 axis so two operators converge** (scores are otherwise unreproducible):
- `user-impact`: 1 = internal-only cleanup · 3 = degrades a non-critical path · 5 = breaks a core user/operator flow or leaks data.
- `failure-likelihood`: 1 = stable/isolated · 3 = changes occasionally · 5 = hot path, already broke or has no test.
- `effort`: 1 = <20 lines / 1 file · 3 = one-module refactor · 5 = cross-cutting, many call sites.
- `architecture-impact`: 1 = local · 3 = clarifies one boundary/source-of-truth · 5 = fixes a protocol/runtime-safety invariant.
- `unblock-value`: 1 = unblocks nothing · 3 = unblocks one queued item · 5 = unblocks an epic/several tasks.

Sort by `priority-score` — **the HIGH/MEDIUM/LOW label is descriptive, not the sort key**, so a 1200-line HIGH can legitimately rank below a well-scored MEDIUM. On ties prioritize security, source-of-truth cleanup, and repeat incident classes. Mark noisy/low-value findings as backlog only.

Protocol (non-negotiable, exact format): every MEDIUM and HIGH finding MUST carry a literal line of the shape `priority-score: N (user-impact=A, failure-likelihood=B, effort=C, architecture-impact=D, unblock-value=E)` where `N = (A+B+D+E)-C`. Severity ranking alone is NOT a substitute for this field.

## Output

```
## Technical Debt Report

### Summary
- Total findings: 6
- High: 2 | Medium: 2 | Low: 2
- Top priority-score: 14

### HIGH Severity
1. [code-marker] FIXME in auth/handler.go:45 - "temporary bypass for admin check"
   - priority-score: 14 (user-impact=5, failure-likelihood=4, effort=2, architecture-impact=4, unblock-value=3)

### MEDIUM Severity
1. [missing-test] internal/api/users.go has no test file
2. [budget-ratchet] src/dashboard/map.js grew past its frozen baseline (2669 -> 2741 lines, no decomposition note)

### LOW Severity
1. [style] utils/format.go:12 - "TODO: use constants"
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — scan completed and report generated.
- `DONE_WITH_CONCERNS` — scan completed but parts were skipped (e.g. no lock files, no architecture docs); list them.
- `BLOCKED` — codebase unreadable or empty.
- `NEEDS_CONTEXT` — invalid `--severity` value or ambiguous scan root.
