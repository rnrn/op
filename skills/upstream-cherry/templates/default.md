# Upstream Cherry Run Contract

User request:

```text
{{INPUT}}
```

Operate in checkpoint mode unless the request explicitly contains `--apply`.

## Safety Rules

- Default mode is dry-run. Do not edit integration source files, do not copy upstream files, do not create real tests, do not commit, and do not run destructive git commands.
- Do not run `git pull` or mutate the upstream clone unless the request explicitly contains `--refresh`.
- If `--apply` is present, first write the proposed air-gap tests, run them against the unchanged integration tree, then apply only the approved patch set, rerun tests, and stop on first failure.
- If target resolution is ambiguous, write a blocker in `CHERRY_CHECKPOINT.md` instead of guessing.
- Use bounded evidence. Never paste full raw diffs; summarize key hunks and file paths.

## Target Resolution

Resolve the target into these fields:

- `dir_name`: simple name, `owner--repo`, or explicit local directory basename.
- `upstream_path`: explicit path from the request, `workflow/<dir_name>/config.yaml`, or `<workspace>/upstreams/<dir_name>`.
- `docs_path`: `workflow/<dir_name>/config.yaml` or `<workspace>/upstreams_docs/<dir_name>`.
- `target_repo` / `integration_path`: explicit request/config value only. Treat `target_repo=` as the preferred generic name and `integration_path=` as a legacy alias. If absent, mark apply blocked.
- `range`: exact request `--range=...`, config `upstream.last_sync_commit..HEAD`, or bounded fallback `HEAD~20..HEAD`.

If the user request contains `--range=VALUE`, you must use exactly `VALUE`. Do not replace it with fallback. If the range cannot be parsed or resolved by git, write a blocker instead of using another range.

Prefer `workflow/<dir_name>/config.yaml` when it exists. Honor `local_overrides`, `security.sensitive_files`, and `security.block_patterns` from that config.

## Harvest Bootstrap

If the request includes `target_repo=...`, the workflow becomes source-to-target mapping.

Before mapping:

1. Resolve `source_upstream` from explicit `source_upstream=...`, the positional upstream argument, GitHub URL, `owner/repo`, or `<workspace>/upstreams/<dir_name>`.
2. Resolve `source_docs` from explicit `source_docs=...`, `docs=...`, `harvest=...`, or `<workspace>/upstreams_docs/<dir_name>`.
3. If `source_upstream` is missing and the request includes a GitHub URL or `owner/repo`, create a bootstrap plan that says to run upstream-harvest first. Do not invent source facts.
4. If `source_docs` or harvest checkpoint is missing, write `HARVEST_BOOTSTRAP_REQUIRED` in `CHERRY_CHECKPOINT.md` with the exact command to run:

```text
crt ask <client> --skill upstream-harvest "<source> --update"
```

5. If harvest artifacts exist, read them as source evidence and continue mapping.

Do not apply changes during bootstrap or mapping. Direct patch mode is allowed only when workflow config explicitly says the source and target are the same project family and `--apply` is present.

## Target Discovery

When `target_repo=...` or `integration_path=...` is present, inspect the target before creating tasks:

- repository language and build files
- config/provider/client/protocol anchors
- existing bridge/adapter patterns
- test files that already cover the target subsystem
- docs/epic/story location if present

If a target file is guessed, mark it as `candidate` and include the exact search command needed to prove it.

## Required Evidence

Collect only concise evidence:

- `git -C <upstream_path> status --short`
- `git -C <upstream_path> rev-parse HEAD`
- `git -C <upstream_path> log --oneline --no-merges <range>`
- `git -C <upstream_path> diff --stat <range>`
- `git -C <upstream_path> diff --name-status <range>`
- targeted diff summaries for the most relevant changed files only

If context-mode tools are available, use them for command output analysis. If not, use bounded shell/git commands and summarize.

## Write Artifact

Create `CHERRY_CHECKPOINT.md` in the current working directory with these sections:

1. Target And Resolution
2. Harvest Bootstrap Status
3. Target Discovery
4. Upstream Range Evidence
5. Source-To-Target Mapping
6. Change Classification
7. Security Review
8. Local Override And Conflict Review
9. Air-Gap Test Plan
10. Recommendation Table
11. Integration Backlog
12. Stepwise Test Slices
13. Machine-Readable Mapping
14. Apply Gate

Classification rows must use `ADOPT`, `ADAPT`, `SKIP`, or `BLOCK`.

Security review must mention block patterns, sensitive files, new dependencies/imports, network calls, file operations, auth/secret changes, and license risk when visible.

Air-gap test plan must name exact test files and assertions to add before applying changes. In dry-run mode, describe tests only; do not create them.

If `integration_path=...` or `goal=...` is present, the artifact must include an implementation-ready backlog for the target repository:

- Map each upstream candidate to target repository areas or exact files. If exact files are unknown, state the search command needed to resolve them.
- Split work into small ordered stories. Each story must include source evidence, target area, implementation action, tests, acceptance criteria, and blocked/unknown notes.
- For protocol/client goals, include a protocol matrix with ingress client, proxy endpoint, upstream endpoint, streaming mode, expected request fields, expected response fields, and failure modes.
- Do not claim implementation completion. Mark this as design/checkpoint unless `--apply` was explicitly requested and executed.

Choose one strategy per mapping:

- `direct-patch`: same project family, same language, same file shape, workflow config allows direct patch.
- `port`: source behavior should be reimplemented in target language.
- `sidecar`: source service should run separately and target should integrate with it.
- `spec-only`: source is used only as protocol or behavior evidence.
- `skip`: not portable or not valuable.

For a Giga/Codex bridge goal, prefer these slices unless evidence proves a better split:

1. Provider/config discovery for Giga-compatible endpoints and auth.
2. OpenAI Chat/Responses ingress from Codex.
3. Anthropic Messages ingress when clients use Claude-style APIs.
4. Cross-protocol request/response translation.
5. Streaming/SSE parity and cancellation.
6. Model discovery and `/model/info` compatibility.
7. Files/Batches support only if required by target clients.
8. Security hardening: timing-safe auth, body limit, redaction, request-scoped tokens.

## Completion Checklist

- `CHERRY_CHECKPOINT.md` exists.
- No `_pending_` placeholders remain.
- Target, upstream HEAD, and range are explicit or blocked.
- If `--range=...` was present in the request, the artifact shows that exact range.
- Every recommended file has a security note.
- Integration backlog exists when `integration_path` or `goal` is present.
- Stepwise test slices exist when protocol/client integration is requested.
- `Harvest Bootstrap Status`, `Target Discovery`, and `Source-To-Target Mapping` exist when `target_repo` is present.
- `Machine-Readable Mapping` exists when source-to-target mapping is requested.
- Apply gate clearly states whether real changes are blocked or allowed.
- Artifact stays under 200 lines unless the request explicitly asks for more.
