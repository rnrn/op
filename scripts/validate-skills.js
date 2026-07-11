#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const skillsRoot = path.resolve(process.argv[2] || path.join(repoRoot, "skills"));

// Strict standard checks (docs/SKILL_STANDARD.md) apply to published skills
// only. In the dist tree build-dist.js is absent — there every skill present
// IS published, so fall back to "all".
let publishedSkills = null;
try {
  publishedSkills = new Set(require("./build-dist").publicSkills);
} catch {
  publishedSkills = null;
}

const allowedFields = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

const SAFETY_CLASSES = new Set(["read-only", "checkpoint", "generator"]);
const TRIGGER_PHRASING = /use (when|to|this|after|before)|run (this )?(before|after|when)|triggers? when/i;
const CYRILLIC = /[Ѐ-ӿ]/;

// Project debris that must never ship in a public skill.
const FORBIDDEN_STRINGS = [
  { re: /crateon-run/, label: "project leftover 'crateon-run'" },
  { re: /picoclaw/i, label: "project leftover 'picoclaw'" },
  { re: /bench-host|mockserver/, label: "project leftover test binaries" },
  { re: /Co-Authored-By: Claude/, label: "hardcoded model co-author trailer" },
  { re: /localhost:4099/, label: "hardcoded local endpoint" },
];

function fail(message) {
  return { level: "error", message };
}

function warn(message) {
  return { level: "warning", message };
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { error: "missing YAML frontmatter" };
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { error: "unterminated YAML frontmatter" };
  }

  const raw = match[1];
  const body = content.slice(match[0].length);
  const fields = {};
  const fieldNames = [];
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) continue;

    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      return { error: `invalid frontmatter line: ${line}` };
    }

    const key = m[1];
    let value = m[2] || "";
    fieldNames.push(key);

    if (value === "|" || value === ">") {
      const block = [];
      while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || !lines[i + 1].trim())) {
        i++;
        block.push(lines[i].replace(/^ {2}/, ""));
      }
      value = block.join(value === ">" ? " " : "\n").trim();
    } else {
      value = value.trim().replace(/^["']|["']$/g, "");
    }

    fields[key] = value;
  }

  return { fields, fieldNames, body };
}

// Skill names that exist in the tree being validated (source: 25; dist: the 19
// published — so a published skill referencing a repo-only skill fails validate:dist,
// which is correct: the published set must be self-contained).
let _knownSkills = null;
function getKnownSkills() {
  if (_knownSkills) return _knownSkills;
  _knownSkills = new Set(
    fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  );
  return _knownSkills;
}

function validateSkill(skillDir) {
  const issues = [];
  const name = path.basename(skillDir);
  const skillMd = path.join(skillDir, "SKILL.md");

  if (!fs.existsSync(skillMd)) {
    return [fail("missing SKILL.md")];
  }

  const content = fs.readFileSync(skillMd, "utf8");
  const parsed = parseFrontmatter(content);
  if (parsed.error) {
    return [fail(parsed.error)];
  }

  const fmName = parsed.fields.name || "";
  const description = parsed.fields.description || "";
  const body = parsed.body.trim();
  const bodyLines = body ? body.split(/\r?\n/).length : 0;

  if (!fmName) issues.push(fail("missing frontmatter field: name"));
  if (!description) issues.push(fail("missing frontmatter field: description"));
  if (fmName && fmName !== name) issues.push(fail(`name '${fmName}' does not match folder '${name}'`));
  if (fmName && !/^[a-z0-9-]+$/.test(fmName)) issues.push(fail("name must use lowercase letters, digits, and hyphens"));
  if (fmName.length > 64) issues.push(fail("name must be <= 64 characters"));
  if (description && description.length < 40) issues.push(fail("description is too short for reliable discovery"));
  if (!body) issues.push(fail("SKILL.md body is empty"));
  if (bodyLines > 500) issues.push(fail(`SKILL.md body is too large (${bodyLines} lines); move details to references/`));

  for (const key of parsed.fieldNames) {
    if (!allowedFields.has(key)) {
      issues.push(warn(`non-standard frontmatter field: ${key}`));
    }
  }

  // Dead cross-reference lint (EVAL-3): a token that LOOKS like a skill reference
  // (op-*/upstream-* naming pattern) must name a skill that exists in THIS tree —
  // SKILL_STANDARD: "Skill cross-references must use the exact published name".
  // A token that merely EXTENDS a known name (op-watch-verdict-smoke) is a derived
  // artifact (script/scenario), not a skill reference — skipped.
  const knownSkills = getKnownSkills();
  const refText = `${description}\n${body}`;
  const seenDead = new Set();
  for (const m of refText.matchAll(/\b((?:op|upstream)-[a-z][a-z0-9-]*)\b/g)) {
    const tok = m[1];
    if (knownSkills.has(tok) || seenDead.has(tok)) continue;
    if ([...knownSkills].some((k) => tok.startsWith(`${k}-`))) continue; // derived artifact name
    if (refText[m.index + tok.length] === "/") continue; // path segment (dir/), not a skill mention
    seenDead.add(tok);
    issues.push(fail(`dead cross-reference '${tok}' — no such skill in this tree (SKILL_STANDARD: exact published name)`));
  }

  const isPublished = publishedSkills === null || publishedSkills.has(name);
  if (isPublished) {
    issues.push(...validateStandard(skillDir, name, parsed, content, body, bodyLines, description));
  }

  return issues;
}

