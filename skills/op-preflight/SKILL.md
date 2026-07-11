---
name: op-preflight
description: Pre-implementation gate that selects relevant project feedback rules and produces an explicit scope, invariants, risks, and validation checklist. Use before non-trivial implementation, migration, refactor, docs/workflow/skill changes, or agent behavior changes. Writes nothing by default; it may bootstrap the feedback scaffold only on explicit request.
metadata:
  safety-class: checkpoint
---

# Preflight Skill

Run before any non-trivial implementation, migration, refactor, docs/workflow/skill change, or agent behavior change. Convert project feedback into an explicit execution plan: select only the relevant rules; make scope, invariants, risks, and validation explicit; block predictable regressions before coding.

## Safety Contract

This skill writes nothing by default; the preflight report goes to the
conversation only. The single permitted write is bootstrapping the feedback
scaffold files (listed in `references/scaffold.md`), and only when the user
explicitly asks for the scaffold in the same request. Never run `git add`,
`git commit`, or `git reset` — staging and commits belong to the user or the
`baby-commit`/`dry-commit` skills.

## Usage

```
/op-preflight <task description> [path]   # gate the task; optional project root
```

## Workflow

1. **Resolve the project root** — nearest directory containing `docs/feedback`, `.git`, `AGENTS.md`, or the relevant manifest. Read `.agents/skills/op-preflight/SKILL.md`, if present, as a project addendum: stricter project rules apply unless they conflict with system/developer instructions; never replace this skill with it or copy its gates elsewhere.
2. **Load the operating contract** — `docs/HANDBOOK.md` when present; plus the project's own contract docs. The names below are **examples, not a fixed list**: first read the project instruction file (`AGENTS.md`/`CLAUDE.md`) and follow its declared pointers (Stack Profile, ownership/subsystem map, doc taxonomy, `docs/spec-systems.md`, any `docs/README.md` doc-map) to whatever files the project actually names; prefer those over these defaults. Common default names when present: `docs/task-intake.md`, `docs/subsystem-doc-contracts.md`, `docs/docs-taxonomy.md`, `docs/project-boundaries.md`, `docs/build-profiles.md`, `docs/provider-runtime-contract.md`. **An absent optional contract doc is skipped silently** — it is a gap to flag only when a gate actually requires it, never a reason to emit `DONE_WITH_CONCERNS`.
3. **Frame the required inputs** — User Spec (outcome, constraints, non-goals, success signal; `N/A - reason` only for internal cleanup), Contract, Runtime rung, Owner subsystem, Config source of truth, Scope, Invariants, Risk list, PR/security risk, Proof path. Any missing -> stop and make it concrete before coding. **Resolve every path the User Spec names against the repo BEFORE scoping** — a path that does not exist, or is a thin re-export shim (`sys.modules[__name__] = _impl`, `from x import *`, a few-line file re-exporting a real module elsewhere), is itself a finding: follow it to the real owner module and scope THAT, don't gate the shim. Mechanical gates the project declares (in `AGENTS.md`, `docs/HANDBOOK.md`, or feedback rules — e.g. build checks, file-budget ratchet, lint gates) that apply to the touched files belong in the Proof path; the gate's thresholds stay project-local. The Proof path must target the User Spec's **success signal (the outcome)**, not a stand-in: when only a **proxy** is runnable here (a local smoke vs a real-scale / remote / user-environment outcome), name what the proxy covers and the gap that remains to the real outcome — a passing proxy scores `WATCH` for that item, not `PASS`. **Stack-deviation gate:** when the change creates code files, apply the stack-deviation gate — **read `references/stack-gate.md`** (run `~/.claude/scripts/lib/stack-check.mjs`; a non-declared language is a `WATCH` + human-accepted `### Decision`; an undeclared stack turns the guard off → `WATCH` + declare first; a model drafts `status: pending` and hands off, never self-accepts).
4. **Select feedback rules** — read `docs/feedback/index.md`, then `baseline.md`. Map planned files/services/runtimes/docs/skills/agents to feedback files via the index; open only baseline plus those and apply each file's `Checklist (for preflight)`. Conflicts: index priority order, else narrowest project-local rule + `WATCH`. Workflow/skill/docs/prompt/agent tasks also load `rules-and-skills.md` and `process.md`. **Test-touching tasks** — any change to tests, fixtures, the test DB/bootstrap, the E2E harness, or that adds/relaxes assertions or skips — **must state a `Test Plan` BEFORE writing any test code**: `{language, framework, isolation, run-cmd}`. The plan's `language` is stack-checked against the declared Stack-Profile language(s) (and, under op-watch, against the campaign's frozen `test_language` state field) — a non-declared test language scores `WATCH` and is a **plan-time `### Decision`** (accept e.g. Python tests in a Go repo only with a recorded rationale + isolated dir, or write the suite in the declared language), decided *before* authoring a throwaway suite rather than caught on output. Then also load `docs/feedback/test-infra.md` (`TI1-TI10`) plus, **only if the `docs/testing/` directory exists**, `docs/testing/testing-rules.md` and `docs/testing/e2e-maintenance-guide.md`, and apply their `Checklist (for preflight)`; a test-infra violation (shared/non-isolated state, hardcoded seed IDs, fragile selectors, bare-mock-for-typed-dep, mocking owned services, weakened assertions) is a gate, not a nuance. Project-local feedback only. Never scan git history — that is `op-feedback-harvest`, on explicit request only.
5. **Handle a missing scaffold** — no `docs/feedback/index.md` -> do not claim feedback was checked; recommend (or bootstrap on explicit request) the minimal scaffold — for a new or reorganized project also the operating-contract docs including `docs/project-boundaries.md` and `docs/build-profiles.md`; requirements and file list in `references/scaffold.md`. Missing `baseline.md` only -> baseline checks `WATCH`. Small read-only/emergency task -> proceed with the input frame, feedback `WATCH`.
   - **Template-only scaffold:** `index.md` exists but routes no project-specific rule files (only `baseline.md` / template rows) -> do NOT treat feedback as checked. Mine the project's declared rule sources — `AGENTS.md`, `CLAUDE.md` (critical-rules / review-checklist sections), and equivalent agent-contract files — and apply them as ad-hoc rules for this run, citing the source file per rule. Mark feedback selection `WATCH` and recommend `op-feedback-harvest --apply` to promote those rules into `docs/feedback` so the gap closes after one run. Declared-source mining is not history scanning — the git-history prohibition stands; a green gate fed only by universal baseline rules gates nothing.
6. **Apply the PR/security risk gate** — classify `LOW` (no new authority), `MEDIUM` (runtime behavior, file writes, network calls, generated artifacts, command execution, client config), or `HIGH` (secrets, auth, deploy, CI, container privileges, proxy routing, dependency install, public API) — full criteria and required checks in `references/risk-gate.md`; apply them for MEDIUM/HIGH. `HIGH` without proof or owner -> `FAIL`.
7. **Score and report** — pre-implementation items: `PASS`/`WATCH`/`FAIL`/`N/A`; post-implementation re-runs: `PASS`/`FAIL`/`N/A` with evidence. `WATCH` only for risks the validation path covers; `FAIL` when implementation must not start.

## Output

Conversation report shape (one concrete example, abridged):

```text
PREFLIGHT: add rate limiting to API endpoints

Scope: server/routes/, server/middleware/ratelimit.go, tests
User Spec: cap per-client request rates; success = 429 on excess
Contract: provider config + CLI UX | Runtime rung: server deploy
Owner subsystem: server/middleware | Config source of truth: config/server.yaml
Invariants: authenticated routes keep current latency budget
Risk list: shared limiter state; clock skew in tests
PR/security risk: MEDIUM -- no secrets in examples; non-destructive defaults
Proof path: go test ./server/middleware/...; smoke: burst returns 429
Loaded feedback: docs/feedback/{index,baseline,server-runtime}.md
Checklist: P1 scope explicit: PASS; B2 baseline known: WATCH; (...)
Result: CLEAR -- proceed, but verify WATCH items after coding.
```

Verdicts: only `PASS`/`N/A` -> `CLEAR -- proceed with implementation.`; any `WATCH` without `FAIL` -> `CLEAR -- proceed, but verify WATCH items after coding.`; any `FAIL` -> stop and list required fixes; missing required feedback rule or unresolved contradiction -> `BLOCKED -- update docs/feedback first.` Never code on `FAIL`/`BLOCKED`.

Protocol (non-negotiable, exact strings): the report MUST contain a line of the exact shape `PR/security risk: LOW`, `PR/security risk: MEDIUM`, or `PR/security risk: HIGH` (justification may follow on the same line after ` -- `). The `Result:` verdict MUST be exactly one of the four verdict strings above — never invented wording such as "conditional pass" or "ready for approval".

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — preflight completed with a CLEAR verdict.
- `DONE_WITH_CONCERNS` — CLEAR with WATCH items to verify after coding.
- `BLOCKED` — verdict is FAIL or BLOCKED; implementation must not start.
- `NEEDS_CONTEXT` — a required input (scope, invariants, proof path, root) is missing.
