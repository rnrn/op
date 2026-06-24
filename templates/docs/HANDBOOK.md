# Engineering Handbook

This file is the project operating contract. Update it before code when the operating model changes.

## Stack

State the primary implementation language and runtime up front — this is the first thing an
agent reads to orient, and the authoritative answer to "what is this project built in":

- **Language(s):** TODO (e.g. Go) — must match `AGENTS.md` Stack Profile `Language(s)`.
- **Runtime / build:** TODO (e.g. a single Go binary; `go build ./...`).
- **Adding another language** is a deliberate, **human-accepted** `### Decision` (recorded in
  `docs/decisions/`), isolated in its own dir — a spec's reference code in another language is
  illustrative, not a mandate. Default everything to the declared language.

## Method

Development follows:

1. User Spec
2. Contract
3. Owner subsystem
4. Runtime rung
5. Source of truth
6. Proof path
7. Closeout evidence

Do not substitute informal intent for these fields.

## Runtime Rungs

Define the project's runtime rungs here.

| Rung | Purpose | Validation |
|---|---|---|
| local | Developer execution | TODO |
| test | Automated validation | TODO |
| deploy | Deployed or packaged runtime | TODO |

## Source Of Truth

Document canonical owners for config, generated files, runtime state, external integrations, and operator decisions.

| Area | Source of truth | Notes |
|---|---|---|
| config | TODO | TODO |
| runtime state | TODO | TODO |
| docs | `docs/INDEX.md` | Active documentation route |
| feedback | `docs/feedback/index.md` | Preflight rule selector |

## Proof Standard

Every completed task must include:

- proof command or evidence path;
- expected result;
- actual result;
- any skipped validation with blocker rationale.

## Review Cadence

Three review levels keep docs, debt, and decisions from drifting between skill runs (gate details live in `AGENTS.md`, "Epic Closure Gate"):

| Level | When | Required |
|---|---|---|
| Story | every story | proof command + mechanical gates declared by this project |
| Epic closure | epic flips to DONE | Epic Closure Gate (ordered): `op-drift-check` → `op-docup --epic <id> --apply` → re-check until clean → `op-decision-memory` last → epic's `## Closure Checklist` |
| Background | monthly or every ~10 closed stories | `op-debt-scan` + `op-drift-check` |
