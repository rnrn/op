# Changelog

All notable changes to the crateon-bundle skills are documented here, one
line per skill per release, so an updater can decide replace-vs-merge
without diffing. The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- `op-preflight` — template-only scaffold handling: when `docs/feedback/index.md` routes no project-specific rules, mine declared rule sources (`AGENTS.md`, `CLAUDE.md` critical rules) as ad-hoc rules and push toward `op-feedback-harvest --apply` (merge-safe: one workflow bullet).
- `op-feedback-harvest` — declared agent-contract rules (AGENTS.md, CLAUDE.md critical rules, CHANGELOG lessons) are first-class harvest candidates alongside commits (merge-safe).
- `INSTALL.md` — shadow-check one-liner for stale pre-`op-*` copies; migration table from pre-`op-*` names; layout-change/pycache update guidance; template-only feedback window note; new "Adapting to your stack" section (declare conventions, never edit skill copies).
- De-bias pass (all merge-safe one-liners; protocol contracts untouched): `op-drift-check` manifest list opened (Maven/.NET/Composer/...) + archetype claim surfaces; `op-debt-scan` size thresholds marked as project-overridable defaults; `op-tour` archetype list extended (GUI/ML/embedded/game) + open manifest set; `op-planner` layer rule generalized + track examples marked illustrative; `op-docup` track examples marked illustrative; `op-story-finder` follows declared docs layout, "no story docs" = DONE not BLOCKED; `baby-commit`/`dry-commit` 300 lines = default, project budget overrides; `op-feedback-harvest` file mapping marked illustrative; `upstream-harvest` tests in upstream's language + archetype categories; `project-doc-kit` archetype contract tables + graceful DOCX skip; `agents/test-runner.md` rule zero (declared test command wins; go/cargo/dotnet/mvn added; local non-Docker fallback).
- `templates/AGENTS.md` — new Stack Profile section (declared language/archetype/commands/layout/budgets that skills read before defaults); `templates/docs/feedback/baseline.md` — archetype-mapping note.
- Decouple from TaskMaster: `op-tour` and `op-planner` no longer hardcode `.taskmaster/`. Sprint/board update is now optional — only when the project already tracks such a file (path declared in AGENTS.md/HANDBOOK); the bundle neither owns nor scaffolds it. `.taskmaster/sprints/...` remains only as a parenthetical example (merge-safe).

## [0.2.1] - 2026-06-12

### Changed
- ALL 16 skills — completion-status protocol hardened: the last line must start with an exact status token; imperative wording. Replace-safe everywhere.
- `op-preflight` — exact-string protocol for `PR/security risk:` line and the four verdict strings; project-declared mechanical gates belong in the Proof path. **Replace, don't merge.**
- `op-debt-scan` — literal `priority-score: N (...)` format required per MEDIUM/HIGH finding; file-budget baseline read as seeded debt with ratchet semantics. **Replace, don't merge.**
- `op-drift-check` — CURRENT/TARGET doc-marking convention; `Known Drift (audited <date>)` stamp; dead-public-surface check. **Replace, don't merge.**
- `op-docup` — epic-closure mode `--epic=<id>`; restore-or-delete rule for vanished documented features. **Replace, don't merge.**
- `op-planner` — closure-checklist injection into materialized epics when the project ships a template. Replace-safe.
- `op-decision-memory` — Epic Closure Gate named as a standard trigger. Replace-safe.
- `templates/AGENTS.md`, `templates/docs/HANDBOOK.md` — new Epic Closure Gate and Review Cadence sections (scaffold templates; merge into existing projects manually).
- `graphify-loop` — internal layout moved scripts into `scripts/`. **Replace the folder wholesale.**

### Added
- `search-adapter`, `service-checker` skills.
- `scripts/eval/` — discovery A/B harness and op-cycle lifecycle harness (repo-only, not published to hosts).

## [0.2.0] - 2026-06-10

### Changed
- Skill standard rework: `op-*` renames (`planner` -> `op-planner`, `memory` -> `op-decision-memory`, ...), checkpoint-first safety contracts (`--apply` gates), trigger-phrase descriptions, `allowed-tools`/`safety-class` frontmatter, heavy bodies trimmed into `references/`. **Replace all pre-`op-*` copies.**
