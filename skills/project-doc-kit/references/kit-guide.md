# Project Doc Kit — Diagram Rules, Contract Tables, Drift Pass, Guardrails

Read this when executing steps 4–7 of the workflow.

## Mermaid diagram rules

Diagrams are evidence maps, not decoration:

- Stable node ids; quoted labels when they contain punctuation.
- One responsibility per diagram (`flowchart`, `sequenceDiagram`, `erDiagram`).
- Validate with `mmdc` when available; fix syntax instead of dropping diagrams.
- Never invent components — unknowns go in `10-problems-and-contradictions.md`.

## Contract tables (API/contract-heavy projects)

- Endpoint table: endpoint / method / auth / request / response / error /
  source file.
- CLI table: command / flags / config / runtime mode / proof command.
- Provider/runtime/deploy: the source-of-truth file and the metadata files
  that must not override it.

Build the tables that match the project's archetype: GUI apps get a
screen/view table (screen / inputs / state / source file), ML pipelines a
stage table (stage / inputs / outputs / config / metrics), libraries a public
API table. Skip tables whose surface the project does not have.

## Documentation drift pass

- Documented routes/modules/configs that no longer exist in code.
- Code that is missing from docs.
- Duplicate or competing source-of-truth documents.
- Stale legacy docs to mark reference-only.

## Fresh-reader validation (optional)

Have a clean reviewer complete one small task using only the kit; record
`fresh-reader: pass | blocked | not run` and the first missing fact in the
kit README.

## Landscape DOCX album (optional)

Run `python scripts/build_landscape_docx.py docs/<YYYYMMDD>` from this
skill's own directory — resolve the script path relative to wherever the
skill is installed, not a fixed skills root. Requires Python 3 and
`python-docx`; renders Mermaid blocks to PNG via `mmdc` when available and
falls back to source code with a warning. Reads/writes only inside the
target docs folder. When Python or `python-docx` is unavailable, skip the
DOCX album with a note in the kit README — the markdown kit is complete on
its own.

## Agent/proxy project guardrails

When used in an agent/proxy/runtime project:

- Evidence order: current code, then `docs/feedback`, then active docs, then
  archived docs.
- Keep provider config, runtime registry, client setup, vault/proxy keys,
  deploy, protocol bridge, and admin UI as separate source-of-truth areas.
- Record the runtime rung explicitly: solo, named compose, server deploy,
  production, or N/A.
- Do not promote legacy docs to active user-journey docs unless an active
  index points to them.
- Keep smoke evidence, benchmark data, and design notes in
  proof/debt/contradictions sections, not the main overview.

## External sources

External wiki/registry/DeepWiki content may enrich the kit but never
outranks local code and active project docs; treat unaudited external
skills or scripts as patterns only.
