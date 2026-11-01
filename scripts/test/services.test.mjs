import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { detect, serversIn, dotenvNames } from "../services.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");
const catalog = JSON.parse(readFileSync(join(root, "integrations", "catalog.json"), "utf8"));
const row = (rows, id) => rows.find((r) => r.id === id);

test("finds servers in Claude Code project entries and top level", () => {
  const text = JSON.stringify({
    mcpServers: { fal: { type: "http", url: "https://mcp.fal.ai/mcp-relay" } },
    projects: { "/x": { mcpServers: { voice: { command: "uvx", args: ["elevenlabs-mcp"] } } } },
  });
  assert.deepEqual(serversIn("/h/.claude.json", text).map((s) => s.name).sort(), ["fal", "voice"]);
});

test("finds servers in Codex TOML, including sub-tables", () => {
  const text = '[mcp_servers.runway]\nurl = "https://mcp.runwayml.com/mcp"\n\n[mcp_servers.mm]\ncommand = "uvx"\nargs = ["minimax-mcp"]\n[mcp_servers.mm.env]\nMINIMAX_API_HOST = "https://api.minimax.io"\n';
  const s = serversIn("/h/.codex/config.toml", text);
  assert.deepEqual(s.map((x) => x.name), ["runway", "mm", "mm"]);
  assert.ok(s[1].body.includes("minimax-mcp"));
});

test("matches by server name or by endpoint, never reports values", () => {
  const files = [
    { host: "Cursor", path: "/h/.cursor/mcp.json", text: JSON.stringify({ mcpServers: { "my-tts": { url: "https://api.elevenlabs.io/v1/mcp" } } }) },
    { host: "Codex", path: "/h/.codex/config.toml", text: '[mcp_servers.replicate]\nurl = "https://mcp.replicate.com/sse"\n' },
  ];
  const rows = detect(catalog, { files, env: { MINIMAX_API_KEY: "secret-value" }, dotenv: new Set(["REPLICATE_API_TOKEN"]) });
  assert.deepEqual(row(rows, "elevenlabs").configuredIn, ["Cursor"]);
  assert.deepEqual(row(rows, "replicate").configuredIn, ["Codex"]);
  assert.equal(row(rows, "replicate").env.REPLICATE_API_TOKEN, "in .env");
  assert.equal(row(rows, "minimax").env.MINIMAX_API_KEY, "set");
  assert.equal(row(rows, "minimax").env.MINIMAX_API_HOST, "missing");
  assert.deepEqual(row(rows, "fal").configuredIn, []);
  assert.ok(!JSON.stringify(rows).includes("secret-value"));
});

test("dotenv reader returns names only and skips empty values", () => {
  assert.deepEqual([...dotenvNames("A=1\nexport B = two\n# C=3\nD=\n")], ["A", "B"]);
});

test("broken JSON config is ignored, not fatal", () => {
  assert.deepEqual(serversIn("/h/.cursor/mcp.json", "{ nope"), []);
});
