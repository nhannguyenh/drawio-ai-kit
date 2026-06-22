#!/usr/bin/env bash
# ============================================================================
# Bootstrap the drawio-ai-kit inside Coworker AI (or any Claude host with shell).
# Run this once in the VM, then paste the AGENT PROMPT (printed at the end) into Coworker.
# ============================================================================
set -e
KIT_DIR="${KIT_DIR:-$HOME/drawio-ai-kit}"
REPO="https://github.com/sparklabx/drawio-ai-kit.git"   # private? use a PAT or SSH instead

echo "== 1) check deps =="
command -v node >/dev/null || { echo "!! need Node.js 18+ (https://nodejs.org)"; exit 1; }
command -v git  >/dev/null || { echo "!! need git"; exit 1; }
echo "   node $(node --version), git ok"
command -v drawio >/dev/null && echo "   drawio CLI ok (PNG render/vision-check available)" \
  || echo "   (optional) no draw.io CLI — .drawio output still works; install draw.io Desktop only if you want PNG render"

echo "== 2) clone / update kit =="
if [ -d "$KIT_DIR/.git" ]; then git -C "$KIT_DIR" pull --ff-only; else git clone "$REPO" "$KIT_DIR"; fi

echo "== 3) smoke test =="
cd "$KIT_DIR"
node src/cli.mjs principles >/dev/null && echo "   principles ok (rules + Templates + Reproduction loop)"
node src/cli.mjs search eks   >/dev/null && echo "   search_icon ok"
mkdir -p out
node examples/build_landingzone_hubspoke_template.mjs >/dev/null && echo "   template build ok -> out/sa_landingzone_template.drawio"

cat <<'PROMPT'

== 4) PASTE THIS PROMPT INTO COWORKER (edit <KIT_DIR> to the path above) ==
------------------------------------------------------------------------------
You are an AWS draw.io architect. Use the kit at <KIT_DIR> (drawio-ai-kit).
Workflow every time you draw a diagram:
1. Read the rules:  node src/cli.mjs principles
   (covers grid/colors, Multi-AZ, edge rules, the Templates index, and the Reproduction loop)
2. If the request matches a template (examples/), OPEN it and REPRODUCE its structure — don't free-hand.
3. Icons: node src/cli.mjs search <name>   (never invent stencil names; paste the exact style)
4. Reproduction loop: build (layout engine, no hardcoded coords) -> node src/cli.mjs validate <file>
   -> (optional) drawio -x -f png -e -s 2 -p <page> -o check.png <file> -> check against the
   archetype conformance checklist -> fix -> repeat until validate is clean AND checklist passes.
5. Write the .drawio into my working directory.
------------------------------------------------------------------------------

== OR register as an MCP server in Coworker (Settings -> MCP/Connectors) ==
{
  "mcpServers": {
    "drawio-ai-kit": { "command": "node", "args": ["<KIT_DIR>/src/mcp-server.mjs"] }
  }
}
PROMPT
echo "Done. KIT_DIR=$KIT_DIR"
