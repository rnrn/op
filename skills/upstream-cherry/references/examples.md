# Upstream Cherry — Config Template, Security/Test Detail, Worked Examples

## Security review checklist (per proposed change)

Check: block patterns in the diff; sensitive files (flag for manual review);
new imports/dependencies; new HTTP/socket calls; filesystem access changes;
auth/authorization changes. Record a per-file checklist: no block patterns,
no new dangerous imports, no new network listeners, no credential changes,
compatible with the existing security layer.

## Isolation test categories

Each generated test is annotated with the upstream commit, file, and
recommendation:

- `test_<feature>_behavior` — behavior after patch matches expectations
- `test_<feature>_no_regression` — local_overrides are not affected
- `test_<feature>_security` — no dangerous/block patterns present

Cover the relevant categories: behavior, regression, security, schema
(idempotent migrations), config (new env vars have defaults), API (no
endpoint conflicts).

## Workflow configuration

Each project should have `workflow/<project>/config.yaml` with sections:

- `paths` — all paths
- `upstream` — remote, last_sync_commit, last_sync_date
- `local_overrides` — what not to touch
- `security` — sensitive_files, block_patterns, required_checks
- `relevance_filter` — include/exclude for files

### Minimal config.yaml template

```yaml
project:
  name: <PROJECT>
  language: <python|go|node|etc>

paths:
  source: "integration/<PROJECT>"
  upstream_clone: "../upstreams/<PROJECT>"
  docs: "../upstreams_docs/<PROJECT>"

upstream:
  remote: "<git URL>"
  last_sync_commit: "<commit hash>"
  last_sync_date: "<YYYY-MM-DD>"

local_overrides:
  description: "Changes made in integration/ on top of upstream"
  files: []

security:
  sensitive_files: []
  block_patterns:
    - "eval("
    - "exec("
    - "subprocess.Popen"
    - "__import__"
    - "os.system"

relevance_filter:
  include: ["*"]
  exclude: ["docs/*", ".github/*", "*.md"]
```

## Decision examples

### Example: upstream changed timeout in llm.py

```
File: core/llm.py
Upstream: timeout 120->180
Local override: timeout 120->900
Recommendation: SKIP (local override is more aggressive)
```

### Example: upstream added new tool

```
File: core/tools/new_tool.py (NEW)
Upstream: added PDF processing tool
Local override: no conflict
Recommendation: ADOPT
Security: check imports, file access patterns
Test: verify tool registers, doesn't conflict with existing
```

### Example: upstream changed security.py

```
File: core/security.py
Upstream: added new block pattern
Local override: none
Recommendation: ADOPT (after security review)
Security: SENSITIVE FILE — requires manual review
Test: verify all existing patterns preserved + new one added
```
