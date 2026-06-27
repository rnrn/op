# Installing the Bundle (Agent Playbook)

Instructions for an agent (or a human driving one) installing this bundle for
a user. There are deliberately no install scripts: every step is a small,
auditable action the agent performs with its own tools, adapted to what it
finds in the target project.

## The model: skills on the host, method in the project

The skills are project-agnostic instructions — they read the target project's
docs and git state at runtime. What varies per project is the **project
method scaffold** (`docs/feedback/`, optionally HANDBOOK/task-intake/
boundaries/build-profiles) that the skills consume. So:

- **Install skills once, host-level** (Claude Code `/plugin` marketplace
  install of this repo; pick plugin groups). Updates then come from one
  place; every project sees the same skill versions.
- **Per project, scaffold only the missing method docs** from `templates/`.
  This is the only per-project "adaptation" — the skills themselves are not
  edited per project.
- **Copy skills into a project** (`.claude/skills/` or `.codex/skills/`)
  only when the project must pin or fork a skill, or when the harness cannot
  use host-level plugins. A copied skill no longer receives updates: record
  the bundle version (from `package.json`) in the copy's folder, e.g. a
  `BUNDLE_VERSION` line in a README there, so drift is visible later.

## Install procedure

Work checkpoint-first: phases 1–2 are read-only; phase 3 writes only after
the user confirms the plan.

### Phase 1 — Inventory the target project (read-only)

Record what already exists; this drives every later decision:

1. Agent contract files: `AGENTS.md`, `CLAUDE.md`, other instruction files.
2. Feedback system: `docs/feedback/index.md`, `docs/feedback/rules/`,
   audits. Many projects already have one — never replace it.
3. Docs layout: does the project use `docs/<track>/epics|stories` (the
   layout op-planner/op-story-finder/op-docup expect), a flat `docs/epics/`,
   a different tracker, or no docs at all?
4. Existing repo-local skills (`.claude/skills/`, `.codex/skills/`) that
   overlap with bundle skills (e.g. a project-specific preflight). One
   command lists the overlaps, including legacy pre-`op-*` names that
   shadow newer bundle behavior:

   ```bash
   ls .claude/skills .codex/skills 2>/dev/null | grep -xE "(op-)?(tour|story-finder|planner|preflight|docup|decision-memory|memory|feedback-harvest|debt-scan|drift-check)|changelog|baby-commit|dry-commit|upstream-(harvest|cherry|issues)|project-doc-kit"
   ```

   Any hit without the `op-` prefix is a stale pre-`op-*` copy: plan its
   removal (or explicit precedence) in Phase 2.
5. Git state: current branch, dirty files. Scaffolding must not entangle
   with in-flight work.
6. Project language and conventions: commit message style, docs language.

### Phase 2 — Plan (still read-only)

Present a short plan to the user before writing anything:

- Which plugin groups to install host-level (`operational-development-cycle`
  is the default; `git-release`, `upstream-research`, `documentation-kits`
  only if the project needs them).
- Which scaffold files are missing and would be copied from `templates/`
  (typically `templates/docs/feedback/*` when no feedback system exists, and
  `templates/AGENTS.md` when there is no agent contract at all).
- What will NOT be touched, and how conflicts are resolved (see below).
- Where the project deviates from bundle assumptions (e.g. flat
  `docs/epics/` without stories) and what that means: planner-family skills
  will propose their default layout unless told otherwise — record the
  project's actual convention in `AGENTS.md`/`CLAUDE.md` so skills follow it.

### Phase 3 — Apply (only after user confirmation)

1. Host install: guide the user through `/plugin` -> add this repository as
   a marketplace source -> select the agreed groups. (Agent cannot click
   this UI; the user does. For headless setups, copying the needed skill
   folders into `~/.claude/skills/` is the fallback.)
   - **Also copy the shared `scripts/lib/` to `~/.claude/scripts/lib/`** — a
     SIBLING of `skills/`, **not** under `skills/`. The skill scripts import it
     by relative path (`../../../scripts/lib/...` from
     `skills/<name>/scripts/*.mjs`), so it must resolve to `<root>/scripts/lib/`
     (e.g. `~/.claude/scripts/lib/stack-check.mjs`,
     `~/.claude/scripts/lib/fan-out-lane.mjs`). Putting it under
     `skills/scripts/lib/` breaks the accept gate and the fan-out engines. The
     `/plugin` marketplace install places this automatically; only the headless
     copy fallback must get the location right.
2. Scaffold: copy ONLY the agreed missing files from `templates/`. Merge,
   never overwrite — if `docs/feedback/index.md` exists, add missing index
   entries instead of replacing the file.
