#!/usr/bin/env python3
"""
Download HuggingFace models with SOCKS5 proxy rotation, parallel range chunks,
and resume support.

Proxy source precedence: --proxy-list  >  $HF_DOWNLOAD_PROXY_LIST  >  crt network-proxy
registry (DEFAULT)  >  direct. So with crt configured you need no flags — it auto-discovers
proxies from `crt network-proxy list` / `show`; `--no-crt-proxies` opts out.

Usage:
    python download_hf.py REPO_ID [LOCAL_DIR] [options]

Examples:
    # Default: auto-discover proxies from crt network-proxy registry (no flags needed)
    python download_hf.py google/gemma-4-E4B-it /t/models/gemma-4-e4b

    # Force a specific proxy file, 8 parallel chunks
    python download_hf.py meta-llama/Llama-3-8B /t/models/llama-3-8b \
        --proxy-list ~/proxies.txt --parallel 8

    # Env-provided proxy file
    HF_DOWNLOAD_PROXY_LIST=~/proxies.txt python download_hf.py Zyphra/ZAYA1-8B

    # Disable crt auto-discovery -> direct
    python download_hf.py google/gemma-4-E4B-it --no-crt-proxies

Destination:
    An existing dir nests the model under it: `download_hf.py org/repo t:/models`
    -> t:/models/org--repo (NOT loose in t:/models, and never silently in cwd).
    Set a models root once: HF_DOWNLOAD_DIR=t:/models python download_hf.py org/repo.

Proxy file format (one per line):
    host:port:user:pass         # SOCKS5 with auth
    host:port                   # SOCKS5 without auth
    socks5://user:pass@host:p   # explicit URL
    socks5://127.0.0.1:1080     # local SOCKS

Lines starting with '#' are ignored. Dead proxies are detected on startup
(HEAD probe to huggingface.co) and the file is rewritten with only the survivors.

Resume:
    Re-running with the same args picks up where it left off.
    - Already-completed files (size matches remote) are skipped.
    - Partially-downloaded chunks (in <file>.parts/) are kept and the rest fetched.

Dependencies:
    pip install requests[socks] huggingface-hub
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import threading
import time
from pathlib import Path
from queue import Empty, Queue
from typing import Iterator, Optional


# ---------------------------------------------------------------------------
# Proxy loading + validation
# ---------------------------------------------------------------------------

def load_proxies(proxy_file: Optional[Path]) -> list[tuple[str, str]]:
    """Load proxies from file. Returns list of (raw_line, normalized_url).
    Returns [] if file is None or doesn't exist."""
    if proxy_file is None:
        return []
    if not proxy_file.exists():
        print(f"[warn] proxy list not found: {proxy_file}; falling back to direct")
        return []

    proxies: list[tuple[str, str]] = []
    for line in proxy_file.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        if raw.startswith("socks5://") or raw.startswith("socks5h://") \
                or raw.startswith("http://") or raw.startswith("https://"):
            normalized = raw
        else:
            parts = raw.split(":")
            if len(parts) == 4:
                host, port, user, pwd = parts
                normalized = f"socks5://{user}:{pwd}@{host}:{port}"
            elif len(parts) == 2:
                normalized = f"socks5://{raw}"
            else:
                print(f"[warn] cannot parse proxy line: {raw!r}")
                continue
        proxies.append((raw, normalized))
    print(f"Loaded {len(proxies)} proxies from {proxy_file}")
    return proxies


