#!/usr/bin/env node
// op-docup sweep — DRIVER LOOP (the hard, cross-model completion mechanism).
// Re-invokes op-docup with a SINGLE segment scoped per call, over the resumable
// plan-file, until the sweep is complete. This makes per-pass scope a hard
// guarantee (the model cannot blow past one segment), bounds each call with a
// short timeout (a stall is killed and retried, not fatal), and detects "done"
// from the docs actually written — so it is robust to the status-lag seen on
// weak models (they write docs but forget to mark the task done).
//
// The driver is host-agnostic: YOU supply how to invoke the model via --cmd, a
// bash template with placeholders {ROOT} {PROMPT} {TO}. Example (kimi/claude):
//   --cmd 'cd {ROOT} && timeout {TO} crt ask claude --key KIMI_API \
//          --model kimi-k2.7-code --timeout {TO} {ROOT} "$(cat {PROMPT})" \
//          -- --dangerously-skip-permissions'
//
// Usage:
//   node sweep-driver.mjs --root <repo> --since <sha> --head <sha> \
//        --cmd '<template>' [--per-call 1] [--to 600] [--max-calls 12] \
//        [--segmenter <path to segment.js>]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg("root", "."));
const SINCE = arg("since", "");
const HEAD = arg("head", "HEAD");
const CMD = arg("cmd", "");
const PER_CALL = Math.max(1, Number(arg("per-call", "1")));
const TO = Number(arg("to", "600"));
const MAX_CALLS = Number(arg("max-calls", "12"));
const SEGMENTER = path.resolve(arg("segmenter", path.join(here, "segment.js")));
const PLAN = path.join(ROOT, "docs/.docup/sweep-state.json");
const PROMPT = path.join(ROOT, "docs/.docup/_driver_prompt.txt");

if (!CMD) { console.error("--cmd template is required (placeholders {ROOT} {PROMPT} {TO})"); process.exit(2); }

function sh(cmd, to) { return spawnSync("bash", ["-lc", cmd], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: to ? (to + 60) * 1000 : undefined }); }
function readPlan() { try { return JSON.parse(fs.readFileSync(PLAN, "utf8")); } catch { return null; } }
function writePlan(p) { fs.writeFileSync(PLAN, JSON.stringify(p, null, 2)); }
// count working-tree doc changes under a given docs/<track>/ (excludes the .docup state)
function docChangesUnder(seg) {
  const out = sh(`git -C "${ROOT}" -c safe.directory="*" status --porcelain -uall`).stdout || "";
  return out.split("\n").map((l) => l.slice(3)).filter((p) => p.startsWith(seg + "/") && !p.includes("/.docup/")).length;
}
function runModel(promptText) {
  fs.mkdirSync(path.dirname(PROMPT), { recursive: true });
  fs.writeFileSync(PROMPT, promptText);
  const cmd = CMD.replaceAll("{ROOT}", `'${ROOT}'`).replaceAll("{PROMPT}", `'${PROMPT}'`).replaceAll("{TO}", String(TO));
  const r = sh(cmd, TO);
  return { ok: r.status === 0, status: r.status, log: `${r.stdout || ""}\n${r.stderr || ""}` };
}

// ---- 0. scope-freeze (deterministic) if no plan-file yet ----
if (!readPlan()) {
  console.log("[driver] scope-freeze via segment.js");
  const r = sh(`node "${SEGMENTER}" --root "${ROOT}" ${SINCE ? `--since "${SINCE}"` : ""} --head "${HEAD}" --apply`);
  process.stdout.write(r.stdout || ""); if (r.status !== 0) { console.error("[driver] segment.js failed:", (r.stderr || "").slice(0, 300)); process.exit(1); }
}
let plan = readPlan();
if (!plan) { console.error("[driver] no plan-file after scope-freeze"); process.exit(1); }