3. Commit the scaffold as its own commit (`docs(method): add feedback
   scaffold from crateon-bundle`), touching nothing else. Respect the dirty
   tree: do not mix scaffold files with the user's in-flight changes.

### Phase 4 — Verify

- Run `op-tour` (read-only) — it should produce a coherent tour and report
  the method docs as present or explicitly N/A.
- Run `op-preflight` on a small upcoming task — it should find
  `docs/feedback/index.md` and select rules without errors.
- Confirm no unexpected file appeared: `git status --short` shows only the
  agreed scaffold files.

## Adapting to your stack (without editing skills)

Skills carry web/Go/Node-flavored examples and default thresholds; they are
defaults, not requirements. Adapt by **declaring** project conventions, never
by editing host skill copies — edited copies silently fall behind every
bundle update (see "Copied-skill drift" below). The knobs, all project-side:

1. **Stack Profile** in `AGENTS.md` (section in the scaffold template):
   language(s), archetype, build command, test/proof command, docs layout,
   file/commit budgets. Skills and the test-runner agent read these before
   falling back to their built-in defaults.
2. **Budgets**: file-size and commit budgets in the Stack Profile or a
   file-budget baseline (`scripts/file-budget-baseline.json`) override the
   built-in 500/1000/300 numbers.
3. **Docs layout**: declare a non-BMAD layout in `AGENTS.md`/`HANDBOOK.md`;
   planner/docup/story-finder follow the declared layout.
4. **Project rules**: archetype-specific invariants belong in
   `docs/feedback/rules/*` (via `op-feedback-harvest`), not in skill bodies.
5. **Project addendum**: stricter project gates go in
   `.agents/skills/op-preflight/SKILL.md`, which op-preflight loads on top of
   the bundle skill.

Archetype note: skills name claim surfaces per archetype (endpoints for
services, screens/commands for GUI/CLI, stages/metrics for ML, public API for
libraries). If your archetype is not listed anywhere, describe it in the
Stack Profile — skills are instructed to follow the declared archetype rather
than force the nearest example.

## Things that go wrong — attention list

- **Overwriting an existing method.** A project with its own
  `docs/feedback/` or preflight skill (common) already lives by some method.
  Bundle scaffold is for projects that have none. Merge indexes; keep the
  project's rules authoritative.
- **Skill name collisions.** If a repo-local skill overlaps a bundle skill
  (e.g. local `arki-preflight` vs `op-preflight`), state the precedence in
  the project's agent contract file — usually the repo-local one wins for
  that repo, because it encodes project-specific rules.
- **Forcing the BMAD layout.** op-planner/op-docup/op-story-finder default
  to `docs/<track>/epics|stories`. On a project with a different (or flat)
  layout, either scaffold the expected layout (new projects) or write the
  actual convention into `AGENTS.md`/`CLAUDE.md` (existing projects) — do
  not bulk-restructure existing docs as part of installation.
- **English templates in a non-English project.** Scaffold templates are
  English. If the project's docs are in another language, translate the
  scaffold during copy and say so in the plan.
- **Copied-skill drift.** Project-level copies silently fall behind the
  marketplace version. Pin the version visibly (see above) and prefer
  host-level installs.
- **Writing scripts preemptively.** Do not add installer scripts to the
  project. If a one-off action needs a script, write it ad hoc, run it, and
  delete it (or keep it only if the user asks).
- **Migrating from pre-`op-*` names.** Older installs shipped `planner`,
  `docup`, `story-finder`, `tour`, `preflight`, `debt-scan`, `drift-check`,
  `memory`, `feedback-harvest`. Their current names are the `op-*`
  equivalents (`memory` -> `op-decision-memory`), all checkpoint-first.
  When updating: remove the old copies, update `/name` references in the
  project's `CLAUDE.md`/`AGENTS.md`, and note the checkpoint-by-default +
  `--apply` contract there.
- **Updating skills that changed layout or ship scripts.** Between releases
  a skill's internal layout may move (files into `scripts/`,
  `references/`); update by replacing the skill folder wholesale, not by
  merging, and delete stray `__pycache__/` from old host copies. Check the
  bundle `CHANGELOG.md` for the per-skill note before deciding
  replace-vs-merge.
- **Template-only feedback window.** Right after scaffolding,
  `docs/feedback/index.md` routes only `baseline.md`, so `op-preflight` has
  no project rules to select — it will fall back to mining
  `AGENTS.md`/`CLAUDE.md` and flag the gap. Close the window in the same
  session: run `op-feedback-harvest --apply` to promote declared rules and
  commit-history lessons into `docs/feedback/rules/`.

## Safety contract for the installer agent

Phases 1–2 are read-only. Phase 3 writes only the files listed in the
confirmed plan, only via merge-not-overwrite, and commits them separately.
Anything outside that list requires going back to the user.
