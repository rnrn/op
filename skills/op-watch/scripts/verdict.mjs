#!/usr/bin/env node
// op-watch — deterministic campaign verdict. Computes CLEAN vs CONTINUE from the
// campaign STATE file (never the model's say-so), so a goal-loop driver cannot be
// fooled into stopping early. The last line is machine-readable; exit code mirrors
// it (0 = CLEAN, 1 = CONTINUE/blocked-progress, 2 = error) so `goal`/a driver can
// branch on either.
//
// Usage:
//   node verdict.mjs --state docs/.work/<slug>.json [--validate "<shell cmd>"]
//
// Status buckets:
//   active            = open | in_progress            -> keep looping
//   terminal-resolved = verified | wont_fix | done
//   terminal-human    = blocked | deferred | deferred_validation   (surfaced, not active)
// CLEAN = no active units AND (no --validate, or it passed).

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const STATE = arg("state", "");
const VALIDATE = arg("validate", "");
if (!STATE) { console.error("VERDICT: ERROR — --state <campaign.json> required"); process.exit(2); }

let s;
try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); }
catch (e) { console.error(`VERDICT: ERROR — cannot read ${STATE}: ${e.message}`); process.exit(2); }

const units = Array.isArray(s.units) ? s.units : [];
const ACTIVE = new Set(["open", "in_progress"]);
const RESOLVED = new Set(["verified", "wont_fix", "done"]);
const HUMAN = new Set(["blocked", "deferred", "deferred_validation"]);

const active = units.filter((u) => ACTIVE.has(u.status));
const resolved = units.filter((u) => RESOLVED.has(u.status));
const human = units.filter((u) => HUMAN.has(u.status));
const unknown = units.filter((u) => !ACTIVE.has(u.status) && !RESOLVED.has(u.status) && !HUMAN.has(u.status));

// budget circuit-breaker: if declared and exhausted, the campaign is terminal-human
const budgetOut = s.budget && s.budget.total != null && s.budget.spent != null && s.budget.spent >= s.budget.total;

// optional independent re-check (e.g. validate:dist) — a red gate forces CONTINUE
let validateOk = true, validateNote = "";
if (VALIDATE) {
  const r = spawnSync("bash", ["-lc", VALIDATE], { encoding: "utf8", timeout: 600000 });
  validateOk = r.status === 0;
  validateNote = validateOk ? "validate:ok" : `validate:FAILED(${r.status})`;
}

// surface deferred/blocked explicitly (invariant 8)
for (const u of human) console.log(`  ${u.status.toUpperCase()}: ${u.id} ${u.title || u.segment || ""} ${u.notes ? "— " + u.notes : ""}`.trimEnd());
if (unknown.length) console.log(`  ⚠ ${unknown.length} unit(s) in an unrecognized status: ${unknown.map((u) => u.id + ":" + u.status).slice(0, 6).join(", ")}`);

const summary = `units ${units.length} · active ${active.length} · resolved ${resolved.length} · handed-to-human ${human.length}` +
  (unknown.length ? ` · unknown ${unknown.length}` : "") + (VALIDATE ? ` · ${validateNote}` : "") + (budgetOut ? " · BUDGET-OUT" : "");

// CLEAN only when nothing is active, validate (if any) passed, and no unknown statuses
const clean = active.length === 0 && unknown.length === 0 && validateOk;
console.log(clean
  ? `VERDICT: CLEAN — ${summary}`
  : `VERDICT: CONTINUE — ${summary}${budgetOut && active.length ? " (budget-out: move remaining active to deferred next step)" : ""}`);
process.exit(clean ? 0 : 1);
