---
name: op-audit
description: Run an investor-grade, multi-agent technical due-diligence audit of a codebase and track the findings as durable tasks. Use when the user asks for a code/security/architecture audit, a due-diligence or investor/M&A review, or wants to re-check, track, or close previously found audit issues without re-running the whole audit. Invoked bare or with `--help`, it inspects state and recommends the next step (run an audit, or plan the fixes in staged waves).
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
(override with `--dir`). **For a read-only pass** (auditing a repo you must not write into), pass `--report-only`
(findings to the conversation, nothing written) — or point `--dir` outside the target, or use
`status`/`plan` (which run no agents and write nothing). Bare `run`/`tasks` DO write the
ledger/report/tracker under the target. Confidentiality: run entirely **locally** against the working
tree — never send code or secrets to external services, never run active scans (DAST)
against live systems, and **never print secret values** in the report or ledger
(cite `file:line`, not contents). The audit engine reads source only and
never runs `git add`, `git commit`, or `git reset` on the project.

## Usage

```
/op-audit                     # guided help: inspect state, recommend the next step
/op-audit --help              # same as bare invocation
/op-audit plan                # staged remediation plan from the ledger (waves; ONE stage per pass)
/op-audit run                 # full DISCOVERY audit (whole project) -> report + ledger
/op-audit run --report-only   # read-only: findings to the conversation, write nothing
/op-audit run --scope charter --paths "<changed>"   # SCOPED audit of a change vs the plan (no project-wide wandering)
/op-audit run --spec          # audit the PLANNED backlog (specs/stories/tasks), not only code
/op-audit run --dir docs/dd   # custom audit directory
/op-audit run --tasks         # also export open findings to the project's task/spec system
/op-audit verify <ID>         # re-check ONE finding for resolution; update its status
/op-audit verify --open       # re-check all open/in-progress findings (one agent each)
/op-audit status              # ledger dashboard — no agents run
/op-audit tasks               # export/refresh open findings as tracker issues
/op-audit close <ID> --reason "…"   # manually resolve a finding
```

