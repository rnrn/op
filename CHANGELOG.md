# Changelog

All notable changes to the crateon-bundle skills are documented here, one
line per skill per release, so an updater can decide replace-vs-merge
without diffing. The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.3.0] - 2026-06-18

### Added
- `op-audit` skill — full-codebase audit that writes a report plus a durable `docs/audit/audit-findings.json` ledger with content-addressed finding ids and status preservation across re-runs. Registered in the `operational-development-cycle` marketplace plugin and shipped to dist.
- Stage-replay verification harness (`scripts/eval/run-stage-replay.mjs`, `replay-stages.json`, `score-stage-replay.mjs`) — walks a repo's monthly milestones forward, runs the op-* lifecycle per stage (clean-rebuild, carry agent docs forward), and scores operability + cross-skill coordination. Supports `--client codex|claude|codex-native`. Per-step authorship is captured as a delta and severity/finder metrics are counted over a cleaned report view (drops echoed skill-body rubric and model-authored helper code), so transcript verbosity no longer inflates the counts. Repo-only (not shipped to dist).

### Changed
- Git boundary: write skills (`op-planner`, `op-docup`, `op-feedback-harvest`, `op-decision-memory`, `op-preflight`, `op-audit`) and `templates/AGENTS.md` now forbid `git add`/`commit`/`reset` — only `baby-commit`/`dry-commit` stage/commit, on explicit request. Closes a hazard observed in the stage-replay experiment (an agent with `--dangerously-skip-permissions` auto-committed in a detached worktree and stranded later steps). Protocol/Completion-status sections untouched.
- `scripts/eval/replay-stages.json` — recorded the recommended driver: `--client claude --key KIMI_API --model kimi-k2.7-code-highspeed` + `--timeout-scale 4` (fastest reliable; ~2–6× over regular kimi; deepseek docup trips DeepSeek's circuit breaker; kimi-for-coding 403s non-claude clients).
- Added the stage-replay experiment write-up (`docs/reports/2026-06-18-op-skills-stage-replay-experiment.md`) and the op-docup-sweep integration plan (`docs/reports/2026-06-18-op-docup-sweep-plan.md`).
- `op-preflight` — template-only scaffold handling: when `docs/feedback/index.md` routes no project-specific rules, mine declared rule sources (`AGENTS.md`, `CLAUDE.md` critical rules) as ad-hoc rules and push toward `op-feedback-harvest --apply` (merge-safe: one workflow bullet).
- `op-feedback-harvest` — declared agent-contract rules (AGENTS.md, CLAUDE.md critical rules, CHANGELOG lessons) are first-class harvest candidates alongside commits (merge-safe).
- `INSTALL.md` — shadow-check one-liner for stale pre-`op-*` copies; migration table from pre-`op-*` names; layout-change/pycache update guidance; template-only feedback window note; new "Adapting to your stack" section (declare conventions, never edit skill copies).
- De-bias pass (all merge-safe one-liners; protocol contracts untouched): `op-drift-check` manifest list opened (Maven/.NET/Composer/...) + archetype claim surfaces; `op-debt-scan` size thresholds marked as project-overridable defaults; `op-tour` archetype list extended (GUI/ML/embedded/game) + open manifest set; `op-planner` layer rule generalized + track examples marked illustrative; `op-docup` track examples marked illustrative; `op-story-finder` follows declared docs layout, "no story docs" = DONE not BLOCKED; `baby-commit`/`dry-commit` 300 lines = default, project budget overrides; `op-feedback-harvest` file mapping marked illustrative; `upstream-harvest` tests in upstream's language + archetype categories; `project-doc-kit` archetype contract tables + graceful DOCX skip; `agents/test-runner.md` rule zero (declared test command wins; go/cargo/dotnet/mvn added; local non-Docker fallback).
- `templates/AGENTS.md` — new Stack Profile section (declared language/archetype/commands/layout/budgets that skills read before defaults); `templates/docs/feedback/baseline.md` — archetype-mapping note.
- Removed hardcoded external sprint-tracker paths from `op-tour` and `op-planner`. Sprint/board update is now optional — only when the project already tracks such a file (path declared in AGENTS.md/HANDBOOK); the bundle neither owns nor scaffolds it (merge-safe).
- Knowledge-placement seam (closes a feedback↔architecture drift risk): `op-feedback-harvest` now decides rule ownership before mapping — a candidate that restates an invariant owned by a source-of-truth doc (architecture/design/HANDBOOK/baseline) becomes pointer-form, not a copy; dedup widened to those docs; rule shape gains an `Origin:` provenance line (incident / design-invariant / imported-baseline). `op-drift-check` gains a doc-vs-doc duplication check (a feedback rule restating an owned invariant → INFO). All merge-safe; protocol contracts untouched.
- Epic Closure Gate is now an **ordered** sequence in `templates/AGENTS.md` (and HANDBOOK cadence): `op-drift-check` → `op-docup --epic --apply` → re-check until clean → `op-decision-memory` last → closure checklist. Resolves the one real cross-skill ordering gap found in the system audit (drift-check detects what docup fixes; recording decisions before docs settle risks a stale rationale).
- Added repo-only verification harnesses under `scripts/eval/` (not shipped to dist): `finding-key.mjs` (shared natural-key reference impl), `id-dedup-check.mjs`, `id-stability-replay.mjs`, `ledger-history-retro.mjs`. Empirically validated the shared finding-ID design on a real 1178-commit repo: viable as `domain | line-stripped-paths | controlled-anchor` with a `--follow`/rename-alias step; free-text predicates do NOT converge cross-skill (controlled defect-class/symbol token required).

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
