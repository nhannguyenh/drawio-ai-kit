// install.mjs — impure orchestrator + entry point for the multi-agent installer
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  MCP_NAME,
  CANONICAL_DIR,
  SKILL_NAME,
  MCP_SERVER_MJS,
  BPMN_DIR,
  SKILLS,
  ENGINE_LINKS,
  OLD_SKILL_NAME,
  OLD_CANONICAL_DIR,
  AGENT_REGISTRY,
  mcpPayload,
  claudeCodeAddCommand,
  resolveSource,
  detectAgents,
  mergeJsonServers,
  mergeTomlServers,
} from "./installer.mjs";

export async function orchestrate(io, opts = {}) {
  const { dryRun = false, mode, agents: optAgents, yes = false } = opts;
  const actions = [];

  // 1. Prereq gate: Node >= 18
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) {
    io.log(`Error: Node ${process.versions.node} is too old; need >= 18.`);
    return { ok: false, reason: "node-too-old" };
  }

  // 2. Source resolution
  const hasMcpServer = io.exists("src/mcp-server.mjs");
  const pkg = io.readPkg ? io.readPkg() : { name: "" };
  const isClone = hasMcpServer && pkg.name === "drawio-ai-kit";
  const source = resolveSource(isClone);

  // 3. Detect agents (skipped when forced — keeps --dry-run --agents spawn-free)
  const present = optAgents ? [] : detectAgents(io.probe || { cmd: () => false, path: () => false });

  // 3b. No agents guard — bail before any prompt
  if (present.length === 0 && !optAgents) {
    io.log("No supported agents detected.");
    return { ok: false, reason: "no-agents" };
  }

  // 3c. Resolve backend mode — default MCP; override with --mode cli if needed
  const resolvedMode = mode || "mcp";

  // 4. Multi-select targets
  let selected;
  if (optAgents) {
    selected = optAgents;
  } else if (dryRun) {
    // dry-run is non-interactive: select all detected agents
    selected = present.map((a) => a.id);
  } else {
    const answer = await io.prompt("Select agents", present);
    selected = Array.isArray(answer) ? answer : [answer];
  }

  // fail-fast wrapper: bail loudly on non-zero exit instead of wiring MCP to a path
  // that skills never created (Bug A — exec exit code was silently ignored).
  const must = async (label, cmd, args, opts) => {
    const r = await io.exec(cmd, args, opts);
    if (r.code !== 0) {
      io.log(`✗ ${label} failed (exit ${r.code})${r.stderr ? `: ${r.stderr.trim()}` : ""}`);
      return false;
    }
    actions.push(opts?.cwd ? { cmd, args, cwd: opts.cwd } : { cmd, args });
    return true;
  };

  // Build agent map once — used by steps 7 and 7b
  const agentMap = new Map(AGENT_REGISTRY.map((a) => [a.id, a]));

  // 5. Place: global `skills add` stages EVERY skill this repo ships (root SKILL.md = the
  // engine-bearing cloud skill; skills/drawio-bpmn/SKILL.md = the BPMN skill) and symlinks them
  // into every detected agent. --full-depth makes the CLI discover the subdir skill alongside
  // the root one. Source MUST precede flags (yargs parsing) and `-a` MUST be omitted —
  // `-a <agents>` forces per-agent --copy and skips CANONICAL_DIR staging.
  const nodeBin = process.execPath;
  const canonicalExists = io.exists(CANONICAL_DIR);

  // 4b. Migration: prior releases staged this as `drawio-aws-architect`; the kit is now multi-cloud
  // (`drawio-cloud-architect`). Remove the stale old skill so it doesn't orphan next to the new one
  // (the MCP entry is keyed by MCP_NAME so it gets rewired below regardless). Best-effort: a failed
  // remove must not abort the install, so the `must` result is intentionally ignored.
  if (io.exists(OLD_CANONICAL_DIR) && !canonicalExists)
    await must("migrate (remove legacy drawio-aws-architect)", "npx", ["skills", "remove", OLD_SKILL_NAME, "-g", "-y"]);

  const placeArgs = canonicalExists
    ? ["skills", "update", ...SKILLS, "-g", "-y"]
    : ["skills", "add", source, "-g", "--full-depth", "-y"];
  if (!(await must("place (skills)", "npx", placeArgs))) return { ok: false, reason: "place-failed" };

  // 5b. Attach the shared engine into the BPMN skill via sibling symlinks. The skills CLI stages
  // a subdir skill as its SKILL.md only, so link src/catalog/… in from the engine-bearing AWS
  // skill next door → ~/.agents/skills/drawio-bpmn/src/bpmn.mjs resolves. Idempotent (io.symlink
  // unlinks first); skipped if the BPMN skill wasn't staged.
  if (io.exists(BPMN_DIR) && typeof io.symlink === "function") {
    for (const sub of ENGINE_LINKS) await io.symlink(path.join(CANONICAL_DIR, sub), path.join(BPMN_DIR, sub));
    actions.push({ symlink: BPMN_DIR });
  }

  // 6. npm install in canonical dir (skills copies sources but installs no node_modules)
  if (!(await must("install (npm)", "npm", ["install", "--silent"], { cwd: CANONICAL_DIR })))
    return { ok: false, reason: "install-failed" };

  // 6b. Verify MCP server starts and responds to initialize
  if (!dryRun && io.verify) {
    const mcpOk = await io.verify(nodeBin, path.join(CANONICAL_DIR, MCP_SERVER_MJS));
    if (mcpOk) {
      io.log("✓ MCP server verified");
    } else {
      io.log("⚠ MCP server smoke-test failed — check node version or run: node src/mcp-server.mjs");
    }
  }

  // 6c. Optional-tools doctor. Both tools degrade gracefully at point of use; this surfaces the
  // gaps at install time — and OFFERS to install via the detected package manager (interactive
  // y/N, or `--yes`; report-only in CI/non-TTY): draw.io CLI → render/export; Graphviz → autolayout.
  if (!dryRun) {
    const has = async (cmd) => (await io.exec("which", [cmd]))?.code === 0;
    // Detect the SET of available managers (a Linux box may need apt for one tool and snap for
    // another), and whether we can elevate (root, or sudo present). brew never takes sudo.
    const mgr = {};
    for (const m of ["brew", "apt-get", "dnf", "yum", "pacman", "zypper", "apk", "snap"])
      mgr[m] = await has(m);
    const root = typeof process.getuid === "function" && process.getuid() === 0;
    const canSudo = root || (await has("sudo"));
    const sys = (m, args) => (mgr[m] && canSudo ? (root ? [m, args] : ["sudo", [m, ...args]]) : null);
    const offerInstall = async (what, specs) => {
      const spec = specs.find(Boolean);
      if (!spec || !io.run) return false;
      const cmdline = `${spec[0]} ${spec[1].join(" ")}`;
      const consent = yes || (io.ask && (await io.ask(`  Install ${what} now? (${cmdline}) [y/N] `)));
      if (!consent) return false;
      io.log(`→ ${cmdline}`);
      return (await io.run(spec[0], spec[1])).code === 0;
    };
    // Graphviz — same package name in every repo.
    let dot = await has("dot");
    if (!dot) {
      io.log("⚠ Graphviz not found — vendor/autolayout.py (large graphs, --tune) unavailable");
      if (await offerInstall("Graphviz", [
        mgr.brew && ["brew", ["install", "graphviz"]],
        sys("apt-get", ["install", "-y", "graphviz"]),
        sys("dnf", ["install", "-y", "graphviz"]),
        sys("yum", ["install", "-y", "graphviz"]),
        sys("pacman", ["-S", "--noconfirm", "graphviz"]),
        sys("zypper", ["install", "-y", "graphviz"]),
        sys("apk", ["add", "graphviz"]),
      ])) dot = await has("dot");
    }
    io.log(dot ? "✓ Graphviz — vendor/autolayout.py (large graphs, --tune) enabled"
               : "  hint: install graphviz with your package manager (brew/apt/dnf/pacman/apk…)");
    // draw.io desktop — brew cask on macOS, snap on Linux (no apt/dnf package exists).
    const drawioPresent = async () => (process.env.DRAWIO_CLI && io.exists(process.env.DRAWIO_CLI)) ||
      (await has("drawio")) || io.exists("/Applications/draw.io.app/Contents/MacOS/draw.io");
    let drawio = await drawioPresent();
    if (!drawio) {
      io.log("⚠ draw.io CLI not found — render_diagram / PNG export unavailable");
      if (await offerInstall("draw.io desktop", [
        process.platform === "darwin" && mgr.brew && ["brew", ["install", "--cask", "drawio"]],
        sys("snap", ["install", "drawio"]),
      ])) drawio = await drawioPresent();
    }
    io.log(drawio ? "✓ draw.io CLI — render_diagram / PNG export enabled"
                  : "  hint: install the draw.io desktop app (macOS: brew install --cask drawio · Linux: snap install drawio, or the .deb/.rpm/AppImage from github.com/jgraph/drawio-desktop/releases), or set DRAWIO_CLI");
  }

  // 7. Wire MCP (if resolvedMode !== 'cli')
  if (resolvedMode !== "cli") {
    const payload = mcpPayload(nodeBin, CANONICAL_DIR);
    for (const agent of selected) {
      const info = agentMap.get(agent);
      if (agent === "claude-code") {
        // idempotent: clear any prior registration before re-adding (failure tolerated)
        await io.exec("claude", ["mcp", "remove", MCP_NAME, "--scope", "user"]);
        actions.push({ cmd: "claude", args: ["mcp", "remove", MCP_NAME, "--scope", "user"] });
        const claudeCmd = claudeCodeAddCommand(MCP_NAME, nodeBin, CANONICAL_DIR);
        if (!(await must("claude mcp add", claudeCmd.cmd, claudeCmd.args))) return { ok: false, reason: "wire-failed" };
      } else if (info?.kind === "json-mcp" && info.configPath) {
        if (info.mcpSupported === false) {
          io.log(`ℹ ${info.label}: ${info.mcpNote ?? "MCP not supported via config — skipping"}`);
        } else {
          const text = await io.readFile(info.configPath);
          const result = mergeJsonServers(text, MCP_NAME, payload);
          if (result.status === "recovered") {
            await io.writeFile(`${info.configPath}.bak`, text);
            io.log(`⚠ ${info.configPath} was malformed JSON — original backed up to ${info.configPath}.bak before rewriting.`);
          }
          await io.writeFile(info.configPath, result.text);
          actions.push({ write: info.configPath });
        }
      } else if (info?.kind === "toml-mcp" && info.configPath) {
        const text = await io.readFile(info.configPath);
        const result = mergeTomlServers(text, MCP_NAME, payload);
        await io.writeFile(info.configPath, result.text);
        actions.push({ write: info.configPath });
      }
    }
  }

  // 7b. Agent-specific skill placement (e.g. Antigravity/Gemini CLI auto-discover from their own skills dir)
  {
    const skillSrc = path.join(CANONICAL_DIR, "SKILL.md");
    for (const agent of selected) {
      const info = agentMap.get(agent);
      if (!info?.skillDir) continue;
      const dest = path.join(info.skillDir, SKILL_NAME);
      const skillDest = path.join(dest, "SKILL.md");
      if (!(await io.exists(dest))) await io.mkdir(dest);
      await io.symlink(skillSrc, skillDest);
      actions.push({ symlink: skillDest });
    }
  }

  // 8. Restart guidance — split by what was actually installed
  const mcpAgents = [], skillOnlyAgents = [];
  for (const id of selected) {
    const info = agentMap.get(id);
    const label = info ? info.label : id;
    if (resolvedMode === "cli" || info?.mcpSupported === false) skillOnlyAgents.push(label);
    else mcpAgents.push(label);
  }
  if (mcpAgents.length)     io.log(`\n✓ Done. Restart: ${mcpAgents.join(", ")} — Skill + MCP server loads only at agent startup.`);
  if (skillOnlyAgents.length) io.log(`${mcpAgents.length ? "" : "\n"}✓ Done. Restart: ${skillOnlyAgents.join(", ")} — Skill (CLI fallback) loads only at agent startup.`);
  return { ok: true, actions };
}

