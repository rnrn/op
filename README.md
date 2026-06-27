# Crateon Bundle

Portable Claude Code and Codex skills, commands, agents, hooks, and project-method templates for operational development workflows.

## Quick start — implement a feature from a doc

Two steps: turn your spec/notes into work units with **op-planner**, then let
**`goal op-watch`** build them to done autonomously. You never run the internal
scripts (`verdict`/`accept`/`mark`) yourself — op-watch does.

**1. Plan (review-first).** Point op-planner at your document; `--apply` writes the
epic + stories so you can review the scope before any code:

```
/op-planner slice docs/notes/<your-feature>.md into an epic and stories --apply
```

Review the generated `docs/<track>/stories/*.md`, adjust scope if needed.

**2. Build (one autonomous prompt).** Start a `goal` loop over the plan:

```
goal op-watch "build the <feature> epic to CLEAN-DONE"
```

op-watch derives a campaign from the stories and pumps **one bounded step per
turn** — per story: preflight → implement → acceptance gate (file-truth +
stack-deviation + stub checks) → verify → close the epic-closure gate — until a
deterministic **CLEAN-DONE** verdict. The loop keeps it on-charter and catches
false-done / language drift automatically.

**Prefer one prompt?** Skip the plan review and let derive plan the doc itself:

```
goal op-watch "implement the feature in docs/notes/<your-feature>.md — slice it with op-planner, then build to CLEAN-DONE"
```

**One-time project setup** (so the build stays on track):

- **Declare your stack** in `AGENTS.md` (Stack Profile → `Language(s):` e.g. `go`)
  and `docs/HANDBOOK.md` — otherwise a polyglot spec can pull the model into a
  language you didn't ask for.
- **Work on a feature branch**, not `main`/`master` — op-watch defers writes on
  the default branch.

## Demo

The op-* lifecycle in 25 seconds — preflight gate, checkpoint-first planning, and the completion-status protocol on a real project:

[![op-* skills demo — click for the full-quality video](docs/demo/op-skills-preview.gif)](docs/demo/op-skills-web.mp4?raw=true)

<!--
For a true inline player on GitHub: open this README in the github.com web
editor, drag docs/demo/op-skills-web.mp4 (0.6 MB, fits the 10 MB limit) into
the editor, and replace the GIF block above with the generated
https://github.com/user-attachments/assets/<uuid> URL on its own line.
Repo-committed mp4 files do not render as a player inside README.
-->

## Contents

### Skills (`skills/`)

The 16 published skills. Every skill declares a safety class (see
`docs/SKILL_STANDARD.md`): **read-only** skills never write files,
**checkpoint** skills write only a checkpoint artifact by default and require
explicit `--apply`/`--commit` for real mutations, and the **generator** skill
writes only inside its dated output directory.

| Skill | Purpose | Safety class |
|-------|---------|--------------|
| **op-tour** | Build a quick onboarding map of project structure, architecture, docs, and workflow | read-only |
| **op-story-finder** | Search existing stories by keywords before creating new tasks | read-only |
| **op-planner** | Create BMAD BMM stories/epics from natural language; writes `PLANNER_CHECKPOINT.md` by default | checkpoint |
| **op-preflight** | Select project feedback rules and validate scope/invariants/risks before implementation | checkpoint (report-only) |
| **op-docup** | Sync code changes with project documentation; writes `DOCUP_CHECKPOINT.md` by default | checkpoint |
| **op-decision-memory** | Capture durable architecture decisions (ADR log) after epic/story implementation | checkpoint |
| **op-feedback-harvest** | Harvest durable feedback rules from commits, bugs, reviews, and incidents | checkpoint |
| **op-debt-scan** | Scan technical debt indicators and missing-test pressure, ranked by priority score | read-only |
| **op-drift-check** | Check architecture drift between documentation and actual code | read-only |
| **project-doc-kit** | Generate a dated full project documentation kit with architecture, contracts, code map, history, debt, diagrams, and optional DOCX | generator (`docs/<YYYYMMDD>/` only) |
| **upstream-harvest** | Analyze upstream commits and generate BMAD BMM docs + tests; checkpoint first | checkpoint |
| **upstream-cherry** | Cherry-pick upstream changes with air-gap testing; proposal + tests are the checkpoint | checkpoint |
| **upstream-issues** | Harvest GitHub issues/PRs into BMAD BMM epics/stories; bounded checkpoint first | checkpoint |
| **baby-commit** | Split changes into baby-step commits of at most 300 changed code lines | checkpoint |
| **dry-commit** | Group uncommitted changes by theme into `COMMIT_PLAN.md` with commit messages | checkpoint |
| **changelog** | Generate a keepachangelog section from git history; preview by default | checkpoint |

