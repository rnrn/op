#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const skipDirs = new Set([".git", "node_modules", "dist", "coverage", ".tmp", "tmp", ".work", "results"]);
const textExtensions = new Set([
  ".md",
  ".json",
  ".js",
  ".yml",
  ".yaml",
  ".txt",
  ".toml",
  ".ini",
  ".env",
  ".ps1",
  ".sh",
  ".cmd",
  ".bat",
]);

const secretPatterns = [
  ["OpenAI/OpenRouter-style key", /sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}/g],
  ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ["AWS access key", /AKIA[0-9A-Z]{16}/g],
  ["private key header", /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/g],
  [
    "generic secret assignment",
    /(api[_-]?key|token|secret|password|passphrase)\s*[:=]\s*['"]?([A-Za-z0-9_\-./+=]{16,})/gi,
  ],
];

const localPathPatterns = [
  /D:[\\/]+project[\\/]+/i,
  /C:[\\/]+Users[\\/]+/i,
  /\bradik\b/i,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(file, out);
      continue;
    }
    out.push({ file, rel, ext: path.extname(entry.name).toLowerCase() });
  }
  return out;
}

function isTextFile(item) {
  return textExtensions.has(item.ext) || path.basename(item.rel) === "LICENSE";
}

function isAllowedExample(line) {
  return /example|placeholder|fixture|YOUR_|<[^>]+>|path\/to|no-auth|password-stdin|redacted|api-key|vault key|token name/i.test(
    line,
  );
}

const findings = [];

for (const item of walk(repoRoot)) {
  if (!isTextFile(item)) continue;
  let text;
  try {
    text = fs.readFileSync(item.file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (const [name, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const lineNumber = text.slice(0, match.index).split(/\r?\n/).length;
      if (isAllowedExample(lines[lineNumber - 1] || "")) continue;
      findings.push(`${item.rel}:${lineNumber}: possible ${name}`);
    }
  }
  for (const pattern of localPathPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const lineNumber = text.slice(0, match.index).split(/\r?\n/).length;
    findings.push(`${item.rel}:${lineNumber}: local machine path/reference`);
  }
}

if (findings.length) {
  console.error("secret scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("secret scan ok");
