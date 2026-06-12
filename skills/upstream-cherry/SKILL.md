---
name: upstream-cherry
description: Cherry-pick useful changes from upstream projects with air-gap testing — analyzes upstream diffs, runs a security review, and proposes ADOPT/ADAPT/SKIP/BLOCK decisions with isolation tests. Use when the user wants to sync upstream changes, review what is new in upstream, or safely adopt specific upstream features. Default mode writes only the proposal document and isolation tests; touching integration/ requires explicit --apply.
metadata:
  safety-class: checkpoint
---

# Upstream Cherry-Pick with Air-Gap Testing

Safe transfer of useful upstream changes into `integration/` with barrier-test generation. Tests are written BEFORE changes are applied; an upstream change that breaks a test is blocked.

## Safety Contract

Default mode writes only the proposal document
(`<docs>/upstream-proposals/proposal-<date>.md`) and the isolation tests
(`tests/test_upstream_patch_<project>.py`) — together they are this skill's
checkpoint. Do not create, modify, or delete anything else — in particular
anything under `integration/` — unless the user explicitly passed `--apply`
in the same request.

## Usage

```
/upstream-cherry LocalTaskClaw              # Analyze, propose, generate tests
/upstream-cherry LocalTaskClaw --apply      # Apply approved changes
/upstream-cherry LocalTaskClaw --dry-run    # Only show diff
/upstream-cherry LocalTaskClaw --security   # Enhanced security review
```

## Paths

From `workflow/<PROJECT>/config.yaml` `paths.*` if present, else: integration copy `integration/<PROJECT>`, upstream clone `../upstreams/<PROJECT>`, BMAD BMM docs `../upstreams_docs/<PROJECT>`, air-gap tests `tests/test_upstream_patch_<project>.py`.

## Workflow

1. **Load configuration** — `workflow/<PROJECT>/config.yaml`: paths, `upstream.last_sync_commit` (analysis start), `local_overrides` (what NOT to touch), `security.sensitive_files` (manual review), `security.block_patterns` (auto-block). If absent, use default paths and create a minimal config from the template in `references/examples.md`.
2. **Analyze upstream changes** — `git pull` the clone, then `git log <last_sync_commit>..HEAD --oneline --no-merges` and per-file `git diff`. Apply `relevance_filter`; ignore files in `exclude`.
3. **Classify changes** — per changed file record: Type (bugfix | feature | refactor | security | config), Priority (P0 | P1 | P2), Risk (low | medium | high, plus local_overrides conflicts), what changed + key diff lines, and Recommendation: ADOPT (as-is) | ADAPT (modify for local_overrides) | SKIP | BLOCK (security concern). Worked decisions: `references/examples.md`.
4. **Security review** — for EACH proposed change run the per-file checklist in `references/examples.md` (block patterns, sensitive files, new imports/network/filesystem/auth changes).
5. **Generate isolation tests (BEFORE applying)** — for each ADOPT/ADAPT change, create/update `tests/test_upstream_patch_<project>.py` covering behavior, no-regression, and security per the categories in `references/examples.md`.
6. **Write the proposal** to `<paths.docs>/upstream-proposals/proposal-<date>.md` (shape under Output).
7. **Apply (only with --apply)** — run the generated tests (must pass on the unchanged tree); copy each ADOPT file from the clone into the integration copy; for ADAPT copy then re-apply local_overrides; rerun tests; on failure rollback via `git checkout -- <file>`; update `last_sync_commit`/`last_sync_date` in config.yaml.

## Output

The proposal document must follow this shape (abridged):

```markdown
# Upstream Sync Proposal — 2026-06-10

**Upstream:** a1b2c3..d4e5f6 | **Commits:** 14 | **Files:** 6

## Summary

| File | Type | Priority | Risk | Recommendation |
|------|------|----------|------|----------------|
| core/tools/pdf_tool.py | feature | P1 | low | ADOPT |
...

## Detailed Changes
### ADOPT  <per-file: what changed, key diff lines, security checklist>
### ADAPT  <details + what to modify for local_overrides>
### SKIP / BLOCK  <justification / security concerns>

## Generated Tests
File: `tests/test_upstream_patch_localtaskclaw.py` — 5 tests

## Apply Instructions
1. python -m pytest tests/test_upstream_patch_localtaskclaw.py -v  (must pass BEFORE patch)
2. cp ../upstreams/LocalTaskClaw/core/tools/pdf_tool.py integration/LocalTaskClaw/core/tools/pdf_tool.py
3. rerun the tests (must pass AFTER patch); update last_sync_commit/date in config.yaml
```

The Apply Instructions section lists the exact commands but the run executes them only under `--apply`.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens (an optional ` — <one-line reason>` may follow the token; nothing else). Do not invent other status wording:

- `DONE` — proposal and tests written (and changes applied with passing tests when `--apply` was passed).
- `DONE_WITH_CONCERNS` — proposal written but with BLOCK items, sensitive files pending manual review, or failing tests.
- `BLOCKED` — external blocker (upstream clone or integration copy missing).
- `NEEDS_CONTEXT` — project name, range, or paths cannot be resolved.