// --- io builder (exported so the dry-run side-effect-free contract is testable) ---
export function buildIo({ dryRun = false, agents } = {}) {
  return {
    exec: (cmd, execArgs, opts) =>
      new Promise((resolve) => {
        if (dryRun) {
          resolve({ code: 0, stdout: "", stderr: "" });
          return;
        }
        execFile(cmd, execArgs, { cwd: opts?.cwd, timeout: 120_000 }, (err, stdout, stderr) => {
          resolve({ code: err ? err.code ?? 1 : 0, stdout: stdout || "", stderr: stderr || "" });
        });
      }),
    // Interactive y/N consent — false when non-interactive (CI/pipe) or dry-run.
    ask: async (question) => {
      if (dryRun || !process.stdin.isTTY) return false;
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(question)).trim();
      rl.close();
      return /^y(es)?$/i.test(answer);
    },
    // Like exec but with inherited stdio + no timeout — for package installs, where the
    // user must see progress and sudo/brew may prompt on the terminal.
    run: (cmd, runArgs) =>
      new Promise((resolve) => {
        if (dryRun) { resolve({ code: 0 }); return; }
        const child = spawn(cmd, runArgs, { stdio: "inherit" });
        child.on("close", (code) => resolve({ code: code ?? 1 }));
        child.on("error", () => resolve({ code: 1 }));
      }),
    readFile: (p) => fs.promises.readFile(p, "utf-8").catch(() => ""),
    writeFile: async (p, content) => {
      if (dryRun) return Promise.resolve();
      await fs.promises.mkdir(path.dirname(p), { recursive: true });
      return fs.promises.writeFile(p, content, "utf-8");
    },
    exists: (p) => fs.existsSync(p),
    mkdir: (p) => dryRun ? Promise.resolve() : fs.promises.mkdir(p, { recursive: true }),
    symlink: async (src, dest) => {
      if (dryRun) return;
      try { await fs.promises.unlink(dest); } catch { /* ok if missing */ }
      await fs.promises.symlink(src, dest);
    },
    verify: (nodeBin, serverPath) => {
      if (dryRun) return Promise.resolve(true);
      return new Promise((resolve) => {
        const child = spawn(nodeBin, [serverPath], { stdio: ["pipe", "pipe", "ignore"] });
        let buf = "";
        const t = setTimeout(() => { child.kill(); resolve(false); }, 5000);
        child.stdout.on("data", (d) => {
          buf += d;
          if (buf.includes('"result"')) { clearTimeout(t); child.kill(); resolve(true); }
        });
        child.on("error", () => { clearTimeout(t); resolve(false); });
        child.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "installer", version: "0" } } }) + "\n"
        );
        child.stdin.end();
      });
    },
    readPkg: () => {
      try {
        return JSON.parse(fs.readFileSync("package.json", "utf-8"));
      } catch {
        return { name: "" };
      }
    },
    prompt: async (question, choices) => {
      if (choices.length === 1) return choices[0].id;
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const labels = choices.map((c, i) => `${i + 1}. ${c.label}`).join("\n");
      console.log(`\n${question}:\n${labels}`);
      const answer = await rl.question("\nEnter number(s) or comma-separated ids: ");
      rl.close();
      const picked = answer.trim().split(",").map((s) => s.trim());
      if (picked.length === 1 && /^\d+$/.test(picked[0])) {
        const idx = Number(picked[0]) - 1;
        if (idx >= 0 && idx < choices.length) return choices[idx].id;
      }
      return picked;
    },
    log: (msg) => console.log(msg),
    // In dry-run with no forced agents, pretend every agent is present so the
    // preview shows full wiring without spawning `which`/`where`.
    probe: (dryRun && !agents)
      ? { cmd: () => true, path: () => true }
      : {
          cmd: (name) => {
            try {
              execFileSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" });
              return true;
            } catch {
              return false;
            }
          },
          path: (p) => fs.existsSync(p),
        },
  };
}

// --- Entry point ---
async function main() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let mode;
  let agents;
  let yes = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--mode") mode = args[++i];
    else if (args[i] === "--agents") agents = args[++i].split(",");
    else if (args[i] === "--yes" || args[i] === "-y") yes = true;
  }

  const io = buildIo({ dryRun, agents });
  const result = await orchestrate(io, { dryRun, mode, agents, yes });
  if (!result.ok) {
    process.exit(1);
  }

  if (dryRun) {
    console.log("\nDry run — would execute:\n");
    for (const a of result.actions) {
      if (a.write) {
        console.log(`  write → ${a.write}`);
      } else if (a.symlink) {
        console.log(`  symlink → ${a.symlink}`);
      } else {
        const cwd = a.cwd ? ` (cwd: ${a.cwd})` : "";
        console.log(`  ${a.cmd} ${(a.args || []).join(" ")}${cwd}`);
      }
    }
  }
}


// Only run main when executed directly (not when imported for testing)
if (process.argv[1] && new URL(process.argv[1], `file://${process.cwd()}/`).href === import.meta.url) {
  await main();
}
