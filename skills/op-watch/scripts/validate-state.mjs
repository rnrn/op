#!/usr/bin/env node
// op-watch state validator (gate). Catches the ways a hand-written ledger goes wrong —
// proven necessary when a cheap model hand-wrote state instead of using the scripts:
//   1. unparseable JSON (a missing brace stalls the whole campaign);
//   2. DUPLICATE unit ids (silently inflate active counts → the loop can't converge).
// Run it after every step. `--fix` dedups by id (keeping the most-resolved status) and
// rewrites atomically; without it, a corrupt ledger is reported and the step halts.
//
//   node validate-state.mjs --state docs/.work/<slug>.json [--fix]
// Exit 0 = valid (or fixed) · 2 = invalid (needs repair).

import fs from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const STATE = arg("state", "");
const FIX = process.argv.includes("--fix");
if (!STATE) { console.error("STATE-INVALID: --state <file> required"); process.exit(2); }

const KNOWN = new Set(["open", "in_progress", "fixed", "built", "verified", "wont_fix", "done", "blocked", "deferred", "deferred_validation"]);
const RESOLVED = new Set(["verified", "wont_fix", "done"]);

let s;
try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); }
catch (e) { console.error(`STATE-INVALID: cannot parse ${STATE}: ${e.message}`); process.exit(2); }

const units = Array.isArray(s.units) ? s.units : null;
if (!units) { console.error("STATE-INVALID: `units` is missing or not an array"); process.exit(2); }

// duplicate unit ids
const seen = new Map();
const dups = [];
for (const u of units) { if (seen.has(u.id)) dups.push(u.id); else seen.set(u.id, true); }
const dupIds = [...new Set(dups)];

// unknown statuses (soft — surfaced, not fatal: verdict.mjs already buckets these)
const unknown = units.filter((u) => !KNOWN.has(u.status)).map((u) => `${u.id}:${u.status}`);
if (unknown.length) console.log(`  ⚠ unknown status: ${unknown.slice(0, 6).join(", ")}`);

if (dupIds.length) {
  if (!FIX) { console.error(`STATE-INVALID: duplicate unit id(s): ${dupIds.join(", ")} (run with --fix to dedup)`); process.exit(2); }
  // dedup: keep the most-resolved record per id
  const byId = {};
  for (const u of units) {
    const e = byId[u.id];
    if (!e || (RESOLVED.has(u.status) && !RESOLVED.has(e.status))) byId[u.id] = u;
  }
  s.units = Object.values(byId);
  const tmp = STATE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, STATE);
  console.log(`STATE-FIXED: deduped ${units.length} -> ${s.units.length} unit(s) (removed dup id ${dupIds.join(", ")})`);
  process.exit(0);
}

console.log(`STATE-OK: ${units.length} unit(s), no duplicate ids`);
process.exit(0);
