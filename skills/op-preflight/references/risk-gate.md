# PR/Security Risk Gate — Explicit Checks

Apply for `MEDIUM` or `HIGH` classified tasks (workflow step 6).

## Classification reminders

- `LOW` — docs-only, tests-only, local refactor, no new authority.
- `MEDIUM` — changes runtime behavior, file writes, network calls, generated
  artifacts, command execution, or client configuration.
- `HIGH` — changes secret handling, auth, deploy/inject, CI, container
  privileges, proxy routing, dependency install, remote code execution, or
  public API behavior.

## Required checks for MEDIUM/HIGH

- Secrets are not printed, committed, or left in shell history.
- Network/proxy target, DNS mode, and provider binding are explicit.
- New commands are quoted and have non-destructive defaults.
- Generated config has a single source of truth and a rollback path.
- Dependency/script provenance is reviewed.
- External PR/patch/import is treated as untrusted until inspected.

If a `HIGH` risk lacks proof or an owner, mark preflight `FAIL`.
