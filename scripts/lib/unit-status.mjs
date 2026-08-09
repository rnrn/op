#!/usr/bin/env node
// Canonical task/unit status resolution — the ONE parser every consumer calls instead of
// hand-rolling its own (field lesson: an ad-hoc heading-only count overstated open work ~2x
// and stopped a correctly-working subagent; the corpus held status in two places at once).
//
//   node unit-status.mjs --root <repo> [--dir docs --dir docs/tasks] [--convention heading|body]
//     [--check] [--json]
//
// Unit shapes recognized (the bundle's declared layouts):
//   ### Task 12 — DONE            flat-epic heading status
//   ### Task 12. Title            flat-epic heading, status possibly in the body
//   ## UNIT-7 (verified) — title  docs/tasks unit heading status
// Body status line:  СТАТУС:/STATUS:/Статус: <token>
//
// Resolution order (canonical): heading token first; else the body status line; else the body
// closed-token scan — flagged AMBIGUOUS when the body carries 2+ closed tokens (a marker may
// belong to a sub-item, not the task). --check reports every unit whose status does NOT live
// where --convention says it must, and exits 1 when violations exist.

import fs from "node:fs";
import path from "node:path";

const CLOSED = /\b(PROVEN|DONE|COMPLETED|CLOSED|CANCELLED|CANCELED|ГОТОВО|ЗАВЕРШЕНО|НЕ\s+НУЖЕН|ОТМЕНЕН|ОТМЕНЁН|verified|dropped|wont_fix|done)\b/g;
const OPEN = /\b(PLANNED|IN_PROGRESS|WATCH|BLOCKED|TODO|OPEN|open|in_progress|deferred|blocked)\b/;
const BODY_LINE = /(?:^|[\s·|])(?:\*\*)?(?:СТАТУС|Статус|Status|STATUS)(?:\*\*)?\s*[:—-]\s*(\S+)/m;

