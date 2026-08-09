#!/usr/bin/env node
// op-watch acceptance gate — deterministic OUTPUT control at verify/closure. A resolved
// unit must (1) have its claimed `files` actually on disk, and (2) keep them within the
// project's declared stack (else a recorded Decision). This enforces, on the REAL
// artifacts, what op-preflight only advises — catching the two failure modes preflight
// can't (it runs before files exist):
//   - false-done: status flipped to done/verified but the files were never written;
//   - silent stack deviation: a non-declared language slipped in (e.g. a Python adapter
//     in a Go repo) without a recorded decision.
//
// The base check trusts the unit's self-reported `files[]`. Three opt-in modes close the
// gap where a model under-reports the manifest or ships a hollow file (the manifest is only
// as honest as the model):
//   --scan          file-truth INDEPENDENT of files[]: walk the directories the resolved
//                   units actually wrote into (parents of their files[]) and stack-check
//                   EVERY code file there, incl. gitignored siblings the manifest omitted.
//   --git           add `git status --porcelain` changed files to the stack-check set
//                   (tracked-file truth; misses gitignored — pair with --scan).
//   --min-bytes N   stub guard: a claimed file that exists but has < N bytes of
//                   substantive (non-blank, non-comment) content is a hollow false-done.
//   --build "<cmd>" functional acceptance: run a build/compile cmd in root; non-zero blocks.
//
// `--fix` demotes failing units (missing/stub→in_progress, stack→deferred) so verdict.mjs
// reflects reality instead of trusting the status.
//
//   node accept.mjs --state docs/.work/<slug>.json --root <repo> [--declared "go,ts"] \
//        [--scan] [--git] [--min-bytes 40] [--build "go build ./..."] [--fix]
// Exit 0 = all resolved units accept (or were demoted with --fix) · 2 = gate failure.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const STACK_CHECK = path.resolve(here, "../../../scripts/lib/stack-check.mjs");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const STATE = arg("state", ""), ROOT = arg("root", ".");
const FIX = process.argv.includes("--fix");
const SCAN = process.argv.includes("--scan");
const GIT = process.argv.includes("--git");
const MIN_BYTES = Number(arg("min-bytes", "0"));   // 0 = stub guard off
const BUILD = arg("build", "");
const SCAN_ROOT = arg("scan-root", "");            // explicit override for --scan dirs
const DECISIONS = arg("decisions", "");            // path to decisions.yaml; "" = off
if (!STATE) { console.error("accept: --state required"); process.exit(2); }

