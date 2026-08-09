# Feedback Scaffold And Baseline Reference

Canonical file list for the preflight scaffold. Bootstrap these files only
when the user explicitly asks for the scaffold; otherwise recommend them in
the report.

## Minimal Feedback Scaffold

- `docs/feedback/index.md` — selector, priority order, and links to rule
  files. The canonical rule entrypoint; baseline rules are routed by it.
- `docs/feedback/baseline.md` — required baseline checklist groups.
- `docs/feedback/process.md` — how feedback is harvested from bugs, reviews,
  and commits.

Keep project-specific incident rules in separate feedback files routed by the
index.

## Operating-Contract Docs (new or reorganized project)

For a new or reorganized project using the project-method scaffold, also
create or request:

- `AGENTS.md` — repository-level agent rules and validation expectations.
- `docs/INDEX.md` — documentation map and user journey entrypoint.
- `docs/HANDBOOK.md` — project operating handbook.
- `docs/task-intake.md` — path from user request to User Spec, epic/story,
  implementation, proof, and closeout.
- `docs/docs-taxonomy.md` — active/reference/archive documentation categories.
- `docs/subsystem-doc-contracts.md` — subsystem owners, contracts, tests, and
  forbidden overlaps.
- `docs/project-boundaries.md` — code/module/runtime ownership boundaries;
  required unless the project explicitly marks it `N/A` with rationale.
- `docs/build-profiles.md` — build/runtime profiles; required when the
  project has more than one deploy/runtime/package surface, otherwise mark
  `N/A` with rationale.

## Baseline Rule Shape

`docs/feedback/baseline.md` should provide these minimum checklist groups:

- plan: scope, selected feedback, contradictions, invariants, validation
- blockers: missing secrets, access, runtime, dependencies, or integration
  prerequisites
- baseline: target files read, existing validation status known, dirty
  worktree risk understood
- implementation safety: referenced paths/imports exist, existing patterns
  checked, tests or evidence planned
- security and orchestration: secret/key identity, shell/path/context
  injection, integration point, producer/consumer contract
- PR/security risk: authority expansion, secret exposure, network/proxy path,
  dependency provenance, generated code execution, CI/deploy impact
- artifact installation: rules/skills/commands/hooks/agents/MCP separation,
  harness capability check, format validation, minimal install surface

If a project does not have `baseline.md`, treat these groups as `WATCH` and
recommend adding the file before non-trivial implementation. If the task
touches skills, prompts, workflow, docs, or agent orchestration and
`rules-and-skills.md` is missing, mark that rule area as `WATCH`.