// ---- 1. per-segment loop ----
let calls = 0;
const segPrompt = (t) => `An op-docup sweep plan-file exists at docs/.docup/sweep-state.json (sweep mode).
Process ONLY segment "${t.id}" — track ${t.segment}. Read ONLY that track's in-scope commits
(${(t.scope?.commits || []).join(", ") || "see plan"}) and that track's existing docs. With --apply,
create/update ONLY that track's stories/epics, matching the existing BMAD format. Then set this task's
"status" to "done" (with a short result.summary) in the plan-file. Do NOT touch other segments,
docs/INDEX.md, taxonomy, or the merge step. Follow the op-docup skill's per-segment rules; never run
git add/commit/reset. End with the skill's exact completion status line.`;

while (calls < MAX_CALLS) {
  plan = readPlan();
  const pending = plan.tasks.filter((t) => t.status === "pending");
  if (!pending.length) break;
  const batch = pending.slice(0, PER_CALL);
  for (const t of batch) {
    calls++;
    const before = docChangesUnder(t.segment);
    process.stdout.write(`[driver] call ${calls}: segment ${t.id} ${t.segment} ... `);
    const res = runModel(segPrompt(t));
    plan = readPlan(); // model may have updated it
    const tn = plan.tasks.find((x) => x.id === t.id);
    const after = docChangesUnder(t.segment);
    if (tn && tn.status === "done") { console.log("done (self-reported)"); }
    else if (after > before) { tn.status = "done"; tn.result = tn.result || { wrote: after - before, summary: "driver-marked: docs written (status-lag)" }; writePlan(plan); console.log(`done (driver-marked, +${after - before} docs)`); }
    else if (res.ok) { tn.status = "done"; tn.result = { wrote: 0, summary: "no-docs-needed (clean call, no writes)" }; writePlan(plan); console.log("done (no-docs-needed)"); }
    else { tn._attempts = (tn._attempts || 0) + 1; if (tn._attempts >= 2) { tn.status = "blocked"; tn.result = { summary: `blocked after ${tn._attempts} attempts (exit ${res.status})` }; console.log("BLOCKED (retries exhausted)"); } else { console.log(`retry (exit ${res.status})`); } writePlan(plan); }
  }
}

// ---- 2. merge (one bounded call) ----
plan = readPlan();
const allResolved = plan.tasks.every((t) => t.status === "done" || t.status === "blocked");
if (allResolved && plan.merge?.status !== "done") {
  calls++;
  process.stdout.write(`[driver] call ${calls}: merge ... `);
  const res = runModel(`All segments of the sweep plan-file docs/.docup/sweep-state.json are processed.
Run ONLY the merge phase: from the per-segment result summaries (do NOT re-process segments), reconcile
docs/INDEX.md / taxonomy once, enforce single source of truth, then set merge.status="done" and the
top-level status="complete", and write DOCUP_CHECKPOINT.md. Never run git add/commit/reset. End with the
skill's exact completion status line.`);
  plan = readPlan();
  if (plan.merge?.status !== "done") { plan.merge = plan.merge || {}; plan.merge.status = res.ok ? "done" : "pending"; plan.merge.indexesReconciled = res.ok ? docChangesUnder("docs") >= 0 : false; }
  if (res.ok && plan.tasks.every((t) => t.status === "done")) plan.status = "complete";
  writePlan(plan);
  console.log(plan.status === "complete" ? "done -> sweep complete" : `merge ${plan.merge.status}`);
}

// ---- 3. report ----
plan = readPlan();
const done = plan.tasks.filter((t) => t.status === "done").length;
const blocked = plan.tasks.filter((t) => t.status === "blocked").length;
console.log(`\n[driver] ${calls} call(s). segments: ${done} done, ${blocked} blocked / ${plan.tasks.length}. merge: ${plan.merge?.status}. status: ${plan.status}.`);
try { fs.unlinkSync(PROMPT); } catch {}
process.exit(plan.status === "complete" ? 0 : 1);