def proxies_from_crt() -> list[tuple[str, str]]:
    """Default proxy source: crt's network-proxy registry (used when no --proxy-list /
    $HF_DOWNLOAD_PROXY_LIST is given). Enumerate via `crt network-proxy list`, then read
    each canonical `url` + `auth_state` from `crt network-proxy show <name>`. auth=none
    entries (e.g. the local router `socks5h://127.0.0.1:10110`) are usable as-is; sealed
    entries are unsealed via `crt network-proxy export-env <name> --include-secret` (needs
    CRATEON_SSH_PASSPHRASE in the env) and skipped only if unsealing fails. Returns [] if
    crt is absent / has no proxies (caller falls back to direct)."""
    import subprocess

    def crt(*a: str) -> str:
        try:
            r = subprocess.run(["crt", *a], capture_output=True, text=True, timeout=60)
            return r.stdout or ""
        except (FileNotFoundError, OSError, subprocess.SubprocessError):
            return ""

    listing = crt("network-proxy", "list")
    if not listing.strip():
        return []
    names: list[str] = []
    for line in listing.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() != "NAME" and "://" in parts[-1]:
            names.append(parts[0])

    proxies: list[tuple[str, str]] = []
    for name in names:
        url = auth = ""
        for ln in crt("network-proxy", "show", name).splitlines():
            s = ln.strip()
            if s.startswith("url:"):
                url = s.split(":", 1)[1].strip()
            elif s.startswith("auth_state:"):
                auth = s.split(":", 1)[1].strip()
        if not url:
            continue
        if auth and auth != "none":
            # sealed → unseal credentials via export-env --include-secret
            cred_url = ""
            for ln in crt("network-proxy", "export-env", name, "--include-secret").splitlines():
                if ("HTTPS_PROXY" in ln or "ALL_PROXY" in ln) and "=" in ln:
                    cred_url = ln.split("=", 1)[1].strip().strip("'\"")
                    break
            if not cred_url or "REDACTED" in cred_url:
                print(f"[warn] crt proxy {name!r} is sealed and credentials could not be unsealed "
                      f"(need CRATEON_SSH_PASSPHRASE) — skipping")
                continue
            url = cred_url
        proxies.append((name, url))

    if proxies:
        print(f"Loaded {len(proxies)} proxies from crt network-proxy registry")
    return proxies


def validate_proxy(proxy_url: str, timeout: int = 10) -> bool:
    """HEAD-probe huggingface.co through the proxy."""
    try:
        import requests
    except ImportError:
        return True
    try:
        r = requests.head(
            "https://huggingface.co/",
            proxies={"http": proxy_url, "https": proxy_url},
            timeout=timeout,
            allow_redirects=False,
        )
        return r.status_code < 500
    except Exception:
        return False


def validate_and_persist_proxies(
    proxies: list[tuple[str, str]],
    proxy_path: Optional[Path],
    timeout: int = 10,
) -> list[str]:
    """Validate proxies in parallel; rewrite file with only working ones."""
    if not proxies:
        return []
    print(f"\nValidating {len(proxies)} proxies (timeout={timeout}s)...")

    try:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=min(16, len(proxies))) as ex:
            results = list(ex.map(lambda p: validate_proxy(p[1], timeout), proxies))
    except Exception:
        results = [validate_proxy(p[1], timeout) for p in proxies]

    working_raw, working_url = [], []
    for (raw, url), ok in zip(proxies, results):
        host = url.split("@")[-1] if "@" in url else url.replace("socks5://", "")
        if ok:
            print(f"  [OK]   {host}")
            working_raw.append(raw)
            working_url.append(url)
        else:
            print(f"  [DEAD] {host}")

    dead = len(proxies) - len(working_url)
    if dead > 0 and proxy_path is not None:
        if working_raw:
            proxy_path.write_text("\n".join(working_raw) + "\n", encoding="utf-8")
            print(f"Removed {dead} dead proxies; {len(working_url)} kept in {proxy_path}")
        else:
            print("WARNING: all proxies failed — keeping file untouched (transient network?)")
            return [u for _, u in proxies]
    return working_url


def cycle_proxies(proxies: list[str]) -> Iterator[Optional[str]]:
    """Round-robin iterator. Yields None forever if proxies is empty."""
    if not proxies:
        while True:
            yield None
    i = 0
    while True:
        yield proxies[i % len(proxies)]
        i += 1


# ---------------------------------------------------------------------------
# HF metadata
# ---------------------------------------------------------------------------

def get_hf_token() -> Optional[str]:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    if token:
        return token
    cache = Path.home() / ".cache" / "huggingface" / "token"
    if cache.exists():
        return cache.read_text(encoding="utf-8").strip()
    return None


def list_repo_files(repo_id: str, token: Optional[str], repo_type: str = "model") -> list[str]:
    try:
        from huggingface_hub import list_repo_files as hf_list
    except ImportError:
        print("Error: huggingface_hub not installed. Run: pip install huggingface-hub")
        sys.exit(1)
    return list(hf_list(repo_id, token=token, repo_type=repo_type))


def _short_proxy_label(proxy: Optional[str]) -> str:
    if not proxy:
        return "direct"
    return proxy.split("@")[-1] if "@" in proxy else proxy


# ---------------------------------------------------------------------------
# Range probe
# ---------------------------------------------------------------------------