// declared stack: explicit arg, else AGENTS.md Stack Profile `Language(s)` row, else AUTO-DETECT
// from build manifests. Auto-detect matters: a `TODO`/missing profile must NOT silently turn the
// stack-deviation check off (the F-P anti-pattern at the accept layer) — any real codebase has a
// manifest that names its language. If detection is unambiguous we check against it; if it can't be
// determined AND code files are present, that's surfaced loudly + blocks CLEAN-DONE (not a silent pass).
let declared = arg("declared", ""), declaredSrc = declared ? "arg" : "";
if (!declared) {
  try {
    const m = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8").match(/\|\s*Language\(s\)\s*\|\s*([^|]+)\|/i);
    // strip markdown formatting (`backticks`, quotes, bold **) — a human/agent often writes
    // `| Language(s) | `go` |` per the template's example; the bare token is what we want.
    if (m && !/TODO/i.test(m[1])) { declared = m[1].replace(/[`'"*]/g, "").trim(); declaredSrc = "profile"; }
  } catch { /* no AGENTS.md / no profile */ }
}
if (!declared) {
  // auto-detect from manifests at the repo root (shallow): exactly one signal → use it
  const MANIFEST_LANG = { "go.mod": "go", "package.json": "javascript", "tsconfig.json": "typescript", "Cargo.toml": "rust", "pyproject.toml": "python", "requirements.txt": "python", "pom.xml": "java", "build.gradle": "java", "Gemfile": "ruby", "composer.json": "php" };
  const found = new Set();
  try { for (const e of fs.readdirSync(ROOT)) if (MANIFEST_LANG[e]) found.add(MANIFEST_LANG[e]); } catch { /* unreadable root */ }
  // .csproj anywhere shallow → csharp
  try { if (fs.readdirSync(ROOT).some((e) => e.endsWith(".csproj"))) found.add("csharp"); } catch {}
  if (found.size === 1) { declared = [...found][0]; declaredSrc = "auto-detected"; }
}

let s;
try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); }
catch (e) { console.error(`accept: cannot read ${STATE}: ${e.message}`); process.exit(2); }
const RESOLVED = new Set(["verified", "done", "wont_fix"]);
const units = Array.isArray(s.units) ? s.units : [];

// --- helpers ---------------------------------------------------------------
const SKIP_DIR = new Set([".git", "node_modules", "vendor", ".work", "dist", ".beads", ".idea", "__pycache__", ".claude", ".agents", ".codex"]);
const CODE_EXT = new Set(["js","mjs","cjs","jsx","ts","tsx","py","go","rs","java","kt","rb","php","cs","swift","scala","cpp","cc","cxx","c","h","hpp","m","mm","ex","exs","erl","clj","dart","lua","r","jl","hs","ml","zig"]);
const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, "/");
function walkCode(dir, acc) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (SKIP_DIR.has(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walkCode(fp, acc);
    else { const ext = e.name.includes(".") ? e.name.split(".").pop().toLowerCase() : ""; if (CODE_EXT.has(ext)) acc.push(fp); }
  }
}
// Files covered by an ACCEPTED stack ADR (status: accepted) in decisions.yaml — a deliberate,
// recorded deviation (e.g. Python integration tests in a Go repo) is decided, not a failure.
// Without this the gate would re-demote a legitimately-decided second language every step, so a
// project that records a Decision could never reach CLEAN-DONE. (Promote the decision to the ADR
// log to clear the gate; a pending/undecided deviation still demotes.)
function acceptedDeviationFiles() {
  const p = DECISIONS || path.join(ROOT, "docs/decisions/decisions.yaml");
  let txt; try { txt = fs.readFileSync(p, "utf8"); } catch { return new Set(); }
  const set = new Set();
  for (const chunk of txt.split(/\n(?=- id:)/)) {
    if (!/status:\s*accepted/i.test(chunk) || !/category:\s*stack/i.test(chunk)) continue;
    // affects entries that look like file paths (have an extension); skips alternatives/commits prose
    for (const m of chunk.matchAll(/^\s*-\s+([^\s:][^\n]*\.[A-Za-z0-9]+)\s*$/gm)) set.add(m[1].trim().replace(/\\/g, "/"));
  }
  return set;
}
const ACCEPTED_DEV = acceptedDeviationFiles();
const decided = (line) => ACCEPTED_DEV.has((line.split("→")[0] || "").trim());

function stackDeviations(fileList) {
  if (!declared || !fileList.length) return [];
  const r = spawnSync("node", [STACK_CHECK, "--declared", declared, "--files", fileList.join(",")], { encoding: "utf8" });
  if (r.status !== 2) return [];
  return (r.stdout || "").split("\n").filter((l) => /→/.test(l)).map((l) => l.trim()).filter((l) => !decided(l));
}
// Draft a `status: pending` ADR for each stack-deviation unit so the handoff carries a
// ready decision record, not just a note. accept only PROPOSES (pending) — op-decision-memory
// remains the canonical writer that flips it to `accepted` on human confirmation. Idempotent
// via a per-unit marker comment embedded in the decision text.
function draftPendingDecisions(stackFails) {
  if (!DECISIONS || !stackFails.length) return 0;
  let txt = "";
  try { txt = fs.readFileSync(DECISIONS, "utf8"); } catch { txt = "decisions:\n"; }
  if (!/^decisions:/m.test(txt)) txt = "decisions:\n" + txt;
  let maxId = 0;
  for (const m of txt.matchAll(/id:\s*ADR-(\d+)/g)) maxId = Math.max(maxId, Number(m[1]));
  const date = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const f of stackFails) {
    const marker = `accept-gate-draft:${f.u.id}`;
    if (txt.includes(marker)) continue;  // already drafted for this unit
    const lang = (f.detail.match(/→\s*([A-Za-z+#]+)/) || [])[1] || "non-declared";
    const devFiles = [...f.detail.matchAll(/([^\s,;]+\.[A-Za-z0-9]+)\s*→/g)].map((m) => m[1]);
    const affects = (devFiles.length ? devFiles : (f.u.files || [])).slice(0, 12);
    maxId++;
    const adr = `ADR-${String(maxId).padStart(3, "0")}`;
    const block = [
      `- id: ${adr}`,
      `  date: '${date}'`,
      `  category: stack`,
      `  decision: 'PENDING: ${lang} files introduced under ${f.u.id} in a ${declared}-declared repo (${marker})'`,
      `  rationale: 'Auto-drafted by op-watch accept gate — ${f.detail.replace(/'/g, "")}. CONFIRM one: accept (declare ${lang} in AGENTS.md Stack Profile + isolate in its own dir) OR reject (rewrite in ${declared}). Unit stays deferred until a human flips status to accepted/rejected.'`,
      `  affects:`,
      ...affects.map((x) => `  - ${x}`),
      `  alternatives:`,
      `  - Rewrite in ${declared}`,
      `  - Declare ${lang} in Stack Profile + isolate the dir`,
      `  status: pending`,
      `  commits:`,
      `  - ${f.u.id}`,
    ].join("\n");
    txt = txt.replace(/^decisions:[ \t]*\n/m, (m) => m + block + "\n");
    f.u.notes = `${f.u.notes || ""} [draft ${adr} pending]`.trim();
    added++;
  }
  if (added) {
    const tmp = DECISIONS + ".tmp";
    fs.mkdirSync(path.dirname(path.resolve(DECISIONS)), { recursive: true });
    fs.writeFileSync(tmp, txt);
    fs.renameSync(tmp, DECISIONS);
    console.log(`accept: drafted ${added} pending Decision(s) → ${DECISIONS} (op-decision-memory confirms)`);
  }
  return added;
}

