---
name: runtime-map-updater
description: Maintain an interactive HTML runtime/architecture map of a project as a verified artifact synced from its authoritative docs and open tasks. Use when adding or removing stack components or services, when the architecture diagram drifted from code/docs, when refreshing the map's node detail panels or open-task chips, or when checking the map's interaction contract mechanically.
metadata:
  safety-class: checkpoint
---

# Runtime Map Updater

Maintain `docs/presentations/<project-slug>-runtime-map.html` as a **verified architecture view, not a manually curated poster**: every node is backed by an authoritative doc or manifest, every task chip by a real open task, and the interaction contract is checked by a script.

## Safety Contract

Writes only the map HTML itself, plus — when the project declares them and the
change requires it — the component-catalog doc it mirrors and the e2e spec that
covers the map. Nothing else. Never touch application runtime code while
refreshing this docs artifact; leave unrelated dirty-worktree changes untouched.
Write files only — never run `git add`, `git commit`, or `git reset`; staging
and commits belong to the user or the `baby-commit`/`dry-commit` skills.

## Usage

```
/runtime-map-updater [path]          # sync the map for the project at path (default: cwd)
```

## Workflow

1. **Resolve sources from the project's declared layout, never from built-in names.** Read `AGENTS.md`/`CLAUDE.md` pointers and `docs/spec-systems.md` when present; fall back to detection: an architecture/stack/components doc (`docs/**/architecture.md`, a stack-components guide, `docs/SUBSYSTEMS.md`-like catalogs), runtime blueprints, and the open-task source — BMAD stories (`docs/**/stories/*.md`) or flat epics (`docs/EPIC_*.md`, `docs/tasks/*.md` with `### Task N — STATUS` or `## UNIT-ID (status)` units). Zero hits next to visible epic files = detection miss, not an empty backlog.
2. **Treat code and manifests as authoritative when the docs differ** — service names from `docker-compose*.yml`, workspace manifests, or the build tree; update the catalog doc in the same change, never the map alone.
3. **Only open tasks reach node panels — and every refresh re-slices them.** The task slice is recomputed from the epics' current state on each HTML update (the backlog is assumed maintained by the op-* skills — op-planner/op-story-finder file units, op-watch closes them), so the map always shows live debt, never a remembered snapshot. The unit heading is the canonical status; `PLANNED`, `IN_PROGRESS`, `WATCH`, and `BLOCKED` stay visible; closed tokens (`DONE`, `PROVEN`, `CLOSED`, `CANCELLED`, `verified`, `dropped`, and their project-local equivalents) must be absent from `nodeDetails`. Search the whole epic for duplicate decisions before changing a status.
4. **Keep the diagram readable by responsibility grouping.** Primary request/flow path in one horizontal lane; direct dependencies under the stage that calls them; an edge only for a causal runtime flow (shared platform blocks do not get arrows to every consumer); the return/feedback stream routed through one perimeter lane instead of crossing the main path. When the project declares a component catalog, every catalog entry appears exactly once via a `data-service` attribute.
5. **Every `.node[data-node]` gets a matching `nodeDetails` entry**: a responsibility summary, exactly three execution steps, exactly three boundary statements, and zero or more open-task references. A block is whatever the project's docs declare as its operating unit — services, subsystems, or skills; adapt to the project, never force one taxonomy. The scenario bar opens with a whole-system view (`data-scenario="all"`, selected by default — everything lit); the all-tasks dialog is the second button. An empty task list means no verified open debt — never retain a closed task to keep the list non-empty. Derive epic chips and the aggregate task table from `nodeDetails` (no second task catalog); one shared epic-selection state for node details and the all-tasks dialog; aggregate each task once by epic/task reference listing every participating node.
6. **Preserve the visual/interaction contract.** Mechanical minimum (what the validator checks): desktop detail panel `min(800px, 50vw)` at `max-height: 80vh`, vertically centered; zoom-out compensation from the load-time DPR baseline (never neutralize zoom-in); mobile panel inside the viewport, no horizontal overflow; all detail text at 14px or larger; the aggregate block list ellipsized with a fixed-position tooltip outside the scroll panel; keyboard open/close, focus return, Escape, backdrop, reduced-motion. **The full look is a stated contract too — when creating a NEW map or restyling, read `references/design-language.md` first** (tokens, hand-drawn primitives, node/edge/panel/dialog anatomy, motion): a map built only to the validator's regexes reads as a wireframe. When updating an existing map, preserve its refinements — never regress styling to the mechanical minimum.
7. **Update the project's e2e spec for the map when one exists** (nodes, services, scenario routes, epic filters, aggregate rows, or dialog behavior changed); absent spec, note it and move on.

## Validation

Run from the repository root (flags optional — absent catalog/tasks sources are skipped with a note, not failed):

```
node scripts/validate-runtime-map.mjs --map docs/presentations/<slug>-runtime-map.html \
  [--catalog docs/<stack-doc>.md] [--tasks-dir docs/tasks]
```

The script checks catalog↔`data-service` parity, node↔`nodeDetails` parity, the detail-panel interaction contract, stale hard-coded task counts, and that every referenced task exists and is still open. A structural pass is not visual proof — inspect desktop and mobile renders before calling the artifact done.

## Guardrails

- Do not expose secrets, provider keys, host paths, or internal user data in the map.
- Do not add a service from an aspirational note unless a manifest or code confirms it; label optional services as optional.
- Do not hard-code a total of open tasks; describe a dated review scope or generate the count.
- Do not alter application runtime code while refreshing this docs artifact.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — map synced, validator green, no drift left between docs/manifests and the map.
- `DONE_WITH_CONCERNS` — map synced but something needs follow-up (catalog doc updated alongside, e2e spec pending, visual render unverified); list it.
- `BLOCKED` — required sources missing (no architecture/catalog doc resolvable) or the map file cannot be written.
- `NEEDS_CONTEXT` — the project root or the map's source-of-truth docs are ambiguous; name what is needed.
