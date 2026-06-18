---
name: op-audit
description: Run an investor-grade, multi-agent technical due-diligence audit of a codebase and track the findings as durable tasks. Fans out independent domain auditors (security, architecture, supply-chain, quality, CI/CD, testing, perf), adversarially verifies every High/Critical finding, scores each by an Investor-Risk formula, writes a board-ready report, and exports findings to a status ledger and issue tracker. Use when the user asks for a code/security/architecture audit, a due-diligence or investor/M&A review, or wants to re-check, track, or close previously found audit issues without re-running the whole audit. Invoked bare or with --help, it inspects state and recommends the next step — run an audit, or plan the fixes in staged waves so they ship in order instead of all at once.
license: MIT
metadata:
  safety-class: generator
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Workflow, Task, Skill
---

# op-audit Skill

Turn a one-shot audit into a **repeatable, trackable program**: run a multi-agent
investor-grade audit, produce evidence-backed findings, persist them in a status
**ledger** keyed by stable IDs, and re-verify individual findings later — so you
walk the task list and confirm fixes instead of re-auditing everything.

## Safety Contract

This skill **writes** report + ledger files under the audit directory and may create
tracker issues. It never modifies source code. Default audit dir: `docs/audit/`
(override with `--dir`). Confidentiality: run entirely **locally** against the working
tree — never send code or secrets to external services, never run active scans (DAST)
against live systems, and **never print secret values** in the report or ledger
(cite `file:line`, not contents). The audit engine reads source only and
never runs `git add`, `git commit`, or `git reset` on the project.

## Usage

```
/op-audit                     # guided help: inspect state, recommend the next step
/op-audit --help              # same as bare invocation
/op-audit plan                # staged remediation plan from the ledger (waves; ONE stage per pass)
/op-audit run                 # full audit -> report + ledger (preserves prior statuses)
/op-audit run --dir docs/dd   # custom audit directory
/op-audit run --tasks         # also export open findings to the issue tracker
/op-audit verify <ID>         # re-check ONE finding for resolution; update its status
/op-audit verify --open       # re-check all open/in-progress findings (one agent each)
/op-audit status              # ledger dashboard — no agents run
/op-audit tasks               # export/refresh open findings as tracker issues
/op-audit close <ID> --reason "…"   # manually resolve a finding
```

| Argument | Meaning |
|---|---|
| `--dir <path>` | Audit directory (default `docs/audit/`). Holds `audit-findings.json` (ledger), `audit-report.md`, `audit-charter.md`. |
| `--tasks` | After a run, also run the `tasks` export. |
| `--lanes <k,…>` | Restrict to specific lanes (keys: `appsec-secrets appsec-surface architecture supplychain quality cicd testing perf-sre`). |
| `--backend <b>` | Force the `tasks` tracker backend: `beads` \| `planner` \| `file` (default: auto — beads if `bd` on PATH, else planner, else file). |
| `--beads-dir <path>` | Override the beads root (default: git root). For monorepos / multiple modules. |
| `--force` | In `tasks`, mirror findings into the chosen backend even if they already have a `task_ref` for a *different* backend. |

## Default — guided help (`--help` / no args)

When invoked with no action, `--help`, or `help`, **do not run agents**. Inspect state
and recommend the next step, so the user never fixes everything blindly in one pass:

1. Look for `audit-findings.json` under the audit dir (default `docs/audit/`).
2. **No ledger** → there is nothing to fix yet. Recommend `/op-audit run` to produce the
   first audit + ledger. Briefly list what `run` will do.
3. **Ledger with open findings** → recommend planning, not bulk-fixing. Show the one-line
   status (open / verified / regressed counts, open effort) and route to `/op-audit plan`
   for the staged order. Highlight any `regressed` findings first.
4. **Ledger, all findings closed/verified** → recommend `/op-audit run` to re-baseline and
   catch regressions.

Always print the short command table and end by naming the single recommended next command.

## Workflow — `plan`

Read the ledger only (no agents). Produce a **staged remediation plan** so fixes ship in
waves instead of one giant pass:

