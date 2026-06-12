---
name: test-runner
description: Dynamically determines and runs tests in the appropriate container. Use when you need to run tests and don't know which container to use.
tools: Bash, Read
---

# Test Runner Agent

Agent for dynamically detecting and running tests in the correct container.

## Rule zero: the project's declared test command wins

If the project declares a test/proof command — in `AGENTS.md` (Stack
Profile), `CLAUDE.md`, or `docs/HANDBOOK.md` (Proof Standard) — run THAT
command and skip auto-detection entirely. Everything below is the fallback
path for projects that declare nothing. Likewise, the container flow assumes
Docker Compose: when the project has no compose file or runs tests locally
(`go test ./...`, `cargo test`, `dotnet test`, `mvn test`, a local venv or
node_modules), run the detected command directly on the host instead of
searching for a container.

## Purpose

- Do NOT hardcode container names
- Detect the test type (pytest, jest, vitest, go test, cargo test, dotnet test, etc.)
- Find a suitable container to run in (or run locally — see rule zero)
- Log results with a SESSION_ID

## Algorithm

### Step 1: Gather test information

Accept arguments:
- `--type=pytest|jest|vitest|npm` — test type (optional, auto-detected)
- `--path=tests/` — path to tests (default: tests/)
- `--session=SESSION_ID` — session ID for logging

### Step 2: List running containers

```bash
docker compose ps --services --status running
```

Example output:
```
app
app-dev
app-serena-mcp
```

### Step 3: Detect the test type

If `--type` is not given, detect automatically:

1. Check for marker files:
```bash
ls -la pytest.ini pyproject.toml tests/*.py 2>/dev/null
ls -la jest.config.* vitest.config.* package.json 2>/dev/null
```

2. File-to-type mapping (open set — use the stack's native runner):
   - `pytest.ini`, `pyproject.toml`, `tests/*.py` -> pytest
   - `jest.config.*` -> jest
   - `vitest.config.*` -> vitest
   - `package.json` with a test script -> npm test
   - `go.mod` -> `go test ./...`
   - `Cargo.toml` -> `cargo test`
   - `*.csproj`/`*.sln` -> `dotnet test`
   - `pom.xml`/`build.gradle` -> `mvn test` / `gradle test`

### Step 4: Pick a container

Selection strategy:

| Test type | Container priority |
|-----------|--------------------|
| pytest | *-backend, *-api, * (with python) |
| jest/vitest | *-frontend, *-web, * (with node) |
| npm test | *-dev, * (with node) |

```bash
# For pytest — look for a container with python
for service in $(docker compose ps --services --status running); do
    if docker compose exec $service python --version 2>/dev/null; then
        echo "Found python in: $service"
        break
    fi
done
```

### Step 5: Run the tests

```bash
SESSION_ID="${SESSION_ID:-unknown}"
LOG_FILE=".logs/${SESSION_ID}/test-$(date +%H%M%S).log"

mkdir -p "$(dirname $LOG_FILE)"

echo "[${SESSION_ID}] Running tests in container: $CONTAINER" | tee -a "$LOG_FILE"

# For pytest:
docker compose exec $CONTAINER python -m pytest tests/ -v --tb=short 2>&1 | tee -a "$LOG_FILE"

# For jest/vitest:
docker compose exec $CONTAINER npm test 2>&1 | tee -a "$LOG_FILE"
```

### Step 6: Return the result

```
TEST_RESULT

Container: app
Test type: pytest
Exit code: 0
Status: PASSED

Log: .logs/session-xxx/test-143022.log

Summary:
  5 passed, 0 failed
```

Or on failure:

```
TEST_RESULT

Container: app
Test type: pytest
Exit code: 1
Status: FAILED

Log: .logs/session-xxx/test-143022.log

Failed tests:
  - tests/test_api.py::test_login
  - tests/test_api.py::test_register
```

## Fallback strategy

If no suitable container is found:

1. Try running in a *-dev container
2. If there is no *-dev — print an error with instructions

```
ERROR: No suitable container found for pytest tests.

Available containers:
  - app-serena-mcp (no python)

Please ensure a container with Python is running:
  docker compose up -d app-dev
```

## Rules

1. **NEVER** hardcode container names
2. **ALWAYS** verify the runtime exists in the container before running
3. **ALWAYS** log with the SESSION_ID
4. **RETURN** the exit code for downstream handling
