#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const requiredTemplateFiles = [
  "templates/AGENTS.md",
  "templates/docs/INDEX.md",
  "templates/docs/HANDBOOK.md",
  "templates/docs/task-intake.md",
  "templates/docs/docs-taxonomy.md",
  "templates/docs/subsystem-doc-contracts.md",
  "templates/docs/project-boundaries.md",
  "templates/docs/build-profiles.md",
  "templates/docs/feedback/index.md",
  "templates/docs/feedback/baseline.md",
  "templates/docs/feedback/process.md",
];

const requiredMentions = [
  {
    file: "templates/docs/feedback/process.md",
    patterns: requiredTemplateFiles.map((file) => file.replace(/^templates\//, "")),
  },
  {
    file: "skills/op-preflight/SKILL.md",
    patterns: [
      "docs/project-boundaries.md",
      "docs/build-profiles.md",
      "new or reorganized project",
    ],
  },
  {
    file: "skills/op-tour/SKILL.md",
    patterns: [
      "docs/project-boundaries.md",
      "docs/build-profiles.md",
      "project-method structure",
    ],
  },
  {
    file: "skills/project-doc-kit/SKILL.md",
    patterns: [
      "docs/project-boundaries.md",
      "docs/build-profiles.md",
      "bootstrap/readiness kit",
    ],
  },
  {
    file: "README.md",
    patterns: [
      "templates/AGENTS.md",
      "templates/docs/*",
      "templates/docs/project-boundaries.md",
      "templates/docs/build-profiles.md",
    ],
  },
];

let errors = 0;

function fail(message) {
  errors++;
  console.error(`error: ${message}`);
}

function readRelative(file) {
  const fullPath = path.join(repoRoot, file);
  if (!fs.existsSync(fullPath)) {
    fail(`missing file: ${file}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

for (const file of requiredTemplateFiles) {
  const content = readRelative(file);
  if (content && !content.trim()) fail(`empty file: ${file}`);
}

for (const check of requiredMentions) {
  const content = readRelative(check.file);
  if (!content) continue;
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      fail(`${check.file} missing mention: ${pattern}`);
    }
  }
}

const buildProfiles = readRelative("templates/docs/build-profiles.md");
if (buildProfiles && !/N\/A.+rationale/i.test(buildProfiles)) {
  fail("templates/docs/build-profiles.md must explain explicit N/A rationale");
}

if (errors > 0) {
  console.error(`project-method templates checked: errors=${errors}`);
  process.exit(1);
}

console.log(`project-method templates ok: ${requiredTemplateFiles.length} files`);
