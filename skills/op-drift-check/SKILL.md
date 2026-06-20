---
name: op-drift-check
description: Compare architecture/PRD documentation against actual code and report divergences classified as CRITICAL, WARNING, or INFO. Use when the user asks to check architecture drift, verify docs still match code, or audit documentation accuracy after changes. Read-only; doc/code edits require explicit --fix plus confirmation.
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*)
metadata:
  safety-class: read-only
---

# Drift Check Skill

Compare project documentation against actual code to find divergences: stack claims that no longer hold, documented features that do not exist, and code features the docs never mention. Each finding is classified by severity so the team knows what to fix first.

## Read-Only Contract

This skill never creates, modifies, or deletes files. The report goes to the
conversation only. One exception: `--fix` is the explicit mutation gate (like
`--apply`) — only when the user passed `--fix` in the same request may the
skill propose specific doc or code changes, and it must still ask the user to
confirm before applying any of them.

## Usage

```
/op-drift-check
/op-drift-check --doc docs/api/architecture.md
/op-drift-check --fix
```

| Argument | Meaning |
|----------|---------|
| `--doc <path>` | Check only the specified document |
| `--fix` | For each CRITICAL/WARNING finding, suggest specific doc updates OR code changes and ask the user to confirm before making changes (mutation gate) |
| `--dry-run` | Force report-only output even if `--fix` was given; never modify files |

## Workflow

1. **Find architecture documents:** search `docs/**/architecture.md` and `docs/**/prd.md`; prefer `docs/HANDBOOK.md`, `docs/docs-taxonomy.md`, `docs/subsystem-doc-contracts.md`, `docs/task-intake.md`, and active index files when present; read the specified `--doc` if provided.
2. **Extract documented claims:** tech stack, file structure, dependencies, owner subsystem, config source of truth, runtime rung, proof path/commands — plus the claim surfaces that exist for this project's archetype: API endpoints / DB schema / auth flow for services; screens, views, commands, and shortcuts for GUI or CLI apps; pipeline stages, datasets, and metrics for ML projects; the public API for libraries. Do not demand surfaces the archetype does not have.
   - **CURRENT/TARGET convention:** when a doc marks sections `CURRENT` and `TARGET`, only CURRENT sections form the drift baseline. TARGET sections are planned work — they must not produce CRITICAL/WARNING findings (at most an INFO "target not yet realized"). Docs without markers: treat everything as CURRENT.
   - **Audit stamp:** if the doc carries a `Known Drift (audited <date>)` stamp, report when it is stale relative to the changes found. Updating the stamp is a doc edit — allowed only under the `--fix` confirmation gate.
3. **Analyze actual code:** dependency manifests (`go.mod`, `package.json`, `requirements.txt`/`pyproject.toml`, `Cargo.toml`, `pom.xml`/`build.gradle`, `*.csproj`, `composer.json`, `Gemfile` — an open set: use whatever the project's stack provides); the actual archetype surfaces from step 2 (routes/handlers and migrations/models for services, screen/command registrations for GUI/CLI, stage/config definitions for pipelines, exported API for libraries); actual file structure vs documented; duplicate command paths, compatibility wrappers, legacy docs linked from active guides, and settings written from multiple sources.
4. **Verify each claim against the code** and check the code for undocumented features. **Refute stance:** default to "this doc claim is stale" and prove it still holds by citing the code (`file:line` / symbol) that backs it; a claim you cannot positively confirm against the code is at least a WARNING ("unverifiable — no backing code found"), not a silent pass.
   - **Dead-public-surface check:** a symbol, module, or feature exported from a package/feature index that nothing else in the codebase references is at least an INFO finding; raise to WARNING when the docs require it to be mounted or used.
   - **Doc-vs-doc duplication check:** a `docs/feedback` rule (or any active doc) that *restates* an invariant already owned by a source-of-truth doc, rather than pointing to it, is an INFO finding — two prose copies of one rule are a latent drift source; recommend collapsing the restatement to a pointer.
5. **Classify each finding:**

   | Severity | Meaning | Example |
   |----------|---------|---------|
   | CRITICAL | Doc says X, code does Y | Doc says PostgreSQL, code uses SQLite |
   | WARNING | Doc mentions feature not in code | Documented endpoint doesn't exist |
   | INFO | Code has feature not in docs | New endpoint not documented |

6. **Generate the report** with severity levels. With `--fix`, additionally suggest specific changes per CRITICAL/WARNING finding and wait for user confirmation before editing anything.

## Output

```
## Architecture Drift Report

### CRITICAL
- [tech-stack] Doc: PostgreSQL | Code: SQLite (go.mod has mattn/go-sqlite3)
- [auth] Doc: JWT tokens | Code: session-based (no JWT library found)

### WARNING
- [endpoint] GET /api/users documented but not found in routes
- [file] docs/api/architecture.md references src/middleware/ which doesn't exist
- [dead-export] features/backend-status exported from its index but mounted nowhere; doc requires it on the map page

### INFO
- [endpoint] POST /api/webhooks exists in code but not documented
- [dependency] github.com/redis/go-redis in go.mod but not in architecture doc
- [source-of-truth] provider timeout is documented in two active guides with different owners
- [doc-duplication] docs/feedback/frontend.md restates the routes-centralized invariant already owned by architecture.md — collapse to a pointer

### Summary
- Critical: 2 | Warning: 2 | Info: 3
- Recommendation: Update architecture.md to reflect current implementation
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — drift report generated (and confirmed fixes applied, if `--fix`).
- `DONE_WITH_CONCERNS` — report generated but some claims could not be verified; list them.
- `BLOCKED` — no architecture/PRD documents found to compare against.
- `NEEDS_CONTEXT` — `--doc` path does not exist or scan root is ambiguous.
