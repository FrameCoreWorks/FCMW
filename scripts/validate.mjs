#!/usr/bin/env node
// Repository checks, no dependencies, runs on macOS, Windows and Linux.
//   node scripts/validate.mjs
// 1. Every skills/<dir>/SKILL.md follows the Agent Skills spec (agentskills.io/specification).
// 2. All host manifests and package.json share one name and version, and point at ./skills/.
// 3. engines/catalog.json entries are complete and use a known tier and status.
// 4. No brand name appears in shipped files.
// 5. Copies in skills/*/references/ match their sources (scripts/sync-skill-refs.mjs).

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const readJSON = (rel) => {
  try {
    return JSON.parse(readFileSync(join(root, rel), "utf8"));
  } catch (e) {
    fail(rel, `invalid or missing JSON (${e.message})`);
    return null;
  }
};

// ---------- 1. skills ----------
// Minimal frontmatter reader: top-level "key: value" lines plus one level of indented
// "key: value" under a map key (metadata). Values may be quoted. Multi-line YAML values
// are not supported on purpose: keep frontmatter simple so every host parses it the same.
function frontmatter(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return fail(file, "missing YAML frontmatter between --- lines"), null;
  const data = {};
  let mapKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const nested = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    const unquote = (v) => v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (top) {
      const [, k, v] = top;
      if (v === "") { data[k] = {}; mapKey = k; }
      else if (/^[>|]/.test(v)) fail(file, `"${k}" uses a multi-line YAML value; write it on one line`);
      else { data[k] = unquote(v); mapKey = null; }
    } else if (nested && mapKey) {
      data[mapKey][nested[1]] = unquote(nested[2]);
    } else {
      fail(file, `unsupported frontmatter line: ${line.trim()}`);
    }
  }
  return data;
}

const ALLOWED_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const skillsDir = join(root, "skills");
const skillDirs = existsSync(skillsDir)
  ? readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory())
  : [];
if (skillDirs.length === 0) fail("skills/", "no skills found");

for (const dir of skillDirs) {
  const rel = `skills/${dir}/SKILL.md`;
  if (!existsSync(join(root, rel))) { fail(rel, "missing"); continue; }
  const text = readFileSync(join(root, rel), "utf8");
  const fm = frontmatter(text, rel);
  if (!fm) continue;
  for (const k of Object.keys(fm)) if (!ALLOWED_FIELDS.has(k)) fail(rel, `unknown frontmatter field "${k}"`);
  const { name, description, compatibility, metadata } = fm;
  if (typeof name !== "string" || !name) fail(rel, "name is required");
  else {
    if (name.length > 64) fail(rel, "name longer than 64 characters");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(rel, "name must be lowercase a-z, 0-9 and single hyphens, not at the ends");
    if (name !== dir) fail(rel, `name "${name}" must match directory "${dir}"`);
  }
  if (typeof description !== "string" || !description) fail(rel, "description is required");
  else if (description.length > 1024) fail(rel, `description is ${description.length} characters, max 1024`);
  if (compatibility !== undefined && (typeof compatibility !== "string" || compatibility.length < 1 || compatibility.length > 500))
    fail(rel, "compatibility must be 1-500 characters");
  if (metadata !== undefined && (typeof metadata !== "object")) fail(rel, "metadata must be a map of strings");
  const lines = text.split(/\r?\n/).length;
  if (lines > 500) fail(rel, `${lines} lines; keep SKILL.md under 500 and move detail to references/`);
}

