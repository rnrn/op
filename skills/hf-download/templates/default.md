Use the hf-download skill.

User request:
{{input}}

Goal:
Create a bounded HuggingFace download plan before starting network downloads.

Hard success rule:
Do not treat prose-only analysis as success. Final answer is allowed only after
`HF_DOWNLOAD_PLAN.md` exists in the current workspace and passes the checklist
below. The final response must include `Artifact: <absolute path to HF_DOWNLOAD_PLAN.md>`.

Default safety:
- Default mode is dry-run/checkpoint.
- Do not start `download_hf.py`, `huggingface-cli`, Python download scripts, or
  background download jobs unless the request explicitly contains `--apply` or
  `--download`.
- Do not mutate proxy list files in dry-run.
- Do not write into broad roots such as `C:\`, `D:\`, or repo roots unless a
  concrete destination folder is provided.

Context-mode evidence contract:
- Use context-mode tools for analysis. Use `ctx_execute` for bounded HuggingFace
  metadata/proxy checks and print only a compact summary.
- Do not use `curl`, `wget`, or raw HTTP dumps. Do not list entire model file
  manifests unless the user asks for it.
- Do not simplify this into a generic download command. The checkpoint must cite
  repo resolution, destination scope, proxy decision, script path, command, and
  resume/monitoring behavior.
- If context-mode tools are unavailable, write `BLOCKED` with the missing tool
  and do not download.

Evidence workflow:
1. Resolve `repo_id` from `org/repo` or `https://huggingface.co/org/repo`.
2. Resolve destination path. If missing, propose `./<repo-name>` under current
   workspace and mark it as proposed, not created.
3. Resolve proxy mode:
   - explicit `--proxy-list`
   - `$HF_DOWNLOAD_PROXY_LIST`
   - direct mode if user says direct/no proxy
   - otherwise record `NEEDS_PROXY_DECISION`
4. Validate local script path exists:
   `<skill>/scripts/download_hf.py`
5. Plan command with `--parallel`, `--chunk-mib`, `--threshold-mib`, and
   proxy options.
6. Write `HF_DOWNLOAD_PLAN.md`.
7. If `--apply` or `--download` is present, require explicit confirmation if the
   estimated destination or proxy behavior is unclear.

Required `HF_DOWNLOAD_PLAN.md` sections:
# HF Download Plan
## 1. Target Repo
## 2. Destination
## 3. Proxy Mode
## 4. Download Command
## 5. Resume / Stop / Monitoring
## 6. Risks
## 7. Apply Gate

Checklist:
- HF repo id is stated.
- Destination is concrete and scoped.
- Proxy mode is direct, explicit file, env file, or blocked.
- The script path is stated and exists.
- No network download was started in dry-run.
- Resume and monitoring instructions are included.
- Apply gate says whether a download was started.

Completion status line:
- `DONE` if checkpoint was created and no download was started.
- `DONE_WITH_CONCERNS` if destination/proxy/size is uncertain.
- `NEEDS_CONTEXT` if repo id or proxy decision is missing.
- `BLOCKED` if script path is missing.

ARGUMENTS: HF repo id, optional destination, and optional `--apply` / `--download`.
