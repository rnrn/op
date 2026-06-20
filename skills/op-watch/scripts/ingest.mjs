#!/usr/bin/env node
// op-watch — natural-key findings ingest (WATCH-3). Merge a findings ledger
// (op-audit / drift / debt output) into the campaign's units WITHOUT duplicating a
// defect that two skills reported independently: the natural key (domain+locus
// [+defect-class], line/skill-independent) is the identity, so the same logical
// defect collapses to ONE unit. Re-baseline reuses it to match existing units
// instead of re-opening just-closed ones.
//
// Usage:
//   node ingest.mjs --state docs/.work/<slug>.json --findings <ledger.json> [--write]
//     <ledger.json> = array of {id?, domain, location|paths, predicate|title, symbol?, severity?}
//
// Without --write: prints the merge plan (new vs matched) and exits 0. With --write:
// appends new units (status "open") to state.units atomically; never touches an
// existing unit's status (reconcile-from-repo stays the dispatcher's job).

import fs from "node:fs";
import path from "node:path";
import { naturalKey } from "../../../scripts/lib/finding-key.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const STATE = arg("state", "");
const FINDINGS = arg("findings", "");
const WRITE = process.argv.includes("--write");
if (!STATE || !FINDINGS) { console.error("ingest: --state and --findings are required"); process.exit(2); }

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
let state, findings;
try { state = readJson(STATE); } catch (e) { console.error(`ingest: cannot read state ${STATE}: ${e.message}`); process.exit(2); }
try { findings = readJson(FINDINGS); } catch (e) { console.error(`ingest: cannot read findings ${FINDINGS}: ${e.message}`); process.exit(2); }
if (!Array.isArray(state.units)) state.units = [];
const list = Array.isArray(findings) ? findings : (Array.isArray(findings.findings) ? findings.findings : []);

const keyOf = (f) => naturalKey({
  domain: f.domain, paths: f.paths, location: f.location,
  predicate: f.predicate || f.title, symbol: f.symbol,
}).keyFull;

// Index existing units by their stored key (or recompute from their carried fields).
const seen = new Map();
for (const u of state.units) {
  const k = u.key || (u.domain || u.location || u.paths ? keyOf(u) : null);
  if (k) seen.set(k, u);
}

const added = [], matched = [];
for (const f of list) {
  const k = keyOf(f);
  if (seen.has(k)) { matched.push({ key: k, into: seen.get(k).id }); continue; }
  const unit = {
    id: f.id || `u-${state.units.length + added.length + 1}`,
    status: "open",
    title: f.title || f.predicate || k,
    key: k,
    domain: f.domain || "",
    location: f.location || (Array.isArray(f.paths) ? f.paths.join("; ") : ""),
    severity: f.severity || "",
    attempts: 0,
  };
  added.push(unit);
  seen.set(k, unit);
}

console.log(`ingest: ${list.length} finding(s) → ${added.length} new unit(s), ${matched.length} matched existing (deduped)`);
for (const m of matched) console.log(`  matched ${m.key}  → ${m.into}`);
for (const a of added) console.log(`  +unit ${a.id}  ${a.key}`);

if (WRITE && added.length) {
  state.units.push(...added);
  const tmp = path.join(path.dirname(STATE), `.${path.basename(STATE)}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE);  // atomic
  console.log(`ingest: wrote ${added.length} unit(s) to ${STATE}`);
}
process.exit(0);