1. Triage first: flag findings that are likely **accepted risk** (intentional config,
   `wont_fix` candidates) and **structural/expensive** items (high `effort_days`) to defer —
   list them separately so the user can `close --reason` or postpone before spending effort.
2. Group the remaining `open`/`in_progress` findings into stages by ROI (reuse the report's
   remediation waves when present; otherwise: Stage 1 = quick wins = high Investor-Risk ×
   low `effort_days`; Stage 2 = hardening; Stage 3 = structural). Within a stage, order by
   Investor-Risk score.
3. For each stage print: the finding IDs + titles, total `effort_days`, and which files/
   packages they touch (to flag where parallel work would collide).
4. State the **per-finding loop** to run for each item: branch → minimal fix per the
   finding's `remediation` → targeted tests → small commit (respect any project commit-size
   gate) → `/op-audit verify <ID>` to confirm at the cited `file:line` → close the task.
5. Recommend doing **one stage per pass**, then `/op-audit run` to re-baseline between
   stages. Offer `/op-audit tasks` to export the chosen stage to the issue tracker.

## The ledger (source of truth)

`audit-findings.json` carries every finding with a stable `id`, the Investor-Risk
score, and a lifecycle `status`. **IDs are stable across runs** — that is what makes
tracking work. See `references/methodology.md` for the full schema and risk formula.

Status lifecycle: `open → in_progress → fixed → verified` (plus `wont_fix`, `regressed`).

## Workflow — `run`

1. **Scope freeze (you, live).** Detect the repo root, languages, module/package map,
   LOC, and existing posture (CI configs, SBOM, container files, security docs). Read
   the project's OWN standards (`AGENTS.md`, `CLAUDE.md`, `docs/**`) — these become the
   audit **baseline** (the yardstick auditors measure against). Write/refresh
   `audit-charter.md` (which lanes, which modules, run order). Keep it factual.
2. **Load prior ledger** if `audit-findings.json` exists; collect existing
   `{id,title,location}` as `knownFindings` so auditors REUSE stable IDs.
3. **Run the engine.** Invoke the **Workflow** tool with `scriptPath` =
   `<this skill dir>/scripts/audit-workflow.js` and
   `args = { root, baseline, mode:"audit", knownFindings, lanes? }`.
   The engine fans out the lanes, adversarially verifies every High/Critical finding
   (refuted ones are dropped), scores survivors, and returns
   `{ sevCounts, totalEffort, domainSummaries, findings[], synthesis }`.
   If the Workflow tool is unavailable, fall back to spawning the same lanes as
   sequential `Task` agents using the lane definitions in the script.
4. **Merge into the ledger (do NOT clobber status).** For each returned finding:
   - id exists in prior ledger → carry over `status`, `first_seen`, `task_ref`; refresh
     evidence/score; if it was `fixed`/`verified` but reappears, set `status:"regressed"`.
   - id is new → `status:"open"`, `first_seen:<today>`.
   - prior `open`/`in_progress` finding NOT returned this run → set
     `status:"fixed"` with note `auto: no longer detected` (candidate — confirm via `verify`).
   Stamp `last_checked:<today>`. Write `audit-findings.json`.
5. **Write the report.** Render `audit-report.md` from the engine output: executive
   summary (rating, severity dashboard, top findings, deal implication), risk matrix
   ranked by Investor-Risk score, remediation waves, per-domain summaries + strengths,
   full findings register with evidence and verifier notes. Use Write (native tool).
6. **Report the diff** to the user: new / resolved / regressed counts + top risks.
7. If `--tasks`, run the `tasks` workflow.

## Workflow — `verify`

Targeted, cheap, **no full re-audit**. Select the finding(s) by ID (or all `open`/
`in_progress` for `--open`). Invoke Workflow with
`args = { root, baseline, mode:"verify", findings:[…selected…] }`. The engine returns
`{ resolutions:[{finding_id, resolution, evidence, notes}] }`. Apply:
`fixed → status:"verified"`; `partially-fixed → in_progress`; `still-open → open`;
`cannot-tell → leave + note`. Append the evidence to the finding and to the tracker
issue (`bd note`/comment if exported). Write the ledger. Summarize what changed.