def get_remote_size(
    url: str,
    proxies: list[str],
    token: Optional[str] = None,
    timeout: int = 30,
) -> Optional[int]:
    """HEAD or Range:0-0 GET, trying each proxy + direct."""
    try:
        import requests
    except ImportError:
        return None

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    candidates: list[Optional[str]] = list(proxies) + [None]
    for proxy in candidates:
        proxy_arg = {"http": proxy, "https": proxy} if proxy else None
        try:
            r = requests.head(url, headers=headers, proxies=proxy_arg,
                              timeout=timeout, allow_redirects=True)
            if r.status_code < 400:
                cl = r.headers.get("content-length")
                if cl and int(cl) > 0:
                    return int(cl)
        except Exception:
            pass
        try:
            rh = dict(headers)
            rh["Range"] = "bytes=0-0"
            r = requests.get(url, headers=rh, proxies=proxy_arg,
                             stream=True, timeout=timeout, allow_redirects=True)
            try:
                if r.status_code in (200, 206):
                    cr = r.headers.get("content-range", "")
                    if "/" in cr:
                        total = cr.rsplit("/", 1)[-1].strip()
                        if total.isdigit():
                            return int(total)
                    cl = r.headers.get("content-length")
                    if cl and int(cl) > 0:
                        return int(cl)
            finally:
                r.close()
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# Single chunk download
# ---------------------------------------------------------------------------

