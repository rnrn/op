# Docs Taxonomy

Use this taxonomy to keep active instructions separate from plans, reference material, and evidence.

## Categories

| Category | Purpose | Examples |
|---|---|---|
| Current docs | Active operating and user guidance | `INDEX.md`, `HANDBOOK.md`, guides |
| Active plans | Work not finished yet | epics, stories, migration plans |
| Legacy reference | Historical or upstream notes | archived research, old decisions |
| Evidence | Proof of completed work | test reports, smoke logs, validation output |
| Feedback | Reusable preflight rules | `docs/feedback/*.md` |

## Rules

- Do not make legacy reference the active route unless `docs/INDEX.md` says so.
- Do not mix proof logs into active user guides.
- Do not hide active plans in reference folders.
- Update this file when adding a new docs category.
