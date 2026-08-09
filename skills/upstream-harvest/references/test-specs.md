# Upstream Harvest — Test Specifications

Two test files are generated in apply mode.

Language: write the tests in the upstream's primary language or the host
project's established test ecosystem — the Python shapes below show the
required structure, not a required language. Validation categories are
selected per archetype: API endpoints / DB tables only when the upstream is a
service; for a CLI test its commands and flags, for a library its exported
API, for an ML project its pipeline stages and metrics, for a GUI its
screens/components.

## A) Documentation validation test

Path: `upstreams_docs/<PROJECT>/tests/test_docs_accuracy.py`

Checks that documentation matches code:

```python
#!/usr/bin/env python3
"""Validate BMAD BMM docs against source code."""

# Validation categories (adapt per project):
# 1. Source files referenced in stories exist
# 2. Functions/classes mentioned exist
# 3. API endpoints (if web framework)
# 4. DB tables/columns (if database)
# 5. Config variables and defaults
# 6. Tool/plugin definitions (if any)
# 7. Documentation structure (INDEX, epics, stories count)
```

Test requirements:

- Standalone: `python tests/test_docs_accuracy.py --source <path>`
- Via pytest: `pytest tests/test_docs_accuracy.py -v`
- Accept paths via args or env vars (`<PROJECT>_SOURCE`, `<PROJECT>_DOCS`)
- Check EVERY AC from stories where possible

## B) Air-gap test

Path: `tests/test_upstream_patch_<project_lower>.py`

Checks that the integration/ copy is intact:

```python
#!/usr/bin/env python3
"""Air-gap tests for <PROJECT> upstream cherry-pick."""

# Categories:
# 1. Local overrides preserved (if integration/ copy exists)
# 2. Security patterns (dangerous calls, credentials)
# 3. Schema integrity (if DB)
# 4. Config compatibility (defaults, ports)
# 5. API surface (endpoints not removed)
# 6. Core behavior (key functions exist, correct libraries used)
# 7. Upstream delta tracking (diffs documented in config.yaml)
```

If `integration/<PROJECT>/` doesn't exist — create only the docs test (A),
skip the air-gap test (B).

## Running and fixing

```bash
python <docs>/tests/test_docs_accuracy.py --source <upstream_clone>
python -m pytest tests/test_upstream_patch_<project>.py -v   # if integration/ exists
```

If tests fail, the docs don't match the code — fix the stories and rerun.