def download_chunk(
    url: str,
    start: int,
    end: int,
    dest: Path,
    proxy: Optional[str],
    token: Optional[str],
    timeout: int = 600,
) -> bool:
    try:
        import requests
    except ImportError:
        return False

    expected = end - start + 1
    headers = {"Range": f"bytes={start}-{end}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    proxy_arg = {"http": proxy, "https": proxy} if proxy else None

    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        with requests.get(url, headers=headers, proxies=proxy_arg, stream=True,
                          timeout=timeout, allow_redirects=True) as r:
            if r.status_code not in (200, 206):
                return False
            with open(tmp, "wb") as f:
                for buf in r.iter_content(chunk_size=1 << 20):
                    if buf:
                        f.write(buf)
        # Windows: file handle may still be held by AV/fs cache briefly after close
        if sys.platform == "win32":
            import time as _time
            _time.sleep(0.15)
        if tmp.stat().st_size != expected:
            _safe_unlink(tmp)
            return False
        if dest.exists():
            _retry_unlink(dest)
        _retry_rename(tmp, dest)
        return True
    except Exception:
        _safe_unlink(tmp)
        return False


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except PermissionError:
        pass


def _retry_unlink(path: Path, attempts: int = 5, delay: float = 0.2) -> None:
    for i in range(attempts):
        try:
            path.unlink(missing_ok=True)
            return
        except PermissionError:
            if i + 1 < attempts:
                time.sleep(delay)
            else:
                raise


def _retry_rename(src: Path, dst: Path, attempts: int = 5, delay: float = 0.2) -> None:
    for i in range(attempts):
        try:
            src.rename(dst)
            return
        except PermissionError:
            if i + 1 < attempts:
                time.sleep(delay)
            else:
                raise


def _merge_parts(parts_dir: Path, dest: Path, n_parts: int, expected_size: int) -> bool:
    if dest.exists():
        _retry_unlink(dest)
    buf_size = 4 << 20
    with open(dest, "wb") as out:
        for i in range(n_parts):
            part = parts_dir / f"part-{i:05d}.bin"
            if not part.exists():
                print(f"\n  ERROR: missing part {part}")
                return False
            with open(part, "rb") as p:
                while True:
                    buf = p.read(buf_size)
                    if not buf:
                        break
                    out.write(buf)
    actual = dest.stat().st_size
    if actual != expected_size:
        print(f"\n  ERROR: merged size {actual} != expected {expected_size}")
        return False
    shutil.rmtree(parts_dir, ignore_errors=True)
    return True


# ---------------------------------------------------------------------------
# Parallel range download
# ---------------------------------------------------------------------------

def download_file_parallel(
    url: str,
    dest: Path,
    proxies: list[str],
    token: Optional[str],
    chunk_size: int,
    parallel: int,
    chunk_timeout: int,
    desc: str = "",
) -> bool:
    """Split into range chunks, download in parallel via proxies (or direct).

    Returns False on any failure; caller may fall back to single-stream.
    """
    size = get_remote_size(url, proxies, token=token)
    if not size or size <= 0:
        print(f"  Could not determine size; falling back to single-stream")
        return False

    parts_dir = dest.parent / (dest.name + ".parts")
    parts_dir.mkdir(parents=True, exist_ok=True)

    n_parts = (size + chunk_size - 1) // chunk_size
    todo: list[tuple[int, int, int, Path]] = []
    pre_done = 0
    for i in range(n_parts):
        start = i * chunk_size
        end = min(size - 1, start + chunk_size - 1)
        expected = end - start + 1
        part_path = parts_dir / f"part-{i:05d}.bin"
        if part_path.exists() and part_path.stat().st_size == expected:
            pre_done += expected
            continue
        if part_path.exists():
            part_path.unlink()
        todo.append((i, start, end, part_path))

    parallel = max(1, min(parallel, len(todo) or 1))
    via = f"{len(proxies)} proxies" if proxies else "direct"
    print(f"  Size: {size/1024/1024:.1f} MiB | chunks: {n_parts} total, "
          f"{len(todo)} to fetch | parallel: {parallel} ({via})")

    if not todo:
        return _merge_parts(parts_dir, dest, n_parts, size)

    work: Queue = Queue()
    for c in todo:
        work.put(c)

    proxy_lock = threading.Lock()
    alive = list(proxies)
    dead: set[str] = set()

    progress_lock = threading.Lock()
    bytes_done = pre_done
    total_bytes = size
    failed: list[tuple[int, int, int, Path]] = []
    failed_lock = threading.Lock()

    # Retries per chunk: more if we have proxies, fewer for direct
    max_attempts = max(5, len(proxies) * 2) if proxies else 5

    def worker(worker_id: int) -> None:
        nonlocal bytes_done
        while True:
            try:
                idx, start, end, part_path = work.get_nowait()
            except Empty:
                return

            tried: set[str] = set()
            attempt = 0
            success = False

            while attempt < max_attempts and not success:
                with proxy_lock:
                    candidates = [p for p in alive if p not in tried]
                    if not candidates and alive:
                        candidates = list(alive)  # all tried, retry alive
                    if candidates:
                        proxy = candidates[(worker_id + attempt) % len(candidates)]
                    else:
                        proxy = None  # direct
                tried.add(proxy or "_direct_")

                ok = download_chunk(url, start, end, part_path, proxy, token,
                                    timeout=chunk_timeout)
                if ok:
                    success = True
                    expected = end - start + 1
                    with progress_lock:
                        bytes_done += expected
                        pct = bytes_done * 100.0 / total_bytes
                        label = _short_proxy_label(proxy)[:25]
                        print(f"\r  {desc}: {pct:5.1f}% "
                              f"({bytes_done/1024/1024:.0f}/{total_bytes/1024/1024:.0f} MiB) "
                              f"chunk {idx+1}/{n_parts} via {label}",
                              end="", flush=True)
                    break

                if proxy:
                    with proxy_lock:
                        if proxy in alive:
                            alive.remove(proxy)
                            dead.add(proxy)
                            print(f"\n  [proxy down] {_short_proxy_label(proxy)} "
                                  f"(remaining alive: {len(alive)})")
                else:
                    # direct failure — small backoff
                    time.sleep(min(2 ** attempt, 30))
                attempt += 1

            if not success:
                with failed_lock:
                    failed.append((idx, start, end, part_path))

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=parallel) as ex:
        futs = [ex.submit(worker, i) for i in range(parallel)]
        for f in futs:
            f.result()

    print()
    if failed:
        print(f"  ERROR: {len(failed)} chunks failed permanently")
        return False
    return _merge_parts(parts_dir, dest, n_parts, size)


# ---------------------------------------------------------------------------
# Single-stream fallback
# ---------------------------------------------------------------------------

