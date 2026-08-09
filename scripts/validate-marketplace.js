#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const pluginDir = path.join(repoRoot, ".claude-plugin");
const marketplacePath = path.join(pluginDir, "marketplace.json");
const pluginPath = path.join(pluginDir, "plugin.json");
const codexPluginPath = path.join(repoRoot, ".codex-plugin", "plugin.json");

function fail(message) {
  console.error(`error: ${message}`);
  process.exitCode = 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${path.relative(repoRoot, file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function readSkillName(skillDir) {
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) return null;
  const text = fs.readFileSync(skillFile, "utf8");
  const match = text.match(/^name:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

function validatePublicPlugin(plugin, label) {
  if (!plugin) return;
  for (const field of ["name", "version", "description", "repository", "homepage", "license"]) {
    if (!plugin[field]) fail(`${label} missing ${field}`);
  }
  if (plugin.license === "Internal") fail(`${label} must not use Internal license for publication`);
  if (!plugin.author || !plugin.author.name) fail(`${label} missing author.name`);
  if (!plugin.skills) fail(`${label} missing skills path`);
}

if (!fs.existsSync(marketplacePath)) fail(".claude-plugin/marketplace.json is missing");
if (!fs.existsSync(pluginPath)) fail(".claude-plugin/plugin.json is missing");
if (!fs.existsSync(codexPluginPath)) fail(".codex-plugin/plugin.json is missing");

const marketplace = fs.existsSync(marketplacePath) ? readJson(marketplacePath) : null;
const plugin = fs.existsSync(pluginPath) ? readJson(pluginPath) : null;
const codexPlugin = fs.existsSync(codexPluginPath) ? readJson(codexPluginPath) : null;

validatePublicPlugin(plugin, ".claude-plugin/plugin.json");
validatePublicPlugin(codexPlugin, ".codex-plugin/plugin.json");

if (marketplace) {
  if (!marketplace.name) fail("marketplace.json missing name");
  if (!marketplace.owner || !marketplace.owner.name) fail("marketplace.json missing owner.name");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail("marketplace.json plugins must be a non-empty array");
  } else {
    for (const entry of marketplace.plugins) {
      for (const field of ["name", "source", "description", "version"]) {
        if (!entry[field]) fail(`marketplace plugin '${entry.name || "unknown"}' missing ${field}`);
      }
      if (!entry.repository) fail(`marketplace plugin '${entry.name}' missing repository`);
      if (!entry.license) fail(`marketplace plugin '${entry.name}' missing license`);
      if (entry.license === "Internal") fail(`marketplace plugin '${entry.name}' must not use Internal license`);
      if (!Array.isArray(entry.skills) || entry.skills.length === 0) {
        fail(`marketplace plugin '${entry.name}' has no skills`);
        continue;
      }
      for (const skillRel of entry.skills) {
        const skillDir = path.resolve(repoRoot, skillRel);
        if (!skillDir.startsWith(repoRoot + path.sep)) {
          fail(`skill path escapes repo: ${skillRel}`);
          continue;
        }
        if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
          fail(`skill path missing: ${skillRel}`);
          continue;
        }
        const folderName = path.basename(skillDir);
        const skillName = readSkillName(skillDir);
        if (!skillName) {
          fail(`skill ${skillRel} missing SKILL.md name`);
        } else if (skillName !== folderName) {
          fail(`skill ${skillRel} name '${skillName}' does not match folder '${folderName}'`);
        }
      }
    }
  }
}

if (!process.exitCode) {
  console.log(`marketplace ok: ${marketplace.plugins.length} plugin groups`);
}
