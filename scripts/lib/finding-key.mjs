// Reference implementation of the shared finding-identity ("natural key").
// Deterministic, dependency-free, model-reproducible (pure string assembly).
//
// A natural key is the content-derived identity two different skills compute
// independently for the SAME logical defect. It deliberately EXCLUDES line
// numbers and the discovering skill (so debt-scan and op-audit converge) and
// includes only the rename/line-drift-stable spine: domain + locus [+ predicate].
//
// keyCore  = "<domain> | <sorted line-stripped repo-relative paths>"
// keyFull  = keyCore + " | <predicate-slug>"   (disambiguates two defects on one locus)
//
// Stability claim under test (see id-stability-replay.mjs):
//   line-drift  -> keyCore invariant (line numbers stripped)
//   content churn -> keyCore invariant (not hashing file contents)
//   file rename -> keyCore CHANGES unless paths are normalized to a canonical
//                  (HEAD) path via `git log --follow` — this is exactly why a
//                  ledger still needs a rename-alias / re-injection step.

import { execFileSync } from "node:child_process";

const DOMAIN_ALIASES = {
  "appsec-secrets": "security", "appsec-surface": "security", appsec: "security",
  sec: "security", crypto: "security",
  supplychain: "supply-chain", "supply_chain": "supply-chain",
  cicd: "ci", "ci-cd": "ci",
  "perf-sre": "perf", perfsre: "perf", sre: "perf",
  arch: "architecture", quality: "quality", testing: "testing",
  "missing-test": "testing", complexity: "complexity", "dep-health": "dep-health",
  drift: "drift", docs: "docs",
};

export function normDomain(d) {
  const s = String(d || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return DOMAIN_ALIASES[s] || s || "unknown";
}

// Strip line/column suffix and parentheticals; normalize separators; repo-relative.
export function normPath(p) {
  let s = String(p || "").trim().replace(/\\/g, "/");
  s = s.replace(/\([^)]*\)/g, "");              // drop "(DeriveKey untested)" notes
  s = s.replace(/:[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*\s*$/g, ""); // drop :57-92 , :344-347
  s = s.replace(/^\.\//, "").replace(/^\/+/, "").trim();
  return s;
}

// A `location` string may carry several loci separated by ; or , — return the
// sorted, de-duped set of line-stripped paths (the rename/line-stable spine).
export function parseLocation(location) {
  const raw = String(location || "");
  const parts = raw.split(/[;]+/).flatMap((seg) => seg.split(/\s+vs\s+/));
  const paths = [];
  for (const seg of parts) {
    const m = seg.match(/[\w./-]+\.[A-Za-z0-9]+/g); // file-looking tokens
    if (m) for (const t of m) { const np = normPath(t); if (np && /\.[A-Za-z0-9]+$/.test(np)) paths.push(np); }
  }
  return [...new Set(paths)].sort();
}

// The third identity component must be a CONTROLLED token, not free prose:
// the fixture proves skills word the same defect differently ("zero test
// coverage" vs "no test file"), so a prose slug never converges cross-skill.
// defectClass maps either skill's wording to one enum via keyword match.
const DEFECT_CLASSES = [
  ["untested", /\b(no test|untested|test coverage|missing test|zero .*test)\b/],
  ["size-budget", /\b(budget|god component|too large|exceeds|over .*line|oversized|size)\b/],
  ["secret-exposure", /\b(secret|credential|api key|printed|leak|plaintext .*key)\b/],
  ["seal-mismatch", /\b(seal|unseal|aad|v3|mismatch|round ?trip)\b/],
  ["duplication", /\b(duplicat|copy|dup)\b/],
  ["singleton", /\b(singleton|global state|global mutable)\b/],
  ["hardcoded", /\b(hardcod|magic (number|string)|inline literal)\b/],
  ["dead-surface", /\b(unused|dead|exported .*never|mounted nowhere)\b/],
];
export function defectClass(text, fallbackMax = 3) {
  const s = String(text || "").toLowerCase();
  for (const [cls, re] of DEFECT_CLASSES) if (re.test(s)) return cls;
  return predicateSlug(text, fallbackMax) || "unclassified";
}

export function predicateSlug(text, max = 6) {
  return String(text || "").toLowerCase()
    .replace(/[`"'().,:;]/g, " ")
    .split(/\s+/).filter(Boolean)
    .filter((w) => !["the","a","an","of","to","in","is","are","and","has","with","only","real","path"].includes(w))
    .slice(0, max).join("-").replace(/[^a-z0-9-]/g, "");
}

export function naturalKey({ domain, paths = [], location, predicate, symbol }) {
  const ps = paths.length ? paths.map(normPath).filter(Boolean).sort() : parseLocation(location);
  const core = `${normDomain(domain)} | ${ps.join(" + ") || "—"}`;
  // anchor = explicit code symbol if a skill emits one (most stable), else a
  // controlled defect-class derived from prose. Never the raw prose itself.
  const anchor = symbol ? String(symbol).trim() : (predicate ? defectClass(predicate) : "");
  const full = anchor ? `${core} | ${anchor}` : core;
  return { keyCore: core, keyFull: full, anchor, paths: ps };
}

// Optional opaque surrogate, computed by a tool (not model arithmetic).
export function surrogate(key, prefix = "FND") {
  try {
    const h = execFileSync("git", ["hash-object", "--stdin"], { input: key, encoding: "utf8" }).trim();
    return `${prefix}-${h.slice(0, 7)}`;
  } catch { return `${prefix}-nohash`; }
}
