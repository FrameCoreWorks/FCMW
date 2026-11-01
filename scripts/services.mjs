#!/usr/bin/env node
// Which optional services (integrations/catalog.json) are connected on this machine?
//   node scripts/services.mjs          table for people
//   node scripts/services.mjs --json   machine-readable, for agents
//
// Read-only. It looks for MCP server entries in the agent config files listed in HOST_FILES
// and for the environment variable names a service needs. It never prints a value, a key or
// a config file's contents, only names and yes/no. It cannot see connectors that live in a
// web account (claude.ai, ChatGPT): an agent checks those in its own tool list.

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");

/** Config files that can hold MCP servers, per host. `{home}` and `{cwd}` are expanded. */
export const HOST_FILES = [
  { host: "Claude Code", path: "{home}/.claude.json" },
  { host: "Claude Code", path: "{cwd}/.mcp.json" },
  { host: "Claude Desktop", path: "{home}/Library/Application Support/Claude/claude_desktop_config.json" },
  { host: "Claude Desktop", path: "{appdata}/Claude/claude_desktop_config.json" },
  { host: "Claude Desktop", path: "{home}/.config/Claude/claude_desktop_config.json" },
  { host: "Codex", path: "{home}/.codex/config.toml" },
  { host: "Codex", path: "{cwd}/.codex/config.toml" },
  { host: "Cursor", path: "{home}/.cursor/mcp.json" },
  { host: "Cursor", path: "{cwd}/.cursor/mcp.json" },
  { host: "Gemini CLI", path: "{home}/.gemini/settings.json" },
  { host: "Gemini CLI", path: "{cwd}/.gemini/settings.json" },
  { host: "VS Code", path: "{cwd}/.vscode/mcp.json" },
];

/** Names of MCP servers defined in one config file, each with its definition as a lowercase string. */
export function serversIn(path, text) {
  const out = [];
  if (path.endsWith(".toml")) {
    // [mcp_servers.<name>] and its sub-tables; the body runs to the next table of another server.
    const re = /^\[mcp_servers\.("?)([^\]".]+)\1(?:\.[^\]]*)?\]\s*$/gm;
    const heads = [...text.matchAll(re)];
    heads.forEach((m, i) => {
      const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
      out.push({ name: m[2], body: text.slice(m.index, end).toLowerCase() });
    });
    return out;
  }
  let json;
  try { json = JSON.parse(text); } catch { return out; }
  // mcpServers can sit at the top level or, in ~/.claude.json, inside each project entry.
  // VS Code uses "servers".
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(node)) {
      if ((k === "mcpServers" || (k === "servers" && path.endsWith("mcp.json"))) && v && typeof v === "object") {
        for (const [name, def] of Object.entries(v)) out.push({ name, body: JSON.stringify(def).toLowerCase() });
      } else visit(v, depth + 1);
    }
  };
  visit(json, 0);
  return out;
}

/** Variable names defined in a dotenv file (values are ignored). */
export function dotenvNames(text) {
  return new Set(
    text.split(/\r?\n/).map((l) => l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\S/)?.[1]).filter(Boolean),
  );
}

/**
 * Pure detection: catalog + environment names + config files -> one row per service.
 * files: [{ host, path, text }], env: object of environment variables, dotenv: Set of names.
 */
export function detect(catalog, { files = [], env = {}, dotenv = new Set() } = {}) {
  const servers = files.flatMap((f) => serversIn(f.path, f.text).map((s) => ({ ...s, host: f.host })));
  return catalog.services.map((svc) => {
    const names = (svc.detect?.names || []).map((n) => n.toLowerCase());
    const match = (svc.detect?.match || []).map((m) => m.toLowerCase());
    const hits = servers.filter((s) => {
      const n = s.name.toLowerCase();
      return names.some((x) => n === x || n.startsWith(`${x}-`) || n.startsWith(`${x}_`)) || match.some((m) => s.body.includes(m));
    });
    const envNames = svc.env || [];
    return {
      id: svc.id,
      name: svc.name,
      tier: svc.tier,
      status: svc.status,
      kind: svc.kind,
      auth: svc.auth,
      configuredIn: [...new Set(hits.map((h) => h.host))],
      serverNames: [...new Set(hits.map((h) => h.name))],
      env: Object.fromEntries(envNames.map((k) => [k, env[k] ? "set" : dotenv.has(k) ? "in .env" : "missing"])),
    };
  });
}

function expand(p, cwd) {
  return p
    .replace("{home}", homedir())
    .replace("{cwd}", cwd)
    .replace("{appdata}", process.env.APPDATA || join(homedir(), "AppData", "Roaming"));
}

function main() {
  const catalog = JSON.parse(readFileSync(join(root, "integrations", "catalog.json"), "utf8"));
  const cwd = process.cwd();
  const files = [];
  for (const f of HOST_FILES) {
    const path = expand(f.path, cwd);
    if (!existsSync(path)) continue;
    try { files.push({ host: f.host, path, text: readFileSync(path, "utf8") }); } catch { /* unreadable: skip */ }
  }
  const dotenv = new Set();
  for (const name of [".env", ".env.local"]) {
    const p = join(cwd, name);
    if (existsSync(p)) for (const k of dotenvNames(readFileSync(p, "utf8"))) dotenv.add(k);
  }
  const rows = detect(catalog, { files, env: process.env, dotenv });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ checkedFiles: files.map((f) => f.path), services: rows }, null, 2));
    return;
  }
  console.log("Optional services. Nothing here is required; paid ones bill your own account.\n");
  for (const r of rows) {
    const where = r.configuredIn.length ? `configured in ${r.configuredIn.join(", ")}` : "not configured in a local agent";
    const env = Object.entries(r.env).map(([k, v]) => `${k}: ${v}`).join(", ");
    console.log(`- ${r.id} [${r.tier}${r.status === "deprecated" ? ", deprecated" : ""}] ${where}${env ? `; ${env}` : ""}`);
  }
  console.log(
    `\nChecked ${files.length} config file(s). Connectors added in a web account (claude.ai, ChatGPT) are not visible here;` +
      " the agent sees them in its own tool list. Setup: skills/connecting-services/SKILL.md",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