def download_file_single(
    url: str,
    dest: Path,
    proxy: Optional[str],
    token: Optional[str],
    desc: str = "",
    timeout: int = 300,
) -> bool:
    try:
        import requests
    except ImportError:
        print("Error: pip install requests[socks]")
        return False

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    resume_pos = 0
    if dest.exists():
        resume_pos = dest.stat().st_size
        headers["Range"] = f"bytes={resume_pos}-"

    proxy_arg = {"http": proxy, "https": proxy} if proxy else None

    try:
        r = requests.get(url, headers=headers, proxies=proxy_arg, stream=True, timeout=timeout)
        r.raise_for_status()
        mode = "ab" if resume_pos > 0 else "wb"
        total = resume_pos + int(r.headers.get("content-length", 0))
        downloaded = resume_pos
        with open(dest, mode) as f:
            for buf in r.iter_content(chunk_size=8192):
                if buf:
                    f.write(buf)
                    downloaded += len(buf)
                    if total > 0:
                        pct = downloaded * 100.0 / total
                        print(f"\r  {desc}: {pct:.1f}% ({downloaded}/{total})",
                              end="", flush=True)
        print()
        return True
    except Exception as e:
        print(f"\n  Error: {e}")
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def extract_gguf_quants(files: list[str]) -> dict[str, list[str]]:
    """Extract GGUF quantization variants from a file list.
    Returns {quant_label: [matching_files]}."""
    import re
    # Skip mmproj files (multimodal projectors) — they're not model weights
    gguf_files = [f for f in files if f.endswith('.gguf') and 'mmproj' not in f.lower()]
    if not gguf_files:
        return {}

    # Separate sharded and non-sharded
    non_sharded, sharded = [], []
    for f in gguf_files:
        stem = f[:-5]
        stem_no_shard = re.sub(r'-\d{5}-of-\d{5}$', '', stem)
        if stem_no_shard != stem:
            sharded.append((f, stem_no_shard))
        else:
            non_sharded.append((f, stem))

    quants: dict[str, list[str]] = {}

    # Non-sharded: find common prefix, everything after it is the quant
    if non_sharded:
        stems = [s for _, s in non_sharded]
        prefix = stems[0]
        for s in stems[1:]:
            i = 0
            while i < len(prefix) and i < len(s) and prefix[i] == s[i]:
                i += 1
            prefix = prefix[:i]
        # Trim to last separator for clean split
        for sep in ['/', '-']:
            idx = prefix.rfind(sep)
            if idx >= 0:
                prefix = prefix[:idx + 1]
                break
        for orig, stem in non_sharded:
            quant = stem[len(prefix):].strip('-/')
            if quant:
                quants.setdefault(quant, []).append(orig)

    # Sharded: directory name is usually the quant
    for orig, stem in sharded:
        parts = stem.split('/')
        basename = parts[-1]
        dirname = parts[-2] if len(parts) > 1 else None
        if dirname and basename.endswith(f'-{dirname}'):
            quant = dirname
        elif '-' in basename:
            quant = basename.rsplit('-', 1)[-1]
        else:
            quant = basename
        quants.setdefault(quant, []).append(orig)

    return quants


def is_essential_file(path: str) -> bool:
    """Non-model metadata files that should always be downloaded."""
    lower = path.lower()
    if 'mmproj' in lower and lower.endswith('.gguf'):
        return True
    if lower.endswith('.gguf'):
        return False
    if any(lower.endswith(ext) for ext in ['.json', '.jinja', '.txt', '.md', '.yaml', '.yml']):
        return True
    keywords = ['readme', 'license', 'notice', 'config', 'tokenizer',
                'preprocessor', 'processor', 'template',
                'special_tokens', 'vocab']
    return any(kw in lower for kw in keywords)


