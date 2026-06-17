#!/usr/bin/env bash
# drawio-ai-kit — one-shot installer for Claude Code (MCP server + Skill).
# Idempotent: safe to re-run. Run it from anywhere; it locates the kit by this
# script's own path (so it works whether you cloned manually or piped it in).
set -euo pipefail

REPO="git@github.com:sparklabx/drawio-ai-kit.git"
SKILL_NAME="drawio-aws-architect"
MCP_NAME="drawio-ai-kit"

# --- locate (or clone) the kit ---------------------------------------------
if [ -f "${BASH_SOURCE[0]:-}" ] && [ -f "$(dirname "${BASH_SOURCE[0]}")/src/mcp-server.mjs" ]; then
  KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"          # running from inside the clone
elif [ -f "src/mcp-server.mjs" ]; then
  KIT="$(pwd)"
else
  echo "→ Cloning $REPO ..."
  git clone "$REPO"
  KIT="$(cd drawio-ai-kit && pwd)"
fi
echo "→ Kit: $KIT"

# --- deps -------------------------------------------------------------------
echo "→ Installing npm deps ..."
( cd "$KIT" && npm install --silent )

# --- resolve absolute node (MCP is spawned with a bare env) -----------------
NODE_BIN="$(command -v node)"
[ -n "$NODE_BIN" ] || { echo "✗ node not found on PATH"; exit 1; }
echo "→ node: $NODE_BIN"

# --- 1) MCP server (re-add cleanly so re-runs don't error) ------------------
echo "→ Registering MCP server '$MCP_NAME' ..."
claude mcp remove "$MCP_NAME" >/dev/null 2>&1 || true
claude mcp add "$MCP_NAME" -- "$NODE_BIN" "$KIT/src/mcp-server.mjs"

# --- 2) Skill (symlink) -----------------------------------------------------
echo "→ Linking skill '$SKILL_NAME' ..."
mkdir -p "$HOME/.claude/skills"
ln -sfn "$KIT" "$HOME/.claude/skills/$SKILL_NAME"

# --- verify -----------------------------------------------------------------
echo
echo "✓ Done. Verifying:"
claude mcp list | grep "$MCP_NAME" || true
ls -l "$HOME/.claude/skills/$SKILL_NAME"
echo
echo "⚠  Restart Claude Code — MCP servers & skills load only at session start."