function substantiveBytes(text) {
  let n = 0;
  for (let l of text.split("\n")) {
    l = l.trim();
    if (!l) continue;
    if (/^(\/\/|#|\*|\/\*|--|<!--)/.test(l)) continue;  // comment-only line
    n += l.length;
  }
  return n;
}

const fails = [];
const resolvedUnits = units.filter((u) => RESOLVED.has(u.status));

// --- base checks per resolved unit (files[] manifest) ----------------------
for (const u of units) {
  if (!RESOLVED.has(u.status) || u.status === "wont_fix") continue;  // wont_fix has no artifacts
  const files = Array.isArray(u.files) ? u.files : [];
  if (!files.length) continue;  // nothing claimed → nothing to gate
  const missing = files.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) { fails.push({ u, kind: "missing", detail: `${missing.length}/${files.length} claimed files missing: ${missing.slice(0, 3).join(", ")}` }); continue; }
  if (declared) {
    const dev = stackDeviations(files);
    if (dev.length) fails.push({ u, kind: "stack", detail: `stack deviation: ${dev.slice(0, 3).join("; ")}` });
  }
  // P2 candidate 2b — stub guard: claimed file exists but is hollow
  if (MIN_BYTES > 0) {
    for (const f of files) {
      const ext = f.includes(".") ? f.split(".").pop().toLowerCase() : "";
      if (!CODE_EXT.has(ext)) continue;
      let txt = ""; try { txt = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; }
      const sb = substantiveBytes(txt);
      if (sb < MIN_BYTES) { fails.push({ u, kind: "stub", detail: `${f} is a hollow stub (${sb}B substantive < ${MIN_BYTES})` }); break; }
    }
  }
}

// --- P1 candidate 1b (--scan): file-truth independent of files[] ------------
// Walk the directories the resolved units actually wrote into and stack-check EVERY code
// file there. Catches a deviant sibling the model omitted from files[] (incl. gitignored).
if (SCAN && declared) {
  const dirs = new Set();
  if (SCAN_ROOT) dirs.add(path.resolve(ROOT, SCAN_ROOT));
  else for (const u of resolvedUnits) for (const f of (u.files || [])) dirs.add(path.dirname(path.resolve(ROOT, f)));
  const claimed = new Set(resolvedUnits.flatMap((u) => (u.files || []).map((f) => f.replace(/\\/g, "/"))));
  const scanned = [];
  for (const d of dirs) walkCode(d, scanned);
  const scannedRel = [...new Set(scanned.map(rel))];
  const dev = stackDeviations(scannedRel);
  for (const line of dev) {
    const file = line.split("→")[0].trim();
    const omitted = !claimed.has(file);
    // attribute to the resolved unit owning this directory, else the first resolved unit
    const owner = resolvedUnits.find((u) => (u.files || []).some((f) => path.dirname(f.replace(/\\/g, "/")) === path.dirname(file))) || resolvedUnits[0];
    if (owner) fails.push({ u: owner, kind: "stack", detail: `scan found ${line}${omitted ? " (omitted from files[])" : ""}` });
  }
}

// --- P1 candidate 1a (--git): tracked-change truth -------------------------
if (GIT && declared) {
  const g = spawnSync("bash", ["-lc", `git -C '${ROOT}' -c safe.directory='*' status --porcelain`], { encoding: "utf8" });
  const changed = (g.stdout || "").split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, "")).filter((f) => CODE_EXT.has(f.split(".").pop().toLowerCase()));
  const claimed = new Set(resolvedUnits.flatMap((u) => (u.files || []).map((f) => f.replace(/\\/g, "/"))));
  const dev = stackDeviations(changed);
  for (const line of dev) {
    const file = line.split("→")[0].trim();
    if (claimed.has(file)) continue;  // already covered by base/scan
    const owner = resolvedUnits[0];
    if (owner) fails.push({ u: owner, kind: "stack", detail: `git change ${line} (unclaimed)` });
  }
}