// ---------- 2. manifests ----------
const pkg = readJSON("package.json");
const manifests = {
  ".claude-plugin/plugin.json": { skills: false },
  ".codex-plugin/plugin.json": { skills: true },
  ".cursor-plugin/plugin.json": { skills: true },
  "gemini-extension.json": { skills: false },
  "plugin.json": { skills: false },
};
for (const [rel, opts] of Object.entries(manifests)) {
  const m = readJSON(rel);
  if (!m || !pkg) continue;
  if (m.name !== pkg.name) fail(rel, `name "${m.name}" differs from package.json "${pkg.name}"`);
  if (m.version !== pkg.version) fail(rel, `version "${m.version}" differs from package.json "${pkg.version}"`);
  if (!m.description) fail(rel, "description is required");
  if (opts.skills && m.skills !== "./skills/") fail(rel, `skills must be "./skills/"`);
  if (m.license && m.license !== pkg.license) fail(rel, `license "${m.license}" differs from package.json "${pkg.license}"`);
}
const market = readJSON(".claude-plugin/marketplace.json");
if (market && pkg) {
  const entry = (market.plugins || []).find((p) => p.name === pkg.name);
  if (!entry) fail(".claude-plugin/marketplace.json", `no plugin entry named "${pkg.name}"`);
  else if (entry.source !== "./") fail(".claude-plugin/marketplace.json", `source must be "./"`);
}
const gem = readJSON("gemini-extension.json");
if (gem?.contextFileName && !existsSync(join(root, gem.contextFileName)))
  fail("gemini-extension.json", `contextFileName "${gem.contextFileName}" does not exist`);

// ---------- 3. engine catalog ----------
const TIERS = new Set(["free", "restricted", "paid"]);
const STATUSES = new Set(["planned", "experimental", "ready", "user-configured"]);
const REQUIRED = ["id", "name", "purpose", "tier", "license", "status", "checked"];
const catalog = readJSON("engines/catalog.json");
if (catalog) {
  const ids = new Set();
  for (const [i, e] of (catalog.engines || []).entries()) {
    const where = `engines/catalog.json engines[${i}]${e.id ? ` (${e.id})` : ""}`;
    for (const k of REQUIRED) if (!e[k]) fail(where, `missing "${k}"`);
    if (e.tier && !TIERS.has(e.tier)) fail(where, `tier "${e.tier}" must be one of ${[...TIERS].join(", ")}`);
    if (e.status && !STATUSES.has(e.status)) fail(where, `status "${e.status}" must be one of ${[...STATUSES].join(", ")}`);
    if (e.checked && !/^\d{4}-\d{2}-\d{2}$/.test(e.checked)) fail(where, `checked must be YYYY-MM-DD`);
    if (e.id && ids.has(e.id)) fail(where, "duplicate id");
    ids.add(e.id);
    if ((e.status === "ready" || e.status === "experimental") && !existsSync(join(root, "engines", e.id))) fail(where, `status is ${e.status} but engines/${e.id}/ does not exist`);
    if (e.status === "user-configured" && e.tier !== "paid") fail(where, "user-configured entries are paid APIs or MCP servers: tier must be paid");
  }
}

// ---------- 4. no brand in shipped files ----------
// The repository URL is allowed (it is where the code lives); anything else is not.
const BRANDS = [/frame\s*core/i];
const ALLOWED_URL = /(github\.com\/)?FrameCoreWorks\/FCWM/gi;
const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "out"]);
const TEXT_EXT = /\.(md|mdx|json|js|mjs|cjs|ts|py|html|css|svg|txt|ya?ml|toml|sh)$/i;
const SELF = relative(root, fileURLToPath(import.meta.url));
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(full); continue; }
    const rel = relative(root, full).split(sep).join("/");
    if (rel === SELF.split(sep).join("/")) continue;
    if (!TEXT_EXT.test(name) && !["LICENSE", "NOTICE"].includes(name)) continue;
    const text = readFileSync(full, "utf8").replace(ALLOWED_URL, "");
    for (const re of BRANDS) if (re.test(text)) fail(rel, `brand name matched ${re}; FCWM ships without a brand`);
  }
}
walk(root);

// ---------- report ----------
// ---------- 5. skill reference copies ----------
const { drift } = await import("./sync-skill-refs.mjs");
for (const rel of drift()) fail(rel, "out of date with its source: run node scripts/sync-skill-refs.mjs");

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`validate: ok (${skillDirs.length} skill(s), ${Object.keys(manifests).length + 1} manifests, ${catalog?.engines?.length ?? 0} engines)`);
