# op-audit — operations reference (read when running these specific modes)

The router (`SKILL.md`) carries every command + the core `run`/`verify`/`plan`/`status` flow.
This file holds the deeper operational detail for the stance distinction, `run --spec`, and the
`tasks` export backends — load it only when you reach that mode.

## Stance — discovery seeds a charter; scoped serves one (full)

The `--scope` distinction is load-bearing: an audit either **finds anything** across the whole
project (`project`) or **checks the planned work** within a bounded surface (`charter`).

- **Discovery (`project`)** is a *campaign seeder* — it creates the ledger that a remediation
  campaign then works. Run it standalone, to start a remediation charter
  (`goal op-watch "ledger clean"`), or on explicit request.
- **Scoped (`charter`)** is a *campaign server* — `verify` and `run --scope charter --paths` audit
  only the charter's diff/findings against the plan, so they compose with `op-preflight` (the
  before/after bookends of a unit) without dragging in the rest of the project.

**Never run discovery as an in-loop step** of a build/plan campaign: re-importing the whole
project's findings is the focus-loss a charter is meant to prevent. Inside `op-watch`, discovery
runs only when the charter's `done_condition` is `ledger-clean`; build charters use scoped audit
(at acceptance) + preflight (per unit) only.

## Workflow — `run --spec` (audit the plan, not only code)

For greenfield or plan-heavy projects: audit the **planned backlog** (units in the task/spec
system — BMAD stories/epics, spec-kit `spec/plan/tasks`, beads, markdown backlog; detected per
`docs/spec-systems.md`). One spec lane reviews the units for: missing/untestable acceptance
criteria, duplicate or overlapping units, orphan units (no owner/epic), plan-vs-code drift (a
documented unit with no code, or code with no unit), and contradictions across units. Findings
join the same `audit-findings.json` ledger under domain `spec` (stable ids, same statuses), so
they plan/verify/export exactly like code findings. Combine with a code `run` or use alone on a
backlog with little code.

## Workflow — `tasks` (export findings to the project's task/spec system)

Export every `open`/`in_progress` finding that lacks a `task_ref` (see dedup rule below) **into the
project's task/spec system** — detect it per `docs/spec-systems.md` (or force `--system`): a BMAD
story under an audit-remediation epic · a spec-kit `tasks.md` row · a bead · a `gh issue` · a
markdown task. The `task_ref` is backend-tagged (`bd:…`, `epic-35 §…`, `spec-kit:…`, `gh:…`,
`md:…`, `file`) so a finding is never double-exported, and a fixed finding closes its unit. The
ledger stays the source of truth; the system is the export target. The file-based recipes below are
the default fallback.

**Anchor the tracker to the git root, NOT cwd.** First resolve
`ROOT=$(git rev-parse --show-toplevel)` (fallback: the parent of `--dir`). The audit may run from a
subdir (e.g. `docs/audit/`); if you let beads/planner default to cwd the DB or stories land in the
wrong place. `--beads-dir <path>` overrides ROOT for monorepos.

**Backend selection** (default = auto; force with `--backend beads|planner|file`):
1. **beads** — chosen when `bd` is on PATH. Beads is fully local (git-backed store in
   `<ROOT>/.beads/`, no external service). Run `bd` from inside ROOT (`( cd "$ROOT" && bd … )` —
   note `bd` has no `-C/--chdir` flag in older builds, so `cd` is the portable form). It needs an
   initialized DB:
   - probe with `( cd "$ROOT" && bd list )` (or `bd doctor`). If it errors with *no beads database
     found*, initialize once: `( cd "$ROOT" && bd init --prefix audit )` (creates `<ROOT>/.beads/`,
     IDs like `audit-<hash>`). Do **not** run `bd init` from cwd — it would create `.beads/` in the
     audit subdir.
   - if init reports *embedded Dolt requires CGO* (CGO-less `bd` build), retry with
     `bd init --prefix audit --server` — it launches a local Dolt sql-server automatically (still
     fully local, no remote service).
   - then, one issue per finding: `( cd "$ROOT" && bd create … )` (or batch markdown) with title
     `[<severity>] <id> <title>`, body = observation + why + remediation + evidence + Investor-Risk
     score, label `audit`, priority from severity (`-p 0..4`, 0=highest; Critical→0 High→1 Medium→2
     Low→3 Info→4). Pass long bodies via `--body-file <abs-path>` using **absolute** paths
     (cross-shell temp dirs differ). Record each returned `bd` ID (use `--silent` to capture just
     the ID) into that finding's `task_ref` (e.g. `bd:audit-7`). Link dependencies if obvious.
   - if `bd` is on PATH but init fails (read-only FS, etc.) → fall through to planner.
2. **planner** — the project's planner skill (`op-planner` / BMAD stories) for grouped stories.
   Chosen when `bd` is absent or `--backend planner`.
3. **file** — write `audit-tasks.md`, a checklist grouped by remediation wave. Last resort or
   `--backend file`.

**Dedup rule:** never create a duplicate in the **same backend** for a finding that already has a
`task_ref` for that backend. `task_ref` should be backend-tagged (`bd:audit-7`, `epic-35 §35.9`,
`file`). A finding already exported to planner is NOT considered exported to beads — `--backend
beads` (optionally `--force`) mirrors such findings into beads and appends the new ref. Plain
`tasks` with no findings missing a ref for the chosen backend exports nothing and says so.
