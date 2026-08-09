---
name: hf-download
description: Prepare or run a HuggingFace model/dataset download with optional SOCKS5 proxy rotation, parallel range chunks, and resume support. Use when the user asks to download a model or dataset from HuggingFace, pastes a huggingface.co URL, wants a specific GGUF quantization fetched, or needs a stalled download made resumable. Default mode creates a download plan only; real downloads require explicit --apply or --download.
metadata:
  safety-class: checkpoint
---

# hf-download

Download a HuggingFace repo (model/dataset) into a local directory using `scripts/download_hf.py`.

## Safety Contract

Default mode is dry-run/checkpoint. If launched through `crt ask|run --skill`,
use `templates/default.md` as the runnable prompt and create
`HF_DOWNLOAD_PLAN.md` before any final response.

Do not run `download_hf.py`, `huggingface-cli`, Python download scripts,
background jobs, or proxy-file rewrites unless the request explicitly contains
`--apply` or `--download`. Proxy validation can rewrite files; in dry-run, only
report what would be validated.

Checkpoint git policy: `HF_DOWNLOAD_PLAN.md` is a single-slot scratch draft overwritten by
each run — add it to the project's `.gitignore` and never commit it; the
durable output is the downloaded artifacts and the run report.

## When to use

- User says: "download <repo>", "fetch model from HF", "grab this dataset"
- User pastes a `huggingface.co/<org>/<repo>` URL
- User invokes `/hf-download <repo> [dest] [...flags]`

Don't use for: uploading to HF, listing files, model conversion, inference.

## Inputs

| Arg | Required | Default | Notes |
|---|---|---|---|
| `repo_id` | yes | — | `org/repo` form. Strip `https://huggingface.co/` if user pasted a URL (a `datasets/org/repo` remainder auto-selects `--type dataset`). |
| `local_dir` | no | `$HF_DOWNLOAD_DIR/<repo>`, else `./<repo>` | Destination. An **existing dir** (e.g. `t:/models`) nests the model as `<dir>/<repo>`; otherwise used as the exact path. |
| `--type` / `--dataset` | no | `model` | Repo type. Dataset repos resolve under `huggingface.co/datasets/…`; pass `--type dataset` (or the `--dataset` shorthand) when downloading a dataset. |
| `--quant / -q` | no | — | GGUF quantization to download (e.g., `Q4_K_M`, `UD-Q8_K_XL`). If repo has multiple GGUF variants and this is omitted, lists them interactively (TTY) or downloads all (non-TTY). |
| `--proxy-list / -p` | no | `$HF_DOWNLOAD_PROXY_LIST`, else **crt network-proxy registry**, else direct | Path to a proxy file. |
| `--no-crt-proxies` | no | off | Disable the default `crt network-proxy` auto-discovery (go direct unless `--proxy-list`/env is set). |
| `--parallel / -j` | no | `3` | Number of concurrent range-chunks for files ≥ threshold. |
| `--chunk-mib` | no | `64` | Range chunk size. |
| `--threshold-mib` | no | `64` | Files smaller than this use single-stream. |
| `--chunk-timeout` | no | `600` | Per-chunk timeout (seconds). |
| `--no-validate-proxies` | no | off | Skip startup HEAD-probe of proxies. |

### Proxy file format

One proxy per line. Comments (`#`) ignored. Supported syntaxes:
```
host:port:user:pass         # SOCKS5 with auth (most common)
host:port                   # SOCKS5 without auth
socks5://user:pass@host:p   # explicit URL
socks5://127.0.0.1:1080     # local SOCKS
```

On startup the script HEAD-probes each proxy; **dead proxies are removed from the file** (the file is rewritten with only working ones). Pass `--no-validate-proxies` to skip this.

## Steps

### 1. Parse the request

- Extract `repo_id` from URL or `org/repo` text. A `huggingface.co/datasets/<org>/<repo>` URL or a "dataset" wording in the request → pass `--dataset` (the script also auto-detects a `datasets/` prefix left in `repo_id`).
- **Resolve the destination — do not let it silently fall to the current folder.** If the
  user names a target anywhere in the request (e.g. "save to /data/models",
  "put it into t:/models"), you MUST pass it as `local_dir`. An existing dir nests the model under it
  (`t:/models` → `t:/models/<repo>`); a non-existent path is used exactly. Only when the
  user named NO destination: use `$HF_DOWNLOAD_DIR/<repo>` if set, else `./<repo>` (cwd) as
  a last resort — and say which in your response. The script prints the resolved **absolute**
  path; surface it so the user can confirm where it landed.
