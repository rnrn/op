# Planner Conventions

**Contents:** [File Naming Conventions](#file-naming-conventions) · [Track Detection Rules](#track-detection-rules) · [Acceptance Criteria Guidelines](#acceptance-criteria-guidelines) · [Scope Rules](#scope-rules) · [MVP vs Production](#mvp-vs-production) · [Status Flow](#status-flow)


Reference material for track detection, naming, acceptance criteria, scoping,
and status flow. Loaded on demand from SKILL.md.

## File Naming Conventions

- Tracks: `docs/<component>/` — match existing project structure or service
  names (e.g., `docs/frontend/`, `docs/backend/`, `docs/api/`, `docs/auth/`).
- Epics: `epic-N-<name>.md` (e.g., `epic-1-authentication.md`).
- Stories: `story-N.M.md` where N is the epic number and M the story number.

## Track Detection Rules

The path examples below are illustrative, not a closed set — derive tracks
from the project's actual top-level structure and language, whatever the
stack (a Fyne GUI app may yield `ui`/`platform`, an ML pipeline
`pipeline`/`harness`, a library `core`/`api`).

When determining which track folder to use in `docs/`:

1. **Check existing tracks first** — list `docs/*/`; if the request clearly
   fits an existing track, use it.
2. **Extract from file references** —
   `frontend/src/Component.tsx` -> `frontend`;
   `server/api/routes.py` -> `server`;
   `packages/auth/...` -> `auth`.
3. **Detect from project structure** — top-level folders that indicate
   services/components: `frontend/`, `backend/`, `server/`, `client/`,
   `packages/<name>/`, `services/<name>/`, `apps/<name>/`. Map the affected
   component to a track name.
4. **Semantic naming (fallback)** — name the track after the primary feature
   area; short lowercase names (`api`, `auth`, `users`, `payments`). Avoid
   prefixes like `cli-` unless the project is actually a CLI tool.

**Examples:**

| Request | File Reference | Track |
|---------|---------------|-------|
| "Add login to frontend" | `frontend/src/...` | `frontend` |
| "Fix API rate limiting" | `server/routes/...` | `server` |
| "Add payment webhook" | `services/payments/...` | `payments` |
| "Improve CLI help" | `src/cli/...` | `cli` |
| "Add user dashboard" | (none) | `users` or `dashboard` |

## Acceptance Criteria Guidelines

Each AC MUST be:

- **Specific:** exact behavior, not vague ("shows error" -> "shows 'Invalid
  email' message").
- **Testable:** verifiable with code or a manual test.
- **Scoped:** one layer only (backend OR frontend).

Bad AC:

- "Appropriate error handling" (vague)
- "Breaking changes only in major versions" (policy, not testable code)
- "Load tested with 10x traffic" (production, not MVP)

Good AC:

- "Returns 429 status when rate limit exceeded"
- "Shows toast notification on save failure"
- "Logs failed login attempts to audit table"

## Scope Rules

**One story = one layer/subsystem of the project's actual architecture.**
Backend/frontend/infrastructure is the web example; for a desktop app the
layers might be core/UI/platform, for an ML pipeline stage/harness/infra,
for a library API/internals/packaging:

- Backend only (API, services, database)
- Frontend only (UI, components, state)
- Infrastructure only (DevOps, CI/CD, deployment)

If a feature requires multiple layers, create SEPARATE stories:

- "Story 2.1: Add rate limiting - Backend"
- "Story 2.2: Add rate limiting - Frontend UI"

Never mix in one story: backend code + UI components, API changes + deploy
config, database schema + UI forms.

## MVP vs Production

Mark stories with a scope indicator:

- **[MVP]** — core functionality, basic happy path.
- **[Production]** — scaling, monitoring, edge cases.

For MVP stories, skip load testing, distributed systems, advanced monitoring,
caching layers (unless a core requirement), and multi-region deployment.
Include basic functionality and error handling, simple tests (unit + basic
integration), and essential logging.

## Status Flow

```
TODO -> in-progress -> review -> done
           ^             |
           +-- blocked <-+
```

| Status | Description |
|--------|-------------|
| `TODO` | Story created, ready for assignment |
| `in-progress` | Developer actively working |
| `review` | Implementation done, awaiting QA |
| `blocked` | QA returned with issues |
| `done` | QA approved, story complete |

The planner creates stories with `TODO` status. SM assigns (-> in-progress),
DEV implements (-> review), QA verifies (-> done or -> blocked).
