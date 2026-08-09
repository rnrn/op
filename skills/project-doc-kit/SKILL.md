---
name: project-doc-kit
description: Generate or refresh a dated project documentation kit - onboarding, architecture decomposition, service map, sequence diagrams, API/config contracts, delivery map, debt and contradictions, plus an optional landscape DOCX album. Use when the user asks for a full project documentation snapshot, onboarding pack, doc kit, architecture decomposition, or a docs/YYYYMMDD package. Generator skill - writes only under the dated kit directory `docs/<YYYYMMDD>/`; --dry-run plans the kit without writing anything.
metadata:
  safety-class: generator
---

# Project Doc Kit

Create a complete documentation snapshot in `docs/<YYYYMMDD>/` (today's date unless the user names another). Batch documentation skill, not per-task closeout: small post-implementation doc updates -> `op-docup`; first orientation -> `op-tour`.

## Safety Contract

Writing the dated kit IS the deliverable. This skill writes ONLY under `docs/<YYYYMMDD>/` (or the alternate dated kit directory the user explicitly names) — never create, modify, or delete anything outside it, never touch unrelated untracked files, never commit unless the user explicitly asks. With `--dry-run`, plan the kit in the conversation and write nothing.

## Usage

```
/project-doc-kit [mode] [--date=YYYYMMDD] [--dry-run]
```

Modes (use the smallest that matches): `full-kit` (default), `readme-only`, `api-contracts`, `architecture-only`, `diff-refresh` (update an existing kit from a commit range), `docx-only` (build the DOCX from an existing kit). `--date=YYYYMMDD` targets a specific folder; `--dry-run` plans and writes nothing.

## Workflow

1. Preflight: read `docs/feedback/index.md`, `docs/feedback/rules-and-skills.md`, `docs/HANDBOOK.md`, `docs/task-intake.md`, `docs/docs-taxonomy.md`, `docs/subsystem-doc-contracts.md`, `docs/project-boundaries.md`, and `docs/build-profiles.md` when present.
2. Gather facts without dumping raw files into context: branch/HEAD/status; docs tree; recent history; manifests, Docker/CI/env, entrypoints; service inventory; API/CLI/config routes, schemas, migrations, storage; frontend routes; tests, ports, observability; headings of key docs.
3. For a bootstrap/readiness kit, verify the project-method scaffold before writing: `AGENTS.md`, `docs/INDEX.md`, every step-1 doc (`docs/build-profiles.md` may be an explicit `N/A` rationale for a single build/runtime surface), and `docs/feedback/{index,baseline,process}.md`; list every missing file in the kit.
4. Create `docs/<YYYYMMDD>/` and write the numbered files shown in Output (or the smaller mode set). A new reader must understand the project from zero: purpose, boundaries, subsystem map and source-of-truth files, build/runtime profiles, decomposition with code locations, data model, main flows with sequence diagrams, contracts, code map, DevOps/testing, delivery map, current debt.
5. Apply the diagram rules, contract tables, drift pass, external-source policy, and agent/proxy guardrails from `references/kit-guide.md`. Never invent components; debts, contradictions, missing proof, and unresolved risks go in `10-problems-and-contradictions.md`, not the overview.
6. Optionally run the fresh-reader validation and/or build the landscape DOCX album (`scripts/build_landscape_docx.py`) — details in `references/kit-guide.md`.
7. Validate: expected files exist; links resolve; combined markdown exists; DOCX (if requested) is landscape with diagram images when `mmdc` was available; debt section present; drift findings resolved, listed, or marked not checked; a bootstrap/readiness kit lists every missing scaffold file.

## Output

A full kit for 2026-06-10:

```
docs/20260610/
  README.md                          # kit index + fresh-reader result
  01-onboarding-and-context.md
  02-architecture-decomposition.md
  03-services-and-modules.md
  04-data-model-and-storage.md
  05-business-flows-sequence.md
  06-api-and-integration-contracts.md
  07-frontend-backend-code-map.md
  08-devops-testing-observability.md
  09-git-history-and-delivery-map.md
  10-problems-and-contradictions.md  # debt, drift, missing proof
  project-documentation-20260610-full.md        # combined (script)
  project-documentation-20260610-landscape.docx # optional album (script)
```

With `--dry-run`, report this layout plus per-file section outlines and drift findings instead of writing.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — kit written (or fully planned under `--dry-run`) and validation passed.
- `DONE_WITH_CONCERNS` — kit written but drift, missing scaffold files, or failed diagram rendering remain listed.
- `BLOCKED` — could not write the kit; state the first blocker.
- `NEEDS_CONTEXT` — ambiguous date/folder/mode; ask before writing.

## Files

- `references/kit-guide.md` — diagram rules, contract tables, drift pass, fresh-reader/DOCX details, agent/proxy guardrails.
- `scripts/build_landscape_docx.py` — combined markdown + DOCX album.
- `agents/openai.yaml` — Codex agent config; unused by Claude Code.
