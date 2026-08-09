#!/usr/bin/env node
// Stack-deviation guard (GP1 declared-wins). Given the project's DECLARED language(s)
// (AGENTS.md Stack Profile) and the files a story/change will create, flag any whose
// language is NOT declared. A spec's *illustrative* code (e.g. a Python reference adapter
// in a Go repo) is not a mandate to add a language: a non-declared language must be a
// recorded Decision + isolated, never silently chosen. Config/docs/shell/data are
// stack-neutral tooling and never flagged.
//
//   node stack-check.mjs --declared "go,typescript" --files "a.py,b.go,docs/x.md"
//   node stack-check.mjs --declared go --files-from changed.txt
// Exit 0 = no deviation · 2 = deviation(s) (lists offending files + their language).

import fs from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

const EXT_LANG = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", go: "go", rs: "rust",
  java: "java", kt: "kotlin", rb: "ruby", php: "php", cs: "csharp", swift: "swift",
  scala: "scala", cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", h: "c", hpp: "cpp",
  m: "objc", mm: "objc", ex: "elixir", exs: "elixir", erl: "erlang", clj: "clojure",
  dart: "dart", lua: "lua", r: "r", jl: "julia", hs: "haskell", ml: "ocaml", zig: "zig",
};
// stack-neutral: config, docs, data, shell tooling — never a language deviation
const NEUTRAL = new Set(["md", "markdown", "json", "yaml", "yml", "toml", "txt", "sh", "bash", "zsh", "fish", "env", "cfg", "conf", "ini", "sql", "xml", "html", "css", "scss", "lock", "csv", "tsv", "proto", "graphql", "dockerfile", "mk", "make", "gradle", "properties"]);

const LANG_ALIAS = {
  golang: "go", node: "javascript", nodejs: "javascript", js: "javascript", javascript: "javascript",
  ts: "typescript", typescript: "typescript", py: "python", python: "python", "c++": "cpp",
  "c#": "csharp", "objective-c": "objc",
};
const normLang = (s) => { const k = String(s).replace(/[`'"*]/g, "").trim().toLowerCase(); return LANG_ALIAS[k] || k; };

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`stack-check.mjs — flag files whose language is not in the declared stack (GP1 declared-wins).
Usage: node <this>/scripts/lib/stack-check.mjs --declared "<langs>" --files "<a.py,b.go,...>"
       node <this>/scripts/lib/stack-check.mjs --declared go --files-from changed.txt
This script lives in the GLOBAL skills tree (~/.claude/scripts/lib/), NOT vendored per-project;
from a skill, resolve it as path.resolve(<skillDir>/../../../scripts/lib/stack-check.mjs).
Exit 0 = no deviation (or nothing to check) · 2 = deviation(s) listed.`);
  process.exit(0);
}

const declared = new Set((arg("declared", "") || "").split(/[,\s]+/).filter(Boolean).map(normLang));
let files = (arg("files", "") || "").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
const ff = arg("files-from", "");
if (ff) { try { files = files.concat(fs.readFileSync(ff, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)); } catch {} }
if (!declared.size) { console.log("stack-check: no declared language(s) — skipped (declare AGENTS.md Stack Profile to enable)"); process.exit(0); }
if (!files.length) { console.log("stack-check: no files given — nothing to check"); process.exit(0); }

const deviations = [];
for (const f of files) {
  const base = f.replace(/\\/g, "/").split("/").pop().toLowerCase();
  if (base === "dockerfile" || base === "makefile") continue;
  const ext = base.includes(".") ? base.split(".").pop() : "";
  if (!ext || NEUTRAL.has(ext)) continue;
  const lang = EXT_LANG[ext];
  if (lang && !declared.has(lang)) deviations.push({ f, lang });
}

if (deviations.length) {
  console.log(`STACK-DEVIATION: ${deviations.length} file(s) in a non-declared language (declared: ${[...declared].join(", ")}):`);
  for (const d of deviations.slice(0, 20)) console.log(`  ${d.f}  → ${d.lang}`);
  console.log("Each requires a recorded Decision (why this language) + isolation in a separate dir (GP1 declared-wins).");
  process.exit(2);
}
console.log(`stack-check: OK — all ${files.length} file(s) within declared stack (${[...declared].join(", ")}) or stack-neutral`);
process.exit(0);