- Detect explicit `--proxy-list`, `--parallel`, etc.

### 2. Resolve proxy mode (decision tree)

```
IF user passed --proxy-list <path>:
    → use that
ELIF env HF_DOWNLOAD_PROXY_LIST is set AND that file exists:
    → use $HF_DOWNLOAD_PROXY_LIST (mention it in your response)
ELIF user explicitly said "direct" / --no-crt-proxies:
    → direct, skip the question
ELSE  # DEFAULT — no flags needed
    → auto-discover from the crt network-proxy registry: the script runs
      `crt network-proxy list`, then `crt network-proxy show <name>` for each
      canonical url + auth_state. `auth=none` entries (the local router
      `socks5h://127.0.0.1:10110`) are used as-is; `auth=sealed` entries are
      unsealed via `crt network-proxy export-env <name> --include-secret` (needs
      `CRATEON_SSH_PASSPHRASE` in the env) and skipped only if unsealing fails.
      Dead proxies are dropped by the startup HEAD-probe.
      → if crt is absent OR yields no usable proxies, fall back to the question.
```

**Fallback question** (only when crt is unavailable AND no `--proxy-list`/env — i.e. no proxy info anywhere):

```
question: "No proxy list is configured. How should the download run?"
header:   "Proxy"
options:
  - label: "Direct"
    description: "No proxies, connect straight to HuggingFace"
  - label: "Give a file now"
    description: "Ask for a proxy-list file path (this run only)"
  - label: "Set a default"
    description: "Save the path in HF_DOWNLOAD_PROXY_LIST for future runs"
```

- **Direct** → run with no `--proxy-list`.
- **Give a file now** → ask for the path, run with `--proxy-list <path>`.
- **Set a default** → ask for the path; tell the user to add this to their shell rc:
  ```bash
  # bash/zsh
  export HF_DOWNLOAD_PROXY_LIST=/path/to/proxies.txt
  # PowerShell
  $env:HF_DOWNLOAD_PROXY_LIST = "C:\path\to\proxies.txt"
  ```
  For the current run, set it via the command (e.g., `HF_DOWNLOAD_PROXY_LIST=/path python ...`) AND tell the user to source the rc file or restart their shell so future runs pick it up.

### 3. GGUF quantization selection

If the repo contains `.gguf` files with multiple quantizations (e.g., `Q4_K_M`, `UD-Q8_K_XL`, `BF16`):

- **With `--quant`**: filter to only that quantization + essential metadata files (configs, tokenizers, mmproj).
- **Without `--quant` in TTY**: show numbered list, prompt user to pick one.
- **Without `--quant` non-TTY**: download all files (warn user that `--quant` is available).

Examples:
```bash
# Download only UD-Q8_K_XL (~33 GB instead of ~100 GB for all quants)
python .../download_hf.py unsloth/Qwen3.6-27B-MTP-GGUF /t/models/qwen-gguf --quant UD-Q8_K_XL

# Interactive selection
python .../download_hf.py unsloth/Qwen3.6-27B-MTP-GGUF /t/models/qwen-gguf
# → lists 23 quantizations, asks for number or name
```

### 4. Resolve other defaults

- `--parallel`: default `3` unless user said otherwise. If the user mentions speed (e.g., "faster", "max threads"), suggest `--parallel 8`.
- `--chunk-mib`: default `64` (don't change unless asked).
- `local_dir`: if the user named a destination ANYWHERE in the request, pass it (an existing
  dir nests as `<dir>/<repo>`). Else default = `$HF_DOWNLOAD_DIR/<repo>` if set, else
  `./<repo>` (script handles this). Never drop a stated target and fall back to cwd.

### 5. Find the script

The script lives next to this skill at `scripts/download_hf.py` relative to the skill directory. Resolve its absolute path before running.

If the skill is installed via the bundle, it's at:
- `<bundle-root>/skills/hf-download/scripts/download_hf.py`

When running from a session, you don't need to `cd` anywhere — the script doesn't depend on CWD (no relative `proxy/1.txt` lookup like the vLLM original).

### 6. Launch (background)

Only execute this section when `--apply` or `--download` is present and the
confirmation gate has passed. In default mode, write the exact command into
`HF_DOWNLOAD_PLAN.md` instead.

Use Bash with `run_in_background: true`:

```bash
python /path/to/scripts/download_hf.py <repo_id> <local_dir> \
    [--proxy-list <path>] [--parallel <n>] [--chunk-mib <n>] [--threshold-mib <n>]
