#!/usr/bin/env node
// op-watch step-4, mechanized: record a unit transition atomically so the counters
// verdict.mjs relies on are maintained by a script, not agent prose. Sets the unit's
// status, increments its `attempts`, appends one `history` entry with recomputed
// active/resolved counts, and bumps `step` — then writes atomically (temp+rename).
//
// Usage:
//   node mark.mjs --state docs/.work/<slug>.json --unit <id> --status <status> [--notes "..."]
//
// Status must be one of the op-watch buckets (active: open|in_progress|fixed|built ;
// resolved: verified|wont_fix|done ; human: blocked|deferred|deferred_validation).

import fs from "node:fs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : ""; };
const STATE = arg("state"), UNIT = arg("unit"), STATUS = arg("status"), NOTES = arg("notes");
if (!STATE || !UNIT || !STATUS) { console.error("mark: --state, --unit, --status required"); process.exit(2); }

const ACTIVE = new Set(["open", "in_progress", "fixed", "built"]);
const RESOLVED = new Set(["verified", "wont_fix", "done"]);
const HUMAN = new Set(["blocked", "deferred", "deferred_validation"]);
const KNOWN = new Set([...ACTIVE, ...RESOLVED, ...HUMAN]);
if (!KNOWN.has(STATUS)) { console.error(`mark: unknown status "${STATUS}" (not an op-watch bucket)`); process.exit(2); }

let s;
try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); }
catch (e) { console.error(`mark: cannot read ${STATE}: ${e.message}`); process.exit(2); }
const u = (s.units || []).find((x) => x.id === UNIT);
if (!u) { console.error(`mark: no unit "${UNIT}" in ${STATE}`); process.exit(2); }

const from = u.status;
u.attempts = (u.attempts || 0) + 1;
u.status = STATUS;
if (NOTES) u.notes = NOTES;

const active = s.units.filter((x) => ACTIVE.has(x.status)).length;
const resolved = s.units.filter((x) => RESOLVED.has(x.status)).length;
s.step = (s.step || 0) + 1;
(s.history ||= []).push({ step: s.step, active, resolved });

const tmp = STATE + ".tmp";
fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
fs.renameSync(tmp, STATE);  // atomic
console.log(`step ${s.step}: ${UNIT} ${from} -> ${STATUS} (attempts ${u.attempts}) | active ${active} resolved ${resolved}`);
