---
name: op-tour
description: Interactive project onboarding guide that analyzes project structure, docs, dependency manifests, and recent git activity to generate a guided walkthrough. Use when onboarding to an unfamiliar project, when the user asks for a tour, "explain this project", "how do I get started here", or wants one section such as architecture or setup. Read-only.
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git status:*)
metadata:
  safety-class: read-only
---

# Tour Skill (Project Onboarding)

Generate a guided tour of a project for a new team member: what it is, how it is built, where the key files live, how to run it, and how work flows through it. The tour is assembled from the project's own docs and structure, not invented.

## Read-Only Contract

This skill never creates, modifies, or deletes files. The report goes to the
conversation only.

## Usage

```
/op-tour
/op-tour --section architecture
```

| Argument | Meaning |
|----------|---------|
| `--section <name>` | Generate only one section: `architecture`, `setup`, `testing`, `workflow`, or `status` |

## Workflow

1. **Detect project type** from file structure: monorepo (multiple packages/services), single service (API, worker), library/SDK, CLI tool, full-stack app (frontend + backend), desktop/mobile GUI app, ML/data pipeline, embedded/firmware, game, or plugin/extension. If none fits, describe the archetype actually found — do not force the nearest listed one.
2. **Read key files** when present: `README.md`, `AGENTS.md` / `CLAUDE.md` / project instruction files (including a declared Stack Profile), `docs/HANDBOOK.md`, `docs/task-intake.md`, `docs/docs-taxonomy.md`, `docs/subsystem-doc-contracts.md`, `docs/project-boundaries.md`, `docs/build-profiles.md`, `docs/**/architecture.md`, `docs/**/prd.md`, `docker-compose.yml`, and dependency manifests (`go.mod`, `package.json`, `Cargo.toml`, `pom.xml`/`build.gradle`, `*.csproj`, `requirements.txt`/`pyproject.toml`, `composer.json`, `Gemfile` — whatever the project's stack uses).
3. **Check for BMAD/project-method structure**: `docs/*/epics/`, `docs/*/stories/`, `.taskmaster/`.
4. **Generate the tour sections**:
   - **Section 1: What Is This?** — name, purpose, goals (from PRD/README); who uses it and why.
   - **Section 2: Architecture** — high-level architecture (from architecture.md or inferred), key components and interactions, tech stack and why it was chosen.
   - **Section 3: Key Files** — entry points (`main.go`, `index.ts`, ...), configuration files, core business logic locations, test locations.
   - **Section 4: Getting Started** — prerequisites, setup steps (from README or docker-compose), how to run locally, how to run tests.
   - **Section 5: Development Workflow** — how a task moves from User Spec to epic/story, op-preflight, implementation, proof, op-docup, and closeout; which subsystem owns each major area and which docs are source of truth; whether `docs/project-boundaries.md` and `docs/build-profiles.md` exist or are explicitly `N/A`; how to test and deploy; sprint/story workflow if `.taskmaster/` exists.
   - **Section 6: Current State** — active sprint status, last 5 commits (`git log`), open stories/tasks.
5. If `--section` is specified, output only the requested section.
6. Output the tour to the conversation.

## Output

Clear, readable markdown: headers per section, code blocks for commands, file paths as links where possible, brief actionable descriptions — not walls of text. Sample:

```markdown
# Tour: acme-gateway

## Section 1: What Is This?
acme-gateway is a reverse proxy that routes tenant traffic to backend pools
(docs/gateway/prd.md). Used by platform operators to onboard new tenants.

## Section 4: Getting Started
Prerequisites: Go 1.22, Docker.

    docker compose up -d postgres
    go run ./cmd/gateway
    go test ./...

## Section 6: Current State
Last 5 commits: routing retry fix, TLS config refactor, ...
Open stories: docs/gateway/stories/story-3.2.md (in-progress)
```

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — full tour (or the requested section) generated.
- `DONE_WITH_CONCERNS` — tour generated but key docs are missing or stale; list them.
- `BLOCKED` — project root unreadable or effectively empty.
- `NEEDS_CONTEXT` — ambiguous project root or invalid `--section` value; state what is needed.
