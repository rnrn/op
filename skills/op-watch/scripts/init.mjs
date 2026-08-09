#!/usr/bin/env node
// op-watch derive writer. The agent supplies the charter + a units array (structured
// data it already has from op-planner/op-audit); this script writes a VALID initial
// campaign state atomically — so a cheap model never hand-writes the top-level JSON (the
// derive step is exactly where a missing brace stalled a whole campaign). Dedups unit
// ids, normalizes statuses, seeds step 0 / empty history.
//
//   node init.mjs --state docs/.work/<slug>.json --charter "<intent>" --units <units.json>
//     [--done-condition ledger-clean|epic-closure-gate|units-verified] [--type build|remediation]
//     [--test-language go] [--anchor epic-1] [--branch feature/x]
// <units.json> = array of {id, name?, status?(default open), attempts?(0), files?[], key?}
// Charter shape on disk: `charter` is the intent STRING; the other charter facts
// (done_condition, campaign_type, test_language, anchor, branch) are TOP-LEVEL fields —
// scripts read them there. (SKILL.md describes the same layout.)

import fs from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const STATE = arg("state", ""), CHARTER = arg("charter", ""), UNITS = arg("units", "");
if (!STATE || !CHARTER || !UNITS) { console.error("init: --state, --charter, --units required"); process.exit(2); }

const KNOWN = new Set(["open", "in_progress", "fixed", "built", "verified", "wont_fix", "done", "blocked", "deferred", "deferred_validation"]);
const RESOLVED = new Set(["verified", "wont_fix", "done"]);

let raw;
try { raw = JSON.parse(fs.readFileSync(UNITS, "utf8")); }
catch (e) { console.error(`init: cannot parse units ${UNITS}: ${e.message}`); process.exit(2); }
const list = Array.isArray(raw) ? raw : (Array.isArray(raw.units) ? raw.units : null);
if (!list) { console.error("init: units must be a JSON array (or {units:[...]})"); process.exit(2); }

// dedup by id (keep most-resolved), normalize
const byId = {};
for (const u of list) {
  if (!u || !u.id) { console.error("init: every unit needs an id"); process.exit(2); }
  const status = KNOWN.has(u.status) ? u.status : "open";
  const norm = { id: String(u.id), name: u.name || u.title || u.id, type: u.type || arg("type", "build"), status, attempts: Number(u.attempts) || 0, ...(u.files ? { files: u.files } : {}), ...(u.key ? { key: u.key } : {}) };
  const e = byId[u.id];
  if (!e || (RESOLVED.has(status) && !RESOLVED.has(e.status))) byId[u.id] = norm;
}
const units = Object.values(byId);

const TESTLANG = arg("test-language", ""), ANCHOR = arg("anchor", ""), BRANCH = arg("branch", "");
const state = {
  charter: CHARTER,
  campaign_type: arg("type", "build"),
  done_condition: arg("done-condition", "ledger-clean"),
  ...(TESTLANG ? { test_language: TESTLANG } : {}),
  ...(ANCHOR ? { anchor: ANCHOR } : {}),
  ...(BRANCH ? { branch: BRANCH } : {}),
  derive_complete: true,
  step: 0,
  units,
  history: [],
  budget: { total: null, spent: 0 },
};
const tmp = STATE + ".tmp";
fs.mkdirSync(STATE.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
fs.renameSync(tmp, STATE);
console.log(`init: wrote ${units.length} unit(s) to ${STATE} (deduped from ${list.length})`);