```

Save the returned task ID — needed for monitoring/stopping.

### 7. Report briefly

```
Started in the background (task_id `XXX`).
Command: python .../download_hf.py <repo> <dest> [flags]
Progress:
  tail -f "<output-file>"
```

### 8. Monitoring (only on user request)

- "how is it going?" / "status" / "progress" → `tail -c 2000 <output-file>` and summarize.
- "stop" / "cancel" → `TaskStop` with the saved task ID.

Don't poll proactively.

## What the script does

- **Optional proxy validation** on startup (HEAD probe to huggingface.co); dead ones are rewritten out of the file.
- **Lists repo files** via `huggingface_hub.list_repo_files`.
- **Per-file decision**:
  - File ≥ `--threshold-mib` AND `--parallel > 1` → parallel range chunks
  - Else → single-stream
- **Parallel range download**:
  - `--parallel` workers pull from a shared `Queue` (work-stealing — slow workers don't bottleneck)
  - Each chunk written atomically: `part-NNNNN.bin.tmp` → rename
  - Per-chunk retry budget cycles through proxies (or just retries direct with backoff); failed proxies blacklisted in-memory
  - Resume: existing parts with correct size are skipped; merge runs only after all chunks complete
- **Direct mode** (no proxies): same parallel logic but every chunk goes direct. Multi-connection range still helps throughput on most HF CDNs.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `proxy list not found` warning | Bad path or env var pointing to nonexistent file | Check path; or omit to go direct |
| `WARNING: all proxies failed` on validation | Local network blip | File preserved untouched; re-run later |
| `ERROR: N chunks failed permanently` | Direct mode + flaky network, OR all proxies dead mid-run | Add fresh proxies / try direct / re-run (resume kicks in) |
| `.parts/` left after kill | Process killed mid-flight | Re-run; resume picks up; merge cleans `.parts/` only on full success |
| File "skipped" but seems incomplete | Local size happens to equal HF Content-Length | Delete file manually, re-run |
| `Error: pip install requests[socks]` | Missing dep | `pip install "requests[socks]" huggingface-hub` |

## Examples

### First time, no config
> User: "download Zyphra/ZAYA1-8B"

→ ask the proxy question → the user picks "Direct" → run:
```bash
python <skill>/scripts/download_hf.py Zyphra/ZAYA1-8B
```

### With explicit proxy file and 8 threads
> User: "download meta-llama/Llama-3-8B via ~/proxies.txt into /t/models/llama-3, 8 threads"

→ run:
```bash
python <skill>/scripts/download_hf.py meta-llama/Llama-3-8B /t/models/llama-3 \
    --proxy-list ~/proxies.txt --parallel 8
```

### Default proxy list configured
> User has `HF_DOWNLOAD_PROXY_LIST=~/proxies.txt` exported.
> User: "download google/gemma-4-E4B-it"

→ no question; run:
```bash
python <skill>/scripts/download_hf.py google/gemma-4-E4B-it
```
(script picks up env automatically). Mention that the env-configured proxy list is being used.

### Slash invocation
> User: `/hf-download Qwen/Qwen3.5-35B-A3B --parallel 6`

→ run with `--parallel 6` and default proxy resolution.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — the plan is written (or, under `--apply`/`--download`, the download launched/completed and the resolved destination was reported).
- `DONE_WITH_CONCERNS` — plan/download done but something needs attention (proxies skipped, fallback destination used, partial resume state); list it.
- `BLOCKED` — the repo is inaccessible (auth/404) or no destination is writable.
- `NEEDS_CONTEXT` — the repo id is ambiguous or a stated destination cannot be resolved; name what is needed.