// --- P2 candidate 2a (--build): functional acceptance (campaign-level) ------
let buildFail = "";
if (BUILD && resolvedUnits.length) {
  const r = spawnSync("bash", ["-lc", `cd '${ROOT}' && ${BUILD}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) buildFail = ((r.stderr || r.stdout || "").trim().split("\n").slice(-4).join(" / ")) || `exit ${r.status}`;
}

// --- undeclared-stack gate: code present but NO stack determinable → never silently pass (F-P) --
// The stack-deviation check above is off whenever `declared` is empty (no arg, no profile, no single
// manifest signal). If resolved units ship code files in that state, the guard is silently disabled —
// surface it loudly and block CLEAN-DONE (via a state flag verdict.mjs reads), WITHOUT per-unit
// demotion (a project can't have code in no language; it must declare — but demoting every unit would
// be over-broad). Declaring AGENTS.md Stack Profile `Language(s)` (or any manifest) clears it.
const undeclaredWithCode = !declared && resolvedUnits.some((u) => (u.files || []).some((f) => CODE_EXT.has((f.split(".").pop() || "").toLowerCase())));

// --- report + fix ----------------------------------------------------------
const resolvedN = resolvedUnits.length;
const writeState = () => { const tmp = STATE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(s, null, 2)); fs.renameSync(tmp, STATE); };
if (!fails.length && !buildFail && !undeclaredWithCode) {
  if (FIX) {  // reconcile stale campaign-gate flags when the run is otherwise clean
    let changed = false;
    if (s.gate_stack_undeclared) { delete s.gate_stack_undeclared; changed = true; }  // a stack is now declared
    if (s.gate_build && BUILD) { delete s.gate_build; changed = true; }  // build was re-run this pass and passed (we're in the no-buildFail branch)
    if (changed) writeState();
  }
  console.log(`accept: OK — ${resolvedN} resolved unit(s) pass (files exist${declared ? `, within stack ${declared}${declaredSrc === "auto-detected" ? " [auto-detected]" : ""}` : ""}${SCAN ? ", scan clean" : ""}${MIN_BYTES ? ", no stubs" : ""}${BUILD ? ", build green" : ""})`);
  process.exit(0);
}

// de-dup fails by unit+kind+detail
const seen = new Set();
const uniqFails = fails.filter((f) => { const k = `${f.u.id}|${f.kind}|${f.detail}`; if (seen.has(k)) return false; seen.add(k); return true; });
for (const f of uniqFails) console.log(`  ACCEPT-FAIL ${f.u.id} [${f.kind}] — ${f.detail}`);
if (buildFail) console.log(`  ACCEPT-FAIL [build] — ${BUILD} failed: ${buildFail}`);
if (undeclaredWithCode) console.log(`  ACCEPT-FAIL [undeclared-stack] — resolved units ship code files but no declared stack (AGENTS.md Language(s)=TODO/missing, no --declared, no single manifest signal): the stack-deviation guard is OFF. Declare the language to enable it — blocks CLEAN-DONE until then.`);

if (FIX) {
  for (const f of uniqFails) {
    if (f.kind === "missing" || f.kind === "stub") { f.u.status = "in_progress"; f.u.notes = `accept: ${f.detail}`; }
    else { f.u.status = "deferred"; f.u.notes = `accept: ${f.detail} — record a Decision (GP1)`; }
  }
  // close path A: draft a pending ADR for each stack deviation so the handoff carries a record
  draftPendingDecisions(uniqFails.filter((f) => f.kind === "stack"));
  if (buildFail) s.gate_build = `FAIL: ${buildFail}`; else delete s.gate_build;
  if (undeclaredWithCode) s.gate_stack_undeclared = true; else delete s.gate_stack_undeclared;
  writeState();
  const demoted = uniqFails.length;
  console.log(`accept: demoted ${demoted} unit(s) — missing/stub→in_progress, stack→deferred${buildFail ? "; recorded gate_build FAIL" : ""}${undeclaredWithCode ? "; recorded gate_stack_undeclared (blocks CLEAN-DONE)" : ""} (verdict now reflects reality)`);
  // a campaign-level gate with nothing unit-attributable still signals failure via exit 2
  process.exit((buildFail || undeclaredWithCode) && !demoted ? 2 : 0);
}
process.exit(2);