def prompt_quant_selection(quants: dict[str, list[str]]) -> str:
    """Show available quants and ask user to pick one."""
    items = sorted(quants.items(), key=lambda x: x[0])
    print(f"\n{'='*50}")
    print("GGUF repo detected — multiple quantizations available")
    print(f"{'='*50}")
    for i, (quant, files) in enumerate(items, 1):
        n = len(files)
        print(f"  {i:2}. {quant}{' ('+str(n)+' files)' if n > 1 else ''}")
    print(f"{'='*50}")
    while True:
        choice = input("Select quantization (number or name): ").strip()
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(items):
                return items[idx][0]
        except ValueError:
            pass
        for quant, _ in items:
            if quant.lower() == choice.lower():
                return quant
        matches = [q for q, _ in items if choice.lower() in q.lower()]
        if len(matches) == 1:
            return matches[0]
        elif len(matches) > 1:
            print(f"  Ambiguous: matches {', '.join(matches)}")
        else:
            print(f"  Invalid choice. Enter number 1-{len(items)} or quantization name.")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Download a HuggingFace repo with optional proxy rotation and parallel range chunks.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:")[1].split("Dependencies:")[0],
    )
    p.add_argument("repo_id", help="HuggingFace repo (org/repo)")
    p.add_argument("local_dir", nargs="?", default=None,
                   help="Destination. An existing dir (e.g. t:/models) nests the model as "
                        "<dir>/<repo>; otherwise used as the exact path. Default: "
                        "$HF_DOWNLOAD_DIR/<repo> if set, else ./<repo>.")
    p.add_argument("--type", choices=("model", "dataset"), default="model",
                   help="HF repo type (default: model); dataset repos resolve under datasets/")
    p.add_argument("--dataset", action="store_true",
                   help="shorthand for --type dataset")
    p.add_argument("--quant", "-q", default=None,
                   help="GGUF quantization to download (e.g., Q4_K_M, UD-Q8_K_XL). "
                        "If omitted and repo has multiple GGUF variants, lists them for selection.")
    p.add_argument("--proxy-list", "-p", type=Path, default=None,
                   help="Path to proxy file. If omitted, uses $HF_DOWNLOAD_PROXY_LIST, "
                        "else auto-discovers from `crt network-proxy list`, else direct.")
    p.add_argument("--no-crt-proxies", action="store_true",
                   help="Disable the default `crt network-proxy` auto-discovery; go DIRECT "
                        "unless --proxy-list / $HF_DOWNLOAD_PROXY_LIST is set.")
    p.add_argument("--parallel", "-j", type=int, default=3,
                   help="Concurrent chunks (default: 3)")
    p.add_argument("--chunk-mib", type=int, default=64,
                   help="Range chunk size in MiB (default: 64)")
    p.add_argument("--threshold-mib", type=int, default=64,
                   help="Files smaller than this use single-stream (default: 64)")
    p.add_argument("--chunk-timeout", type=int, default=600,
                   help="Per-chunk timeout in seconds (default: 600)")
    p.add_argument("--no-validate-proxies", action="store_true",
                   help="Skip startup proxy validation (don't rewrite proxy file)")
    return p.parse_args()


def resolve_dest(local_dir_arg: Optional[str], repo_id: str) -> Path:
    """Resolve the destination directory.
    - If `local_dir` is given and is an EXISTING directory (e.g. `t:/models`), nest the
      model under it as `<dir>/<repo-leaf>` — "save into t:/models" puts it in a per-model
      subfolder, not loose in the dir (unless the path already names this model's leaf).
    - Else if `local_dir` is given → use it exactly (a not-yet-existing leaf path).
    - Else if `$HF_DOWNLOAD_DIR` is set → `<root>/<repo-leaf>` (a configured models root).
    - Else → `./<repo-leaf>` (current dir — last resort)."""
    leaf = repo_id.replace("/", "--")
    if local_dir_arg:
        d = Path(local_dir_arg).expanduser()
        if d.is_dir() and d.name != leaf:
            return d / leaf
        return d
    root = os.environ.get("HF_DOWNLOAD_DIR")
    if root:
        return Path(root).expanduser() / leaf
    return Path(".") / leaf


def resolve_proxy_list(arg: Optional[Path]) -> Optional[Path]:
    if arg is not None:
        return arg.expanduser()
    env = os.environ.get("HF_DOWNLOAD_PROXY_LIST")
    if env:
        return Path(env).expanduser()
    return None