## Workflow — `tasks`

Export every `open`/`in_progress` finding that lacks a `task_ref` (see dedup rule below).

**Anchor the tracker to the git root, NOT cwd.** First resolve
`ROOT=$(git rev-parse --show-toplevel)` (fallback: the parent of `--dir`). The audit may
run from a subdir (e.g. `docs/audit/`); if you let beads/planner default to cwd the DB or
stories land in the wrong place. `--beads-dir <path>` overrides ROOT for monorepos.

**Backend selection** (default = auto; force with `--backend beads|planner|file`):
1. **beads** — chosen when `bd` is on PATH. Beads is fully local (git-backed store in
   `<ROOT>/.beads/`, no external service). Run `bd` from inside ROOT
   (`( cd "$ROOT" && bd … )` — note `bd` has no `-C/--chdir` flag in older builds, so
   `cd` is the portable form). It needs an initialized DB:
   - probe with `( cd "$ROOT" && bd list )` (or `bd doctor`). If it errors with
     *no beads database found*, initialize once: `( cd "$ROOT" && bd init --prefix audit )`
     (creates `<ROOT>/.beads/`, IDs like `audit-<hash>`). Do **not** run `bd init` from cwd —
     it would create `.beads/` in the audit subdir.
   - if init reports *embedded Dolt requires CGO* (CGO-less `bd` build), retry with
     `bd init --prefix audit --server` — it launches a local Dolt sql-server automatically
     (still fully local, no remote service).
   - then, one issue per finding: `( cd "$ROOT" && bd create … )` (or batch markdown) with
     title `[<severity>] <id> <title>`, body = observation + why + remediation + evidence +
     Investor-Risk score, label `audit`, priority from severity (`-p 0..4`, 0=highest;
     Critical→0 High→1 Medium→2 Low→3 Info→4). Pass long bodies via `--body-file <abs-path>`
     using **absolute** paths (cross-shell temp dirs differ). Record each returned `bd` ID
     (use `--silent` to capture just the ID) into that finding's `task_ref` (e.g. `bd:audit-7`).
     Link dependencies if obvious.
   - if `bd` is on PATH but init fails (read-only FS, etc.) → fall through to planner.
2. **planner** — the project's planner skill (`op-planner` / BMAD stories) for grouped
   stories. Chosen when `bd` is absent or `--backend planner`.
3. **file** — write `audit-tasks.md`, a checklist grouped by remediation wave. Last resort
   or `--backend file`.

**Dedup rule:** never create a duplicate in the **same backend** for a finding that already
has a `task_ref` for that backend. `task_ref` should be backend-tagged (`bd:audit-7`,
`epic-35 §35.9`, `file`). A finding already exported to planner is NOT considered exported
to beads — `--backend beads` (optionally `--force`) mirrors such findings into beads and
appends the new ref. Plain `tasks` with no findings missing a ref for the chosen backend
exports nothing and says so.

## Workflow — `status`

Read the ledger only (no agents). Print: counts by status and severity, total open
remediation person-days, the top open risks by Investor-Risk score, and any
`regressed` findings (highlight these). Suggest the next action (`verify --open`,
`tasks`, or `run`).

## Output

Always end with the dashboard line: `Findings: <open> open · <verified> verified ·
<regressed> regressed · ~<days>d open effort` and a one-line next-step suggestion.

## Completion Status

Protocol (non-negotiable): the VERY LAST line MUST start with exactly one token,
followed by ` — <one-line reason>`:

- `DONE` — action completed (audit ran / ledger updated / tasks exported / status shown).
- `DONE_WITH_CONCERNS` — completed but a lane failed, the toolchain was unavailable for
  proof, or some findings are unverifiable; list them.
- `BLOCKED` — repo unreadable, no audit dir writable, or the audit engine could not run.
- `NEEDS_CONTEXT` — unknown finding ID, invalid lane key, or ambiguous audit root.
