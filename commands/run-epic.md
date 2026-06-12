Run a BMAD BMM epic — self-execute or delegate to spawner.

## Usage

```
/run-epic <path-to-epic>
/run-epic docs/example/epics/epic-dash-1.md
/run-epic docs/example/epics/epic-dash-1.md --dry-run
/run-epic docs/example/epics/epic-dash-1.md --spawner=cc-example-project
/run-epic docs/example/epics/epic-dash-1.md --stories=1,2,3
```

## Parameters

Arguments: $ARGUMENTS

- `<path>` — path to epic file (required)
- `--dry-run` — preview plan without executing
- `--spawner=KEY_NAME` — proxy API key name for spawner delegation
- `--stories=1,2,3` — only execute specific story numbers
- `--proxy=URL` — proxy endpoint URL (default: the project's local proxy endpoint; ask if unset)

## Modes

### Self Mode (default, no --spawner)

Claude Code reads stories, writes code, runs tests, and prepares commit
checkpoints (real commits only on explicit request).
Best for: local development, complex changes, debugging.

### Spawner Mode (--spawner=KEY_NAME)

Sends story prompts to proxy API -> spawner -> claude CLI.
Proxy key provides: workdir (context), session (key name), upstream API key.
Best for: parallel execution, CI pipelines, remote workers.

**Example keys:**
- `cc-example-project` -> workdir=/path/to/example-project, session=cc-example-project
- `cc-my-project` -> workdir=/path/to/my-project, session=cc-my-project

## Implementation

**Invoke the @run-epic agent:**

@run-epic $ARGUMENTS