// Strict checks from docs/SKILL_STANDARD.md — published skills only.
function validateStandard(skillDir, name, parsed, content, body, bodyLines, description) {
  const issues = [];

  if (description.length > 1024) issues.push(fail("description must be <= 1024 characters"));
  if (description && !TRIGGER_PHRASING.test(description)) {
    issues.push(warn("description lacks trigger phrasing ('Use when ...')"));
  }
  if (bodyLines > 250) {
    issues.push(warn(`SKILL.md body is ${bodyLines} lines (target <=200); move reference material to references/`));
  }

  // SKILL_STANDARD "Content placement & budgets" — hard cap: angle brackets in the
  // description are allowed ONLY inside backtick code spans (a bare <placeholder>
  // breaks packaging in other skill ecosystems).
  const descNoCode = description.replace(/`[^`]*`/g, "");
  if (/[<>]/.test(descNoCode)) {
    const sample = (descNoCode.match(/<[^>\s]{0,24}>?|>/) || ["<>"])[0];
    issues.push(fail(`description has a bare angle bracket outside a code span (${sample}); backtick-wrap placeholders (SKILL_STANDARD: Content placement & budgets)`));
  }

  // Size-pressure tier (warnings): ~75-100-word target, warn above 120.
  const descWords = description.trim().split(/\s+/).filter(Boolean).length;
  if (descWords > 120) {
    issues.push(warn(`description is ${descWords} words (target ~75-100); trim to the trigger + purpose (SKILL_STANDARD: Content placement & budgets)`));
  }

  // >=3 enumerated trigger scenarios (clauses split on commas / "or" after the trigger keyword).
  const trigMatch = description.match(TRIGGER_PHRASING);
  if (trigMatch) {
    const tail = description.slice(trigMatch.index);
    const clauses = tail.split(/,|;| or /).map((s) => s.trim()).filter((s) => s.length > 2);
    if (clauses.length < 3) {
      issues.push(warn(`description enumerates ${clauses.length} trigger scenario(s) (SKILL_STANDARD asks >=3 distinct clauses)`));
    }
  }

  // Every reference link carries a read-trigger: a naked link (fewer than ~5 words of
  // surrounding prose on its line + the previous line) is a file the agent never opens.
  const rawLines = body.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    if (!/(references\/[A-Za-z0-9_.-]+\.md|\bprotocol\.md)/.test(rawLines[i])) continue;
    const ctx = `${rawLines[i - 1] || ""} ${rawLines[i]}`
      .replace(/`[^`]*`/g, " ")
      .replace(/(references\/[A-Za-z0-9_.-]+\.md|\bprotocol\.md)/g, " ")
      .replace(/[^A-Za-z']+/g, " ").trim();
    const proseWords = ctx ? ctx.split(/\s+/).length : 0;
    if (proseWords < 5) {
      issues.push(warn(`line ${i + 1}: reference link without a read-trigger (say WHEN/what-for to read it — SKILL_STANDARD: Content placement & budgets)`));
    }
  }

  // Skill payloads carry only what the agent needs: no human-facing meta docs inside
  // the skill folder (escape hatch: the file contains '<!-- skill-payload: required -->').
  const CLUTTER = /^(README\.md|INSTALL[^/]*\.md|CHANGELOG\.md|QUICK_REFERENCE\.md)$/i;
  for (const entry of fs.readdirSync(skillDir)) {
    if (!CLUTTER.test(entry)) continue;
    const text = fs.readFileSync(path.join(skillDir, entry), "utf8");
    if (text.includes("skill-payload: required")) continue;
    issues.push(fail(`${entry} inside the skill folder (human docs live at repo level; opt out with '<!-- skill-payload: required -->'; SKILL_STANDARD: Content placement & budgets)`));
  }

  const hasReadOnly = /^## Read-Only Contract/m.test(body);
  const hasSafety = /^## Safety Contract/m.test(body);
  if (!hasReadOnly && !hasSafety) {
    issues.push(fail("missing '## Read-Only Contract' or '## Safety Contract' section"));
  }

  // metadata is a nested YAML block; the simple parser skips indented lines,
  // so look the key up in the raw frontmatter region instead.
  const fmRegion = content.slice(0, content.indexOf("\n---", 3) + 4);
  const classMatch = fmRegion.match(/safety-class:\s*([a-z-]+)/);
  if (classMatch) {
    const cls = classMatch[1];
    if (!SAFETY_CLASSES.has(cls)) {
      issues.push(fail(`unknown safety-class '${cls}' (read-only | checkpoint | generator)`));
    } else if (cls === "read-only" && !hasReadOnly) {
      issues.push(fail("safety-class is read-only but body has no '## Read-Only Contract'"));
    } else if (cls !== "read-only" && !hasSafety) {
      issues.push(fail(`safety-class is ${cls} but body has no '## Safety Contract'`));
    }
  } else {
    issues.push(warn("metadata.safety-class not declared"));
  }

  const checkText = (relName, text) => {
    if (CYRILLIC.test(text)) issues.push(fail(`${relName}: contains Cyrillic text (published skills are English-only)`));
    for (const { re, label } of FORBIDDEN_STRINGS) {
      if (re.test(text)) issues.push(fail(`${relName}: ${label}`));
    }
  };
  checkText("SKILL.md", `${JSON.stringify(parsed.fields)}\n${body}`);

  const templatesDir = path.join(skillDir, "templates");
  if (fs.existsSync(templatesDir)) {
    for (const tpl of fs.readdirSync(templatesDir).filter((f) => f.endsWith(".md"))) {
      const text = fs.readFileSync(path.join(templatesDir, tpl), "utf8");
      checkText(`templates/${tpl}`, text);
      if (tpl === "default.md") {
        const m = text.split(/\r?\n/)[0].match(/Use the ([a-z0-9-]+) skill/);
        if (m && m[1] !== name) {
          issues.push(fail(`templates/default.md first line names '${m[1]}', expected '${name}'`));
        }
      }
    }
  }

  return issues;
}

function main() {
  if (!fs.existsSync(skillsRoot)) {
    console.error(`skills directory not found: ${skillsRoot}`);
    process.exit(2);
  }

  const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name))
    .sort();

  let errors = 0;
  let warnings = 0;

  for (const dir of skillDirs) {
    const rel = path.relative(repoRoot, dir).replace(/\\/g, "/");
    const issues = validateSkill(dir);
    if (issues.length === 0) {
      console.log(`ok ${rel}`);
      continue;
    }
    for (const issue of issues) {
      if (issue.level === "error") errors++;
      if (issue.level === "warning") warnings++;
      console.log(`${issue.level} ${rel}: ${issue.message}`);
    }
  }

  console.log(`skills checked: ${skillDirs.length}, errors: ${errors}, warnings: ${warnings}`);
  if (errors > 0) process.exit(1);
}

main();
