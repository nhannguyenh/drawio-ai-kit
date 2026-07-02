// installer.mjs — pure tested writers/resolvers/detector for the multi-agent installer
import os from "node:os";
import path from "node:path";

export const MCP_NAME = "drawio-ai-kit";
// The root SKILL.md stages the WHOLE repo, so the engine (src/catalog/…) lives here. This is the
// shared engine + the MCP host. Covers AWS + Azure + GCP (+ OSS packs) — hence "cloud", not "aws".
export const CANONICAL_DIR = path.join(os.homedir(), ".agents", "skills", "drawio-cloud-architect");
export const SKILL_NAME = path.basename(CANONICAL_DIR);
// Legacy name (pre multi-cloud). The installer removes this stale skill on upgrade so it doesn't
// orphan next to the renamed one. Must match the old SKILL.md frontmatter `name`.
export const OLD_SKILL_NAME = "drawio-aws-architect";
export const OLD_CANONICAL_DIR = path.join(os.homedir(), ".agents", "skills", OLD_SKILL_NAME);
// The BPMN skill lives in skills/drawio-bpmn/ (SKILL.md only — the skills CLI stages just the skill
// dir, so a subdir skill would orphan the repo-root engine). The installer attaches the shared
// engine into it via sibling symlinks (ENGINE_LINKS) so ~/.agents/skills/drawio-bpmn/src resolves.
export const BPMN_DIR = path.join(os.homedir(), ".agents", "skills", "drawio-bpmn");
export const SKILLS = [SKILL_NAME, "drawio-bpmn"];                 // every skill this repo ships
export const ENGINE_LINKS = ["src", "catalog", "rules", "vendor", "examples", "package.json"];
export const MCP_SERVER_MJS = "src/mcp-server.mjs";

export function mcpPayload(nodeBin, canonicalDir) {
  return { command: nodeBin, args: [path.join(canonicalDir, MCP_SERVER_MJS)] };
}

export function claudeCodeAddCommand(name, nodeBin, canonicalDir) {
  return {
    cmd: "claude",
    args: ["mcp", "add", name, "--scope", "user", "--", nodeBin, path.join(canonicalDir, MCP_SERVER_MJS)],
  };
}

export function resolveSource(isClone) {
  return isClone ? "." : "sparklabx/drawio-ai-kit";
}

const DEFAULT_HOME = os.homedir();

export function buildAgentRegistry(home = DEFAULT_HOME) {
  return [
    { id: "claude-code",    label: "Claude Code",     kind: "claude-cli",
      present: (probe) => probe.cmd("claude") },
    { id: "claude-desktop", label: "Claude Desktop",  kind: "json-mcp",
      configPath: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
      present: (probe, cp) => probe.path(cp) },
    { id: "gemini-cli",     label: "Gemini CLI",      kind: "json-mcp",
      configPath: path.join(home, ".gemini", "settings.json"),
      skillDir:   path.join(home, ".gemini", "skills"),
      present: (probe, cp) => probe.path(cp) || probe.cmd("gemini") },
    { id: "antigravity",    label: "Antigravity CLI", kind: "json-mcp",
      configPath:   path.join(home, ".gemini", "antigravity-cli", "settings.json"),
      skillDir:     path.join(home, ".gemini", "antigravity-cli", "skills"),
      mcpSupported: false,
      mcpNote: "Antigravity CLI does not read mcpServers from settings.json — skill placed, MCP skipped (CLI fallback active)",
      present: (probe, cp) => probe.path(cp) },
    { id: "cursor",         label: "Cursor",          kind: "json-mcp",
      configPath: path.join(home, ".cursor", "mcp.json"),
      present: (probe, cp) => probe.path(cp) || probe.cmd("cursor") },
    { id: "codex",          label: "Codex",           kind: "toml-mcp",
      configPath: path.join(home, ".codex", "config.toml"),
      present: (probe, cp) => probe.path(cp) || probe.cmd("codex") },
  ];
}

export const AGENT_REGISTRY = buildAgentRegistry();

export function detectAgents(probe, registry = AGENT_REGISTRY) {
  // strip `present` (a closure, not serialisable); pass everything else through
  return registry
    .filter((a) => a.present(probe, a.configPath))
    .map(({ present: _present, ...rest }) => rest);
}


export function mergeJsonServers(text, name, payload) {
  let obj = {};
  let recovered = false;
  const trimmed = (text ?? "").trim();
  if (trimmed === "") {
    // empty/whitespace → {}
  } else {
    try { obj = JSON.parse(trimmed); } catch { obj = {}; recovered = true; }
  }
  if (!obj.mcpServers) obj.mcpServers = {};
  const isNew = !obj.mcpServers[name];
  obj.mcpServers[name] = payload;
  const status = recovered ? "recovered" : isNew ? "created" : "updated";
  return { text: JSON.stringify(obj, null, 2), status };
}

// ponytail: line-based table extractor — ceiling is inline tables / arrays-of-tables / multi-line values. upgrade: swap for a real TOML parser (@iarna/toml) the day a config ships an inline/array table or a quoted multi-line value this mis-parses.
export function mergeTomlServers(text, name, payload) {
  const lines = (text ?? "").split("\n");
  const header = `[mcp_servers.${name}]`;
  const block = serializeTomlBlock(header, payload);

  // Find existing header
  let headerIdx = lines.findIndex((l) => l.trim() === header);
  if (headerIdx >= 0) {
    // Find end of block (next [...] header or EOF)
    let endIdx = headerIdx + 1;
    while (endIdx < lines.length && !/^\s*\[/.test(lines[endIdx])) endIdx++;
    lines.splice(headerIdx, endIdx - headerIdx, block);
    return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n"), status: "updated" };
  }

  // Append
  const nonEmpty = lines.some((l) => l.trim() !== "");
  if (!nonEmpty) return { text: block, status: "created" };
  const padded = text.endsWith("\n") ? text : `${text}\n`;
  const withBlank = padded.endsWith("\n\n") ? padded : `${padded}\n`;
  return { text: `${withBlank}${block}`, status: "created" };
}

function serializeTomlBlock(header, payload) {
  const argsStr = payload.args.map((a) => `"${a}"`).join(", ");
  return `${header}\ncommand = "${payload.command}"\nargs = [${argsStr}]\n`;
}
