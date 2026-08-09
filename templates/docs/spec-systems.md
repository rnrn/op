# Task / spec system

Which system this project uses to hold **planned work units** (epics/stories,
spec/plan/tasks, issues, beads, markdown tasks). The planning and audit skills
read this so they create, find, and export units in *your* system instead of
assuming one. Declared value in `AGENTS.md` **Stack Profile → Task / spec system**
always wins; absent that, skills auto-detect (below). The list is open — an
unlisted system is supported by declaring its paths/format here.

## Detection (priority order, first match wins)

1. **Declared** — `AGENTS.md` Stack Profile → `Task / spec system` (+ `Spec unit format`).
2. **spec-kit** — `.specify/`, `specs/*/spec.md`, or `memory/constitution.md` present.
3. **BMAD** — `docs/**/epics/` + `docs/**/stories/`, or `prd.md` / BMM config.
4. **beads** — `.beads/` present, or `bd` on PATH.
5. **markdown** — `docs/tasks/*.md`, `TODO.md`, or `BACKLOG.md` with a task convention.
6. **issues** — a declared external tracker (`gh` / linear / jira) binding.
7. **none** — greenfield; recommend scaffolding a system or planning first.

Detection is read-only and advisory; the declared value overrides it.

## Adapter contract (what every system answers)

The skills target this uniform contract; each system below is a thin recipe
binding it to that system's paths/format:

| Op | Meaning | Used by |
|---|---|---|
| `locate()` | where units live + their file shape | all |
| `find(query)` | search existing units (dedup) | op-story-finder, op-planner |
| `create(unit)` | materialize a planned unit in the system's format | op-planner |
| `export(finding)` | push an audit finding as a unit | op-audit `tasks` |
| `list/status()` | read the backlog | op-audit (greenfield/spec lane), op-debt-scan |

## Per-system recipes (illustrative — declared paths override)

| System | locate / unit | create / export | find |
|---|---|---|---|
| **BMAD** | `docs/<track>/{epics,stories}/`; story = BMAD template | new `story-N.M.md` + epic table row; audit → story under an `audit-remediation` epic | grep `docs/**/stories/*.md` |
| **spec-kit** | `specs/<feature>/{spec,plan,tasks}.md` | append a `tasks.md` row (and `spec.md`/`plan.md` stub if expected) | grep `specs/**/tasks.md` |
| **beads** | `.beads/` store; unit = bead | `bd create …` (title, body, label, priority) | `bd list` / `bd search` |
| **markdown** | `docs/tasks/*.md` / `BACKLOG.md`; unit = checkbox/section | add a task entry | grep the backlog files |
| **issues** | external tracker | `gh issue create` / tracker API | `gh issue list` / search |
| **none** | — | recommend scaffolding a system + `op-planner` | — |

## Notes
- A finding/task carries a backend-tagged `task_ref` (`bd:…`, `epic-35 §…`,
  `spec-kit:…`, `gh:…`, `md:…`, `file`) so a unit is never double-created.
- For **op-audit** the `audit-findings.json` ledger stays the source of truth;
  the spec system is only the export target, and a fixed finding closes its unit.
- BMAD is the built-in default shown in skill examples — it is an illustration,
  not a requirement; this file (or the Stack Profile) replaces it.