| Argument | Meaning |
|---|---|
| `--dir <path>` | Audit directory (default `docs/audit/`). Holds `audit-findings.json` (ledger), `audit-report.md`, `audit-charter.md`. |
| `--report-only` | (alias `--dry-run`) Read-only pass: run the lanes and render the findings to the conversation, but write NO ledger/report/tracker and touch nothing under the target. Use when auditing a repo you must not modify (mirrors the read-only default of op-debt-scan / op-story-finder). |
| `--tasks` | After a run, also run the `tasks` export (into the project's task/spec system). |
| `--spec` | `run` mode: audit the planned backlog (units in the task/spec system) for quality/coverage/contradictions, joining the ledger under domain `spec`. |
| `--scope <project\|charter>` | **Stance** (default `project` for `run`). `project` = DISCOVERY: audit the whole codebase, find anything — this *seeds* a remediation charter. `charter` = SCOPED: audit only `--paths` (a change/diff) against the plan — it *serves* a charter and never wanders project-wide. `verify` is inherently `charter`-scoped. |
| `--paths <globs/files>` | With `--scope charter`: the exact changed surface to audit (the diff). Auditors must stay within it. **To audit ONE subsystem** (not a diff, not the whole repo): keep `--scope project` but pass the subsystem's globs as `--paths` as a discovery root — lanes explore within them instead of wandering project-wide. |
| `--lanes <k,…>` | Restrict to specific lanes (keys: `appsec-secrets appsec-surface architecture supplychain quality cicd testing perf-sre`). |
| `--system <name>` | Force the task/spec system for `tasks`: `bmad` \| `spec-kit` \| `beads` \| `markdown` \| `issues` \| `file` (default: auto-detect per `docs/spec-systems.md`). |
| `--backend <b>` | Legacy alias for `--system` covering the file-based recipes: `beads` \| `planner` \| `file`. |
| `--beads-dir <path>` | Override the beads root (default: git root). For monorepos / multiple modules. |
| `--force` | In `tasks`, mirror findings into the chosen backend even if they already have a `task_ref` for a *different* backend. |

## Stance — discovery seeds a charter; scoped serves one

The `--scope` distinction is load-bearing: **`project`** = DISCOVERY (find anything across the
whole codebase — *seeds* a remediation charter; run standalone or to start `goal op-watch "ledger
clean"`); **`charter`** = SCOPED (audit only `--paths`, a change/diff, against the plan — *serves* a
charter; `verify` is always charter-scoped). **Never run discovery as an in-loop step of a
build/plan campaign** — re-importing the whole project's findings is the focus-loss a charter
prevents (inside `op-watch`, discovery runs only for a `ledger-clean` charter; build charters use
scoped audit + preflight). Full rationale: `references/operations.md`.

## Default — guided help (`--help` / no args)

When invoked with no action, `--help`, or `help`, **do not run agents**. Inspect state
and recommend the next step, so the user never fixes everything blindly in one pass:

1. Look for `audit-findings.json` under the audit dir (default `docs/audit/`).
2. **No ledger** → nothing audited yet. If the repo has real code → recommend
   `/op-audit run`. If it is **greenfield** (little/no code) → there is little to
   audit; instead route to the *planned* surface: if a backlog exists in the
   task/spec system, recommend `/op-audit run --spec` (audit the plan); otherwise
   recommend planning with **op-planner** or surveying existing work with
   **op-story-finder**. Briefly list what the recommended command will do.
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
   `args = { root, baseline, mode:"audit", knownFindings, lanes?, cheapModel?, capableModel? }`.
   **Pass `cheapModel`/`capableModel` via `args`** (read `OP_FANOUT_CHEAP_MODEL`/
   `OP_FANOUT_CAPABLE_MODEL` here, in-session — the sandboxed engine has no `process`/env, so env
   set there would throw; omit to use the engine defaults `haiku` / inherit-session).
   The engine fans out the lanes, adversarially verifies every High/Critical finding
   (refuted ones are dropped), scores survivors, and returns
   `{ sevCounts, totalEffort, domainSummaries, findings[], synthesis }`.
   **If the Workflow tool is unavailable, fall back to sequential `Task` agents — one per lane**
   (`--lanes` set, else the eight default lanes). Give each agent this shape: prompt = the audit
   baseline (confidentiality, refute-stance, cite `file:line`, never print secrets) + the lane's
   focus (from the lane table below) + the scope clause (whole repo for `project`, or `--paths` as
   the discovery root) + REUSE the `knownFindings` ids; **output = the ledger `findings[]` shape**
   from `references/methodology.md` — each finding carries `id` (mint `<DOMAIN-PREFIX>-<NN>`),
   `domain`, `title`, `location` (`file:line`), `severity`, `investor_risk_score`, `confidence`,
   `observation`, `impact`, `recommendation`, `effort_days`, and the `dimensions` sub-scores. Then
   **you** do the adversarial-verify pass the engine would (re-read each High/Critical at its cited
   `file:line`; drop refuted), score survivors, and merge. This is executable from this SKILL.md +
   `references/methodology.md` alone — no Workflow runtime required.
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

## Workflow — `run --spec` (audit the plan, not only code)

For greenfield/plan-heavy projects: audit the **planned backlog** (units in the task/spec system,
detected per `docs/spec-systems.md`) — one spec lane reviews units for missing/untestable ACs,
duplicate/orphan units, plan-vs-code drift, and contradictions. Findings join the same ledger under
domain `spec` (stable ids, same statuses), so they plan/verify/export like code findings. Use with a
code `run` or alone on a backlog with little code. Detail: `references/operations.md`.

## Workflow — `verify`

Targeted, cheap, **no full re-audit**. Select the finding(s) by ID (or all `open`/
`in_progress` for `--open`). Invoke Workflow with
`args = { root, baseline, mode:"verify", findings:[…selected…] }`. The engine returns
`{ resolutions:[{finding_id, resolution, evidence, notes}] }`. Apply:
`fixed → status:"verified"`; `partially-fixed → in_progress`; `still-open → open`;
`cannot-tell → leave + note`. **Verify teeth:** a `fixed`/`verified` verdict MUST
cite the `file:line` re-read **in this run** as evidence — "linter passed", "tests
pass", "the agent said done", or "should work" are NOT evidence of resolution and
keep the finding open. A finding moves to `wont_fix` only with a reason tied to a
declared scope exclusion or a new fact — never to clear the queue (no silent
demotion to "future work"). Append the evidence to the finding and to the tracker
issue (`bd note`/comment if exported). Write the ledger. Summarize what changed.

## Workflow — `tasks`

Export every `open`/`in_progress` finding that lacks a `task_ref` **into the project's task/spec
system** (detect per `docs/spec-systems.md`, or force `--system`): a BMAD story under an
audit-remediation epic · a spec-kit `tasks.md` row · a bead · a `gh issue` · a markdown task. The
`task_ref` is backend-tagged (`bd:…`, `epic-35 §…`, `gh:…`, `file`) so a finding is never
double-exported; the ledger stays the source of truth. **Anchor the tracker to the git root, NOT
cwd** (`ROOT=$(git rev-parse --show-toplevel)`). Backend = auto (`--backend beads|planner|file`):
beads when `bd` is on PATH (fully local), else planner (op-planner stories), else `file`
(`audit-tasks.md`). **Read `references/operations.md` for the full recipe** — the exact `bd
init`/CGO/`--server` quirks, the priority mapping, the `--beads-dir` monorepo override, and the
per-backend dedup rule — when you actually run an export.

## Workflow — `status`

Read the ledger only (no agents). Print: counts by status and severity, total open
remediation person-days, the top open risks by Investor-Risk score, and any
`regressed` findings (highlight these). Suggest the next action (`verify --open`,
`tasks`, or `run`).

## Output

Always end with the dashboard line: `Findings: <open> open · <verified> verified ·
<regressed> regressed · ~<days>d open effort` and a one-line next-step suggestion.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — action completed (audit ran / ledger updated / tasks exported / status shown).
- `DONE_WITH_CONCERNS` — completed but a lane failed, the toolchain was unavailable for
  proof, or some findings are unverifiable; list them.
- `BLOCKED` — repo unreadable, no audit dir writable, or the audit engine could not run.
- `NEEDS_CONTEXT` — unknown finding ID, invalid lane key, or ambiguous audit root.
