Harvest tasks from documentation into a BMAD backlog. Scans the markdown files
under the given path (default: `docs/`), extracts tasks, groups them into
epics, and creates stories via the op-planner skill. The extraction, grouping,
prioritization, and duplicate-check logic lives in the doc-harvester agent —
that file is the single source of truth.

## Arguments

Arguments: $ARGUMENTS

- `<path>` — folder to scan (default: `docs/`)
- `--dry-run` — preview what would be created; create no files, invoke no skills
- `--epic=NAME` — use this epic for all tasks
- `--priority=P0|P1|P2` — set this priority for all tasks

## Implementation

Launch the **doc-harvester agent** with the arguments and let it run to
completion. Do not stop until the agent prints `HARVEST_COMPLETE` (or the
dry-run preview when `--dry-run` is set).

@doc-harvester $ARGUMENTS