### Recommended Packs

Use these packs when installing only the daily surface:

- **core:** `op-preflight`, `op-planner`, `op-story-finder`, `op-docup`, `op-drift-check`, `op-debt-scan`, `op-decision-memory`, `op-tour`, `op-feedback-harvest`
- **git-release:** `baby-commit`, `dry-commit`, `changelog`
- **upstream:** `upstream-harvest`, `upstream-cherry`, `upstream-issues`
- **documentation-kits:** `project-doc-kit`

Source-only extras (`deploy`, `graphify-loop`, `hardening`, `hf-download`,
`search-adapter`, `service-checker`) live in this workspace but are not
published to the dist bundle.

### Commands (`commands/`)

Invoked via slash: `/harvest`, `/xloop`, `/run-epic`, etc.

| Command | Purpose | Portability Notes |
|---------|---------|-------------------|
| **harvest** | Harvest documentation from markdown files into BMAD BMM | Requires BMAD BMM structure |
| **run-epic** | Load BMAD BMM epic into sprint and execute | Requires BMAD BMM + workflow agents |
| **xloop** | Long-running loop for automated multi-step tasks | Generic |
| **xloop-status** | Check xloop status | Generic |
| **xloop-stop** | Stop current xloop | Generic |

### Agents (`agents/`)

Agent definitions for Claude Code agent SDK or LTC integration.

| Agent | Purpose |
|-------|---------|
| **doc-harvester** | Harvests docs from upstream repos |
| **run-epic** | Executes epic workflow |
| **test-runner** | Runs tests in appropriate container |

### Hooks (`hooks/xloop/`)

JavaScript hooks supporting the `/xloop` command.

- `create-state.js` — Initialize xloop state
- `stop-hook.js` — Graceful loop termination
- `utils/` — Helper modules (messages, platform detection, promise parsing, state, transcript)

### Config Templates (`templates/`)

Starter configs adapted from the source project. Review and customize before use:

| File | Purpose |
|------|---------|
| `AGENTS.md` | Project-method agent contract starter |
| `crateon-config.yaml` | Coder backend config example (`opencode` vs `cc`) |
| `docs/` | Project-method doc scaffold (HANDBOOK, INDEX, taxonomy, boundaries, build profiles) |
| `docs/feedback/` | Portable baseline feedback index and rules for `op-preflight` |

## Installation

**Agent-driven install:** point the agent at [INSTALL.md](INSTALL.md) — an
installation playbook (inventory -> plan -> confirmed apply -> verify) with
the attention list for existing projects. Summary of the model: skills are
installed once on the host via the marketplace; per project only the missing
method docs are scaffolded from `templates/`; skills are copied into a
project only to pin or fork them.

### GitHub Marketplace Install

This repository is structured as one marketplace repo with multiple plugin
groups under `.claude-plugin/marketplace.json`:

- `operational-development-cycle` — install first for normal project work.
- `git-release` — optional commit/changelog hygiene.
- `upstream-research` — optional upstream repository analysis.
- `documentation-kits` — optional dated project documentation snapshots and DOCX albums.

`project-doc-kit` is process-adjacent to `operational-development-cycle`, but
kept in the separate `documentation-kits` group because it is a batch snapshot
skill, not a daily per-task closeout skill. For full project-method onboarding,
install both `operational-development-cycle` and `documentation-kits`; for a
light daily cycle, install only `operational-development-cycle`.

Recommended project onboarding path:

```text
op-tour
op-story-finder -> op-planner -> op-preflight -> implementation harness
op-docup -> op-decision-memory
project-doc-kit  # optional batch snapshot when a full dated docs kit is needed
op-feedback-harvest --apply -> docs/feedback -> next op-preflight
op-debt-scan + op-drift-check -> op-story-finder -> op-planner
```

