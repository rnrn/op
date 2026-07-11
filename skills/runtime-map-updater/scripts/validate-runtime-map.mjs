#!/usr/bin/env node
// Mechanical contract check for a runtime/architecture map HTML (runtime-map-updater skill).
// Ported and generalized from cognitron's validate_runtime_map.py: the map is a VERIFIED view —
// catalog↔data-service parity, node↔nodeDetails parity, the detail-panel interaction contract,
// no stale hard-coded task counts, and every referenced task exists and is still open.
// Optional sources (--catalog, tasks) are skipped with a note, never silently. One-line errors,
// capped output; exit 0 clean / 1 errors / 2 usage.
//
//   node validate-runtime-map.mjs --map <map.html> [--root <repo>] [--catalog <stack-doc.md>]
//     [--catalog-stop <heading substring>] [--tasks-dir <dir>]

import fs from "node:fs";
import path from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
if (process.argv.some((a) => a === "--help" || a === "-h") || !arg("map", "")) {
  console.log("usage: validate-runtime-map.mjs --map <map.html> [--root <repo>] [--catalog <doc.md>] [--catalog-stop <str>] [--tasks-dir <dir>]");
  process.exit(arg("map", "") ? 0 : 2);
}
const ROOT = path.resolve(arg("root", "."));
const MAP = path.resolve(ROOT, arg("map", ""));
if (!fs.existsSync(MAP)) { console.error(`validate-runtime-map: map not found: ${MAP}`); process.exit(2); }
const doc = fs.readFileSync(MAP, "utf8");
const errors = [], notes = [];

