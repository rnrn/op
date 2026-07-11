#!/usr/bin/env node
// Mechanical form of op-feedback-harvest's apply-mode validation (rules-guide.md §Apply-mode
// validation) plus the two contract rules that burned real runs: pointer-form needs a REAL
// `doc#anchor` (W2-1), and audit checkpoints need the 5 sections in order (SKILL.md Output).
// Read-only; prints findings and exits 0 (clean) / 1 (errors) / 2 (usage). One-line errors,
// capped output — this runs inside an agent loop.
//
//   node validate-feedback.mjs --root <project-root> [--checkpoint <file>]
//
// Checks: index routes resolve · no orphan rule files · every rule file has a
// `Checklist (for preflight)` section · pointer-form `doc#anchor` targets exist ·
// checkpoint section shape · no obvious secrets (values never echoed).

import fs from "node:fs";
import path from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
if (process.argv.some((a) => a === "--help" || a === "-h")) {
  console.log("usage: validate-feedback.mjs --root <project-root> [--checkpoint <file>]"); process.exit(0);
}
const ROOT = path.resolve(arg("root", "."));
const FB = path.join(ROOT, "docs", "feedback");
if (!fs.existsSync(path.join(FB, "index.md"))) {
  console.error(`validate-feedback: no ${path.join("docs", "feedback", "index.md")} under ${ROOT} — nothing to validate (bootstrap the scaffold first)`);
  process.exit(2);
}

const issues = []; // {level: "ERROR"|"WARN", msg}
const err = (m) => issues.push({ level: "ERROR", msg: m });
const warn = (m) => issues.push({ level: "WARN", msg: m });
const read = (f) => fs.readFileSync(f, "utf8");
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");

// GitHub-style heading slug (approximation good enough for doc#anchor checks)
const slug = (h) => h.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
const anchorsOf = (text) => new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));

// 1. index routes resolve; collect routed files
const indexText = read(path.join(FB, "index.md"));
const routed = new Set();
for (const m of indexText.matchAll(/([A-Za-z0-9_./-]+\.md)/g)) {
  const name = m[1].replace(/^\.\//, "");
  if (name.includes("://")) continue;
  const p = path.join(FB, name);
  if (fs.existsSync(p)) { routed.add(path.normalize(p)); continue; }
  // routes may cite repo-relative docs (source-of-truth pointers) — accept those too
  if (fs.existsSync(path.join(ROOT, name))) continue;
  err(`index.md routes ${name} — file not found under docs/feedback/ or repo root`);
}

// 2. rule files: orphans + required Checklist section
const ruleFiles = fs.readdirSync(FB).filter((f) => f.endsWith(".md") && f !== "index.md")
  .map((f) => path.join(FB, f)).filter((f) => fs.statSync(f).isFile());
for (const f of ruleFiles) {
  if (!routed.has(path.normalize(f))) warn(`${rel(f)} is not routed by index.md (orphan rule file)`);
  if (!/^#{1,6}\s+Checklist \(for preflight\)\s*$/mi.test(read(f)))
    err(`${rel(f)} has no "Checklist (for preflight)" section — op-preflight cannot consume it`);
}

// 3. pointer-form rules: `doc#anchor` must exist (doc resolves, anchor is a heading or literal id)
for (const f of ruleFiles) {
  for (const m of read(f).matchAll(/`([A-Za-z0-9_./-]+\.md)#([A-Za-z0-9_-]+)`/g)) {
    const [, doc, anchor] = m;
    const candidates = [path.join(ROOT, doc), path.join(FB, doc), path.join(path.dirname(f), doc)];
    const target = candidates.find((c) => fs.existsSync(c));
    if (!target) { err(`${rel(f)} points to ${doc}#${anchor} — doc not found`); continue; }
    const text = read(target);
    if (!anchorsOf(text).has(anchor.toLowerCase()) && !text.includes(anchor))
      err(`${rel(f)} points to ${doc}#${anchor} — anchor not found in the doc (pointer-form requires a real anchor)`);
  }
}

// 4. checkpoint shape: the 5 sections, present and in order
const SECTIONS = ["## Selected Commits", "## Rejected Commits", "## Proposed Rules", "## Index Updates", "## Open Questions"];
const auditsDir = path.join(FB, "audits");
const checkpoints = arg("checkpoint", "")
  ? [path.resolve(arg("checkpoint", ""))]
  : (fs.existsSync(auditsDir) ? fs.readdirSync(auditsDir).filter((f) => f.endsWith(".md")).map((f) => path.join(auditsDir, f)) : []);
for (const c of checkpoints) {
  if (!fs.existsSync(c)) { err(`checkpoint ${rel(c)} not found`); continue; }
  const text = read(c);
  let last = -1;
  for (const s of SECTIONS) {
    const i = text.indexOf(s);
    if (i < 0) { err(`${rel(c)} is missing required section "${s}"`); last = Infinity; }
    else if (i < last) { err(`${rel(c)} has "${s}" out of order (required order: ${SECTIONS.join(" · ")})`); }
    else last = i;
  }
}

// 5. secrets scan — report the pattern kind and location, NEVER the value
const SECRETS = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/ghp_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/sk-[A-Za-z0-9]{24,}/, "API secret key"],
  [/BEGIN [A-Z ]*PRIVATE KEY/, "private key block"],
  [/(api[_-]?key|token|passphrase|password)\s*[:=]\s*["'][^"'\s]{8,}["']/i, "inline credential assignment"],
];
for (const f of [path.join(FB, "index.md"), ...ruleFiles, ...checkpoints.filter((c) => fs.existsSync(c))]) {
  const lines = read(f).split("\n");
  lines.forEach((line, i) => {
    for (const [re, kind] of SECRETS) if (re.test(line)) err(`${rel(f)}:${i + 1} looks like a ${kind} — feedback must never store secrets`);
  });
}

// report (capped)
const CAP = 50;
for (const it of issues.slice(0, CAP)) console.log(`${it.level}  ${it.msg}`);
if (issues.length > CAP) console.log(`… and ${issues.length - CAP} more`);
const errors = issues.filter((i) => i.level === "ERROR").length;
const warns = issues.length - errors;
console.log(`validate-feedback: ${ruleFiles.length} rule file(s), ${checkpoints.length} checkpoint(s) — ${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