Claude Code users can install through the `/plugin` flow by adding this GitHub
repository as a plugin source, then selecting one or more marketplace groups.
The root plugin manifest is `.claude-plugin/plugin.json`; the grouped install
catalog is `.claude-plugin/marketplace.json`.

Codex-compatible plugin metadata lives in `.codex-plugin/plugin.json`. It points
to the same `skills/` directory and mirrors the public package metadata, so the
bundle can be consumed by both Claude Code and Codex-oriented plugin tooling.

When publishing to GitHub, publish the curated build output, not the whole
working directory:

```bash
npm run validate:dist
```

The public bundle is written to `dist/crateon-bundle`. It includes only the
daily lifecycle packs (`op-*`), git/release skills, upstream research skills,
`project-doc-kit`, plugin manifests, templates, commands, agents, hooks, and
validation scripts. Local ops/data extras such as `deploy`, `graphify-loop`,
`hardening`, `hf-download`, `search-adapter`, and `service-checker` stay in the
source workspace unless intentionally promoted later.

Before publishing, update `.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, and
`package.json` if the repository URL, owner, license, or version changes.

### Manual Install

1. Copy the desired components into your target project's `.claude/` directory:

```bash
# From this bundle directory
cp -r skills/*   /path/to/target/.claude/skills/
cp -r commands/* /path/to/target/.claude/commands/
cp -r agents/*   /path/to/target/.claude/agents/
cp -r hooks/*    /path/to/target/.claude/hooks/
```

2. Restart Claude Code or reload the project to pick up new skills and commands.

3. If the target project does not already have project-method docs, install the portable scaffold:

```bash
cp templates/AGENTS.md /path/to/target/AGENTS.md
mkdir -p /path/to/target/docs
cp -r templates/docs/* /path/to/target/docs/
```

Do not overwrite existing project-specific `AGENTS.md`, `docs/`, or `docs/feedback/` without merging active project rules, indexes, and topic files.
When installing into a new harness, preserve artifact layers (`skills`, `commands`, `hooks`, `agents`, `rules`, `mcp`) and install only the needed daily surface. Keep slash commands as compatibility shims that delegate to canonical skills.

## Validation

Before publishing or installing the whole bundle, validate skill folders,
plugin metadata, and obvious secret/local-path leaks:

```bash
npm run validate
node scripts/validate-project-method-templates.js
```

Build and validate the curated public distribution:

```bash
npm run validate:dist
```

The validator checks the portable Agent Skills contract: each skill folder has `SKILL.md`, frontmatter has `name` and `description`, the name matches the folder, and long instructions are split into references. Published skills are additionally held to `docs/SKILL_STANDARD.md`: declared safety class with a canonical contract section, trigger-phrased descriptions, English-only content, no project debris, and size budgets.

Behavioral changes to published skills are verified against the eval harness
in `scripts/eval/` — fixture-based real tasks (commit grouping, planning
checkpoints, debt/drift scans, harvest dry-runs) with artifact-level asserts,
plus a trigger-match accuracy eval over the skill descriptions. See
`scripts/eval/README.md`.
The marketplace validator checks `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json`, plugin groups, public license metadata, and skill path references before publishing the repo through GitHub.
The project-method template validator checks that generated-project scaffold docs, skill gates, and install instructions stay in sync.

Generated archives such as `crateon-bundle.zip` are release artifacts, not source
content. Keep them out of commits and publish them through GitHub Releases only
when a downloadable archive is needed.

## Minimal Setup (generic projects)

If your target project does **not** use BMAD BMM or Crateon, start with only these:

```bash
skills/baby-commit/
skills/dry-commit/
skills/op-tour/
skills/op-preflight/
commands/xloop.md
commands/xloop-status.md
commands/xloop-stop.md
hooks/xloop/
templates/AGENTS.md
templates/docs/feedback/
templates/docs/INDEX.md
templates/docs/HANDBOOK.md
templates/docs/task-intake.md
templates/docs/docs-taxonomy.md
templates/docs/subsystem-doc-contracts.md
templates/docs/project-boundaries.md
templates/docs/build-profiles.md
```

## Full Setup (BMAD BMM projects)

If your target project uses BMAD BMM, copy everything and ensure these directories exist:

```
docs/<track>/epics/
docs/<track>/stories/
```

## License

MIT. See [LICENSE](LICENSE).
