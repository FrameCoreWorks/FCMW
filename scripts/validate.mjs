#!/usr/bin/env node
// Repository checks, no dependencies, runs on macOS, Windows and Linux.
//   node scripts/validate.mjs
// 1. Every skills/<dir>/SKILL.md follows the Agent Skills spec (agentskills.io/specification).
// 2. All host manifests and package.json share one name and version, and point at ./skills/.
// 3. engines/catalog.json entries are complete and use a known tier and status.
// 4. integrations/catalog.json entries (optional services) are complete and never carry a key.
// 5. No brand name and nothing that looks like an API key appears in shipped files.
// 6. Copies in skills/*/references/ match their sources (scripts/sync-skill-refs.mjs).
// 7. No renders from pull requests opened from forks.
// 8. plugin-files.json (file list with SHA-256 for file-by-file installs) is up to date.

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
const STATUSES = new Set(["planned", "experimental", "ready"]);
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
    // A "route" entry is a capability served by another engine (e.g. Lottie playback through HyperFrames).
    const home = e.route || e.id;
    if ((e.status === "ready" || e.status === "experimental") && !existsSync(join(root, "engines", home))) fail(where, `status is ${e.status} but engines/${home}/ does not exist`);
    for (const [j, m] of (e.modes || []).entries()) {
      const at = `${where} modes[${j}]${m.id ? ` (${m.id})` : ""}`;
      for (const k of ["id", "name", "purpose", "library", "tier", "license", "upstream", "cost", "status", "checked"]) if (m[k] === undefined || m[k] === "") fail(at, `missing "${k}"`);
      if (m.tier && !TIERS.has(m.tier)) fail(at, `tier "${m.tier}" must be one of ${[...TIERS].join(", ")}`);
      if (m.status && !STATUSES.has(m.status)) fail(at, `status "${m.status}" must be one of ${[...STATUSES].join(", ")}`);
    }
  }
}

// ---------- 4. optional services ----------
// Services are never bundled: an entry documents how a user connects their own account.
const SVC_REQUIRED = ["id", "name", "purpose", "capabilities", "kind", "auth", "tier", "license", "upstream", "status", "checked"];
const SVC_KINDS = new Set(["mcp-remote", "mcp-local", "api"]);
const SVC_AUTH = new Set(["oauth", "api-key", "cloud-credentials"]);
const SVC_STATUSES = new Set(["listed", "tested", "deprecated"]);
const services = readJSON("integrations/catalog.json");
if (services) {
  const caps = new Set(services.capabilities || []);
  const ids = new Set();
  for (const [i, s] of (services.services || []).entries()) {
    const where = `integrations/catalog.json services[${i}]${s.id ? ` (${s.id})` : ""}`;
    for (const k of SVC_REQUIRED) if (!s[k]) fail(where, `missing "${k}"`);
    if (s.tier && !TIERS.has(s.tier)) fail(where, `tier "${s.tier}" must be one of ${[...TIERS].join(", ")}`);
    if (s.kind && !SVC_KINDS.has(s.kind)) fail(where, `kind "${s.kind}" must be one of ${[...SVC_KINDS].join(", ")}`);
    if (s.auth && !SVC_AUTH.has(s.auth)) fail(where, `auth "${s.auth}" must be one of ${[...SVC_AUTH].join(", ")}`);
    if (s.status && !SVC_STATUSES.has(s.status)) fail(where, `status "${s.status}" must be one of ${[...SVC_STATUSES].join(", ")}`);
    if (s.checked && !/^\d{4}-\d{2}-\d{2}$/.test(s.checked)) fail(where, "checked must be YYYY-MM-DD");
    for (const c of s.capabilities || []) if (!caps.has(c)) fail(where, `unknown capability "${c}"`);
    if (s.kind === "mcp-remote" && !/^https:\/\//.test(s.endpoint || "")) fail(where, "mcp-remote needs an https endpoint");
    if (s.kind === "mcp-local" && !s.command && !s.notes) fail(where, "mcp-local needs a command or notes on how to install it");
    if (s.auth === "api-key" && !(s.env || []).length) fail(where, "api-key auth needs the env variable names it reads");
    for (const k of s.env || []) if (!/^[A-Z][A-Z0-9_]*$/.test(k)) fail(where, `env "${k}" must be an UPPER_SNAKE variable name, never a value`);
    if (!s.detect?.names?.length && !s.detect?.match?.length) fail(where, "detect needs names or match strings");
    if (s.id && ids.has(s.id)) fail(where, "duplicate id");
    ids.add(s.id);
  }
}

// ---------- 5. no brand and no secrets in shipped files ----------
// The repository URL is allowed (it is where the code lives); anything else is not.
const BRANDS = [/frame\s*core/i];
// Common key shapes (OpenAI/Anthropic sk-, ElevenLabs sk_, Replicate r8_, Google AIza, GitHub, fal key:secret).
const SECRETS = [
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}/,
  /\bsk_[a-f0-9]{32,}/,
  /\br8_[A-Za-z0-9]{30,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}\b/,
];
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
    for (const re of SECRETS) if (re.test(text)) fail(rel, `looks like an API key (${re}); use a placeholder such as <your-api-key>`);
  }
}
walk(root);

// ---------- 7. no renders from outside pull requests ----------
// Workflows that render (browser, ffmpeg, fcwm.mjs render, smoke, installer) must skip every job on
// pull requests from forks, and no workflow may use pull_request_target (it runs with this repo's
// token). The real lock is the repository setting that holds fork runs for approval; this keeps the
// YAML from drifting. See docs/render-in-github-actions.md.
const FORK_GUARD = "github.event.pull_request.head.repo.full_name == github.repository";
const RENDERS = /playwright install|ffmpeg|fcwm\.mjs\s+render|smoke\.mjs|install\.(sh|ps1)/;
const wfDir = join(root, ".github", "workflows");
if (existsSync(wfDir)) {
  for (const f of readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n))) {
    const rel = `.github/workflows/${f}`;
    const text = readFileSync(join(wfDir, f), "utf8");
    if (/pull_request_target/.test(text)) fail(rel, "pull_request_target is not allowed (it runs fork code with this repository's token)");
    if (!RENDERS.test(text) || !/^\s*pull_request\s*:/m.test(text)) continue;
    const jobs = text.split(/^jobs:\s*$/m)[1] ?? "";
    for (const m of jobs.matchAll(/^  ([A-Za-z][\w-]*):\s*$([\s\S]*?)(?=^  [A-Za-z][\w-]*:\s*$|(?![\s\S]))/gm)) {
      if (!m[2].includes(FORK_GUARD)) fail(rel, `job "${m[1]}" renders on pull_request but has no fork guard (if: ... ${FORK_GUARD})`);
    }
  }
}

// ---------- report ----------
// ---------- 6. skill reference copies ----------
const { drift } = await import("./sync-skill-refs.mjs");
for (const rel of drift()) fail(rel, "out of date with its source: run node scripts/sync-skill-refs.mjs");

// ---------- 8. plugin file inventory ----------
const inventory = await import("./inventory.mjs");
if (inventory.stale()) fail(inventory.OUT, "out of date: run node scripts/inventory.mjs");

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`validate: ok (${skillDirs.length} skill(s), ${Object.keys(manifests).length + 1} manifests, ${catalog?.engines?.length ?? 0} engines, ${services?.services?.length ?? 0} optional services)`);