export function resolveStatus(heading, body) {
  const headTail = heading.replace(/^#+\s*/, "");
  const isStatusTok = (t) => t && (new RegExp(`^(${CLOSED.source.slice(2, -2)})$`, "i").test(t.trim()) || OPEN.test(t.trim()));
  // paren style "## ID (verified — note)" then trailing-token style "### Task 3 — DONE"
  const paren = headTail.match(/\(\s*([A-Za-zА-Яа-яЁё_]+)/);
  if (paren && isStatusTok(paren[1])) return { status: paren[1].trim(), source: "heading", ambiguous: false };
  const trail = headTail.match(/(?:—|·|-)\s*([A-Za-zА-Яа-яЁё_]+)\s*(?:\(.*\))?\s*$/);
  if (trail && isStatusTok(trail[1])) return { status: trail[1].trim(), source: "heading", ambiguous: false };
  const line = body.match(BODY_LINE);
  if (line) {
    const closedInBody = (body.match(CLOSED) || []).length + (body.match(/✅/g) || []).length;
    const tok = line[1].trim().split(/\s/)[0].replace(/[.,;:!)»"']+$/, "");
    return { status: tok, source: "body", ambiguous: closedInBody >= 2 };
  }
  const closed = (body.match(CLOSED) || []).length + (body.match(/✅/g) || []).length;
  if (closed > 0) return { status: "closed?", source: "body-scan", ambiguous: closed >= 2 };
  return { status: "unknown", source: "none", ambiguous: false };
}

export function isClosed(status) {
  return new RegExp(`^(${CLOSED.source.slice(2, -2)})`, "i").test(status.trim());
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("unit-status.mjs")) {
  const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: unit-status.mjs --root <repo> [--dir <rel> ...] [--convention heading|body] [--check] [--json]");
    console.log("       [--tokens-closed a,b] [--tokens-open a,b]   extra DECLARED status vocabulary (project-specific)");
    process.exit(0);
  }
  const ROOT = path.resolve(arg("root", "."));
  const dirs = [];
  argv.forEach((a, i) => { if (a === "--dir") dirs.push(argv[i + 1]); });
  if (!dirs.length) dirs.push("docs", "docs/tasks");
  const convention = arg("convention", "heading");
  if (!["heading", "body"].includes(convention)) { console.error(`unit-status: unknown convention '${convention}'`); process.exit(2); }

  const files = [];
  for (const d of dirs) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) if (/^(EPIC_.*|.*)\.md$/i.test(f) && fs.statSync(path.join(abs, f)).isFile()) files.push(path.join(abs, f));
  }
  if (!files.length) { console.error(`unit-status: no .md files under ${dirs.join(", ")} in ${ROOT}`); process.exit(2); }

  const HEAD_RE = /^(### Task\s+\S+.*|## [A-Z][A-Z0-9]*-\d+.*)$/gm;
  const units = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    const heads = [...text.matchAll(HEAD_RE)];
    heads.forEach((m, i) => {
      const body = text.slice(m.index + m[0].length, heads[i + 1] ? heads[i + 1].index : text.length);
      const r = resolveStatus(m[0], body);
      units.push({ file: path.relative(ROOT, f).replace(/\\/g, "/"), heading: m[0].slice(0, 90), ...r, closed: r.status !== "unknown" && isClosed(r.status) });
    });
  }

  const bySource = {};
  for (const u of units) bySource[u.source] = (bySource[u.source] || 0) + 1;
  const ambiguous = units.filter((u) => u.ambiguous);
  const violations = units.filter((u) => u.source !== convention && u.source !== "none");
  const open = units.filter((u) => !u.closed && u.status !== "unknown").length;
  const closed = units.filter((u) => u.closed).length;

  // Vocabulary audit: every distinct status token, with UNDECLARED ones flagged. Three counts in a
  // row can each fail on a different unaccounted token (field case: ГОТОВО/ОТМЕНЁН/СНЯТО/ЧАСТИЧНО/
  // CONVERTED lived in the corpus, documented nowhere) — the histogram makes the vocabulary visible
  // so the project either declares a token (--tokens-*) or fixes the unit.
  const declared = new Set([...(arg("tokens-closed", "").split(",")), ...(arg("tokens-open", "").split(","))].map((t) => t.trim().toLowerCase()).filter(Boolean));
  const isKnown = (t) => {
    const x = t.trim();
    return x === "closed?" || x === "unknown" || declared.has(x.toLowerCase()) ||
      new RegExp(`^(${CLOSED.source.slice(2, -2)})$`, "i").test(x) || OPEN.test(x);
  };
  const vocab = {};
  for (const u of units) { if (u.status === "unknown") continue; const k = u.status; vocab[k] = vocab[k] || { n: 0, known: isKnown(k) }; vocab[k].n++; }
  const undeclared = Object.entries(vocab).filter(([, v]) => !v.known);

  if (argv.includes("--json")) { console.log(JSON.stringify({ units: units.length, open, closed, bySource, ambiguous: ambiguous.length, violations: violations.length, vocab, undeclared: undeclared.map(([k]) => k) }, null, 2)); }
  else {
    console.log(`units: ${units.length} across ${files.length} file(s) — open ${open} · closed ${closed} · unknown ${units.length - open - closed}`);
    console.log(`status source: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    console.log(`vocabulary: ${Object.entries(vocab).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([k, v]) => `${k} ${v.n}${v.known ? "" : " (UNDECLARED)"}`).join(" · ")}`);
    if (undeclared.length) console.log(`UNDECLARED tokens: ${undeclared.map(([k, v]) => `${k}(${v.n})`).join(", ")} — declare via --tokens-closed/--tokens-open or fix the units`);
    if (ambiguous.length) console.log(`AMBIGUOUS (2+ closed tokens in body): ${ambiguous.length}`);
    if (argv.includes("--check")) {
      const CAP = 25;
      for (const v of violations.slice(0, CAP)) console.log(`VIOLATION  ${v.file}: ${v.heading.trim()} — status in ${v.source}, convention says ${convention}`);
      if (violations.length > CAP) console.log(`… and ${violations.length - CAP} more`);
      console.log(violations.length
        ? `conformance: ${violations.length} unit(s) violate the '${convention}' convention`
        : `conformance: OK — every resolvable status lives in the ${convention}`);
    }
  }
  process.exit(argv.includes("--check") && violations.length ? 1 : 0);
}