def main() -> int:
    args = parse_args()

    repo_id = args.repo_id
    repo_type = "dataset" if (args.dataset or args.type == "dataset") else "model"
    # a pasted datasets URL/path ("datasets/org/repo") implies the type
    if repo_id.startswith("datasets/"):
        repo_id = repo_id[len("datasets/"):]
        repo_type = "dataset"
    if "/" not in repo_id:
        print(f"Error: repo_id must be 'org/repo' form, got: {repo_id}")
        return 2

    local_dir = resolve_dest(args.local_dir, repo_id)
    print(f"Downloading {repo_type} {repo_id} -> {local_dir.resolve()}")

    # Resolve proxies: explicit file/env wins; otherwise default to crt's registry; else direct.
    proxy_path = resolve_proxy_list(args.proxy_list)
    if proxy_path is not None:
        raw_proxies = load_proxies(proxy_path)
    elif not args.no_crt_proxies:
        raw_proxies = proxies_from_crt()
    else:
        raw_proxies = []
    if raw_proxies and not args.no_validate_proxies:
        proxies = validate_and_persist_proxies(raw_proxies, proxy_path)
    else:
        proxies = [u for _, u in raw_proxies]
    if not proxies:
        print("Mode: DIRECT (no proxies)\n")
    else:
        print(f"Mode: {len(proxies)} working proxies\n")

    proxy_iter = cycle_proxies(proxies)

    token = get_hf_token()
    if token:
        print("Using HuggingFace token from env/cache")

    print("Fetching file list...")
    try:
        files = list_repo_files(repo_id, token=token, repo_type=repo_type)
    except Exception as e:
        print(f"Error listing files: {e}")
        return 1
    files = [f for f in files if not f.startswith(".")]
    print(f"Found {len(files)} files")

    # Detect GGUF quantizations
    gguf_quants = extract_gguf_quants(files)
    selected_quant = args.quant
    if gguf_quants and len(gguf_quants) > 1:
        if selected_quant:
            matched = None
            for q in gguf_quants:
                if q.lower() == selected_quant.lower():
                    matched = q
                    break
            if not matched:
                matches = [q for q in gguf_quants if selected_quant.lower() in q.lower()]
                if len(matches) == 1:
                    matched = matches[0]
                elif len(matches) > 1:
                    print(f"\n--quant '{selected_quant}' is ambiguous. Matches: {', '.join(matches)}")
                    return 2
                else:
                    print(f"\n--quant '{selected_quant}' not found. Available: {', '.join(sorted(gguf_quants))}")
                    return 2
            selected_quant = matched
            files = [f for f in files if f in gguf_quants[selected_quant] or is_essential_file(f)]
            print(f"\nSelected quantization: {selected_quant} ({len(files)} files)\n")
        elif sys.stdin.isatty():
            selected_quant = prompt_quant_selection(gguf_quants)
            files = [f for f in files if f in gguf_quants[selected_quant] or is_essential_file(f)]
            print(f"\nSelected: {selected_quant} ({len(files)} files)\n")
        else:
            print(f"\nGGUF repo with {len(gguf_quants)} quantizations. Use --quant to select one.")
            print(f"Available: {', '.join(sorted(gguf_quants))}")
            print("Downloading ALL files (pass --quant to filter)...\n")

    local_dir.mkdir(parents=True, exist_ok=True)
    type_prefix = "datasets/" if repo_type == "dataset" else ""
    base_url = f"https://huggingface.co/{type_prefix}{repo_id}/resolve/main/"

    chunk_size = args.chunk_mib << 20
    threshold_bytes = args.threshold_mib << 20
    parallel = max(1, args.parallel)

    failed_files: list[str] = []

    for i, file_path in enumerate(files, 1):
        dest = local_dir / file_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = base_url + file_path
        desc = f"[{i}/{len(files)}] {file_path}"

        remote_size = get_remote_size(url, proxies, token=token, timeout=30) or 0
        if dest.exists() and remote_size > 0 and dest.stat().st_size == remote_size:
            print(f"{desc}: already downloaded (skipped)")
            continue

        # Decide: parallel range vs single-stream
        use_parallel = (
            parallel > 1
            and remote_size >= threshold_bytes
            and remote_size > chunk_size
        )

        if use_parallel:
            print(f"{desc}: parallel range "
                  f"({remote_size/1024/1024:.1f} MiB, chunk={args.chunk_mib} MiB, j={parallel})")
            ok = download_file_parallel(
                url=url, dest=dest, proxies=proxies, token=token,
                chunk_size=chunk_size, parallel=parallel,
                chunk_timeout=args.chunk_timeout, desc=file_path,
            )
            if not ok:
                print(f"  parallel failed; trying single-stream")
                p = next(proxy_iter)
                ok = download_file_single(url, dest, p, token, desc=file_path)
        else:
            p = next(proxy_iter)
            label = _short_proxy_label(p) if proxies else "direct"
            print(f"{desc}: single-stream via {label}")
            ok = download_file_single(url, dest, p, token, desc=file_path)
            if not ok and proxies:
                p2 = next(proxy_iter)
                print(f"  retry via {_short_proxy_label(p2)}")
                time.sleep(2)
                ok = download_file_single(url, dest, p2, token, desc=file_path)

        if not ok:
            print(f"  FAILED: {file_path}")
            failed_files.append(file_path)

    print(f"\nDone: {local_dir}")
    if failed_files:
        print(f"FAILED ({len(failed_files)} files):")
        for f in failed_files:
            print(f"  - {f}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