// 1. catalog ↔ data-service parity (optional source)
const CATALOG = arg("catalog", "");
if (CATALOG) {
  const catPath = path.resolve(ROOT, CATALOG);
  if (!fs.existsSync(catPath)) errors.push(`catalog doc not found: ${CATALOG}`);
  else {
    let md = fs.readFileSync(catPath, "utf8");
    const stop = arg("catalog-stop", "");
    if (stop && md.includes(stop)) md = md.slice(0, md.indexOf(stop));
    // a catalog row = a table row whose first cell starts with bold; the service name is the
    // WHOLE first cell with **/` stripped (matches the original python semantics)
    const expected = [...md.matchAll(/^\|([^|\n]+)\|/gm)]
      .map((m) => m[1].trim()).filter((c) => c.startsWith("**"))
      .map((c) => c.replace(/\*\*/g, "").replace(/`/g, "").trim());
    const actual = [...doc.matchAll(/data-service="([^"]+)"/g)].map((m) => m[1].trim());
    const missing = expected.filter((s) => !actual.includes(s)).sort();
    const extra = actual.filter((s) => !expected.includes(s)).sort();
    const dupes = [...new Set(actual.filter((s, i) => actual.indexOf(s) !== i))].sort();
    if (missing.length) errors.push(`services missing from map: ${missing.join(", ")}`);
    if (extra.length) errors.push(`services absent from catalog: ${extra.join(", ")}`);
    if (dupes.length) errors.push(`duplicate data-service entries: ${dupes.join(", ")}`);
    if (!errors.length) notes.push(`catalog parity: ${expected.length} service(s)`);
  }
} else notes.push("catalog check skipped (no --catalog declared)");

// 2. node ↔ nodeDetails parity
const nodeIds = [...doc.matchAll(/data-node="([a-z0-9-]+)"/g)].map((m) => m[1]).sort();
const detailsBlock = /const nodeDetails\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(doc);
const detailIds = detailsBlock ? [...detailsBlock[1].matchAll(/^\s+["']?([a-z0-9-]+)["']?:\s*\{/gm)].map((m) => m[1]).sort() : [];
if (!detailsBlock) errors.push("no nodeDetails object found in the map script");
else if (JSON.stringify(nodeIds) !== JSON.stringify(detailIds))
  errors.push(`node/detail mismatch: nodes=[${nodeIds}] details=[${detailIds}]`);
else notes.push(`node/detail parity: ${nodeIds.length} node(s)`);

// 3. detail-panel interaction contract
const CONTRACTS = {
  "desktop width token": /--panel-width:\s*min\(800px,\s*50vw\)/,
  "desktop width binding": /width:\s*var\(--panel-width\)/,
  "viewport height token": /--panel-max-height:\s*80vh/,
  "vertical anchor": /top:\s*50%/,
  "vertical centering": /translate\(28px,\s*-50%\)/,
  "zoom compensation": /initialDevicePixelRatio\s*\/\s*currentDevicePixelRatio/,
  "scaled transform": /scale\(var\(--panel-scale\)\)/,
  "all tasks entrypoint": /id="all-tasks-button"/,
  "whole-system scenario selected by default": /data-scenario="all"[^>]*aria-pressed="true"/,
  "shared epic filters": /id="epic-filters"/,
  "aggregate task body": /id="all-tasks-body"/,
  "shared selected epic state": /const selectedEpics\s*=\s*new Set\(epicNames\)/,
  "external block tooltip": /id="block-tooltip"/,
  "tooltip outside scroll panel": /\.block-tooltip\s*\{[^}]*position:\s*fixed/,
  "detail text minimum": /\.detail-panel\s*\{[^}]*font-size:\s*14px/,
};
for (const [label, re] of Object.entries(CONTRACTS)) if (!re.test(doc)) errors.push(`detail panel contract missing: ${label}`);

// 4. stale hard-coded open-task count
if (/\b\d+\s+(открыт\w*\s+задач\w*|open\s+tasks?)\b/i.test(doc.replace(/<script[\s\S]*?<\/script>/, "")))
  errors.push("hard-coded open-task count remains in map prose");

// 5. every referenced task exists and is still open
const CLOSED = /\b(PROVEN|DONE|COMPLETED|CLOSED|CANCELLED|CANCELED|ГОТОВО|ЗАВЕРШЕНО|НЕ\s+НУЖЕН|ОТМЕНЕН|ОТМЕНЁН|verified|dropped)\b/i;
const sectionFor = (md, ref) => {
  const heading = /^Task\s/.test(ref)
    ? new RegExp(`^###\\s+Task\\s+${ref.replace(/^Task\s+/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[.\\s(—-]).*$`, "m")
    : new RegExp(`^##\\s+${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`, "m");
  const m = heading.exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = /^##/m.exec(rest);
  return m[0] + (next ? rest.slice(0, next.index) : rest);
};
const refs = new Set([...doc.matchAll(/([A-Za-z0-9_.-]+\.md)\s*·\s*(Task\s+\d+[A-Za-z]?|[A-Z][A-Z0-9]*-\d+)/g)].map((m) => `${m[1]}·${m[2]}`));
const tasksDir = arg("tasks-dir", "");
for (const key of [...refs].sort()) {
  const [file, ref] = key.split("·");
  const candidates = [tasksDir && path.resolve(ROOT, tasksDir, file), path.join(ROOT, "docs", "tasks", file), path.join(ROOT, "docs", file), path.join(ROOT, file)].filter(Boolean);
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) { errors.push(`referenced epic does not exist: ${file}`); continue; }
  const section = sectionFor(fs.readFileSync(found, "utf8"), ref);
  if (!section) { errors.push(`referenced task does not exist: ${file} ${ref}`); continue; }
  const head = section.split("\n", 1)[0];
  const statusLine = /(?:СТАТУС|STATUS)\s*[:—-]/i.test(section) ? section : head;
  if (CLOSED.test(head) || (/(?:СТАТУС|STATUS)\s*[:—-]\s*\S/i.test(statusLine) && CLOSED.test((statusLine.match(/(?:СТАТУС|STATUS)\s*[:—-]\s*([^\n]*)/i) || [])[1] || "")))
    errors.push(`closed task remains in map backlog: ${file} ${ref}`);
}
if (refs.size) notes.push(`task references checked: ${refs.size}`);

const CAP = 40;
for (const e of errors.slice(0, CAP)) console.log(`ERROR: ${e}`);
if (errors.length > CAP) console.log(`… and ${errors.length - CAP} more`);
for (const n of notes) console.log(`note: ${n}`);
console.log(errors.length ? `runtime map contract: ${errors.length} error(s)` : "runtime map contract: OK");
process.exit(errors.length ? 1 : 0);
