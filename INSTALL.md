# Install drawio-cloud-architect (Claude Desktop + Claude Code + more)

## Requirements
- Node.js 18+
- `claude` CLI (for Claude Code) — https://docs.claude.com/claude-code

Optional (the installer detects these and **offers to install** what's missing — `brew`/`apt`/`snap`, interactive y/N or `--yes`; everything else works without them):
- **draw.io desktop app** — enables `render_diagram` (the vision self-check) and PNG/SVG export. If the binary isn't on PATH, set `DRAWIO_CLI` to it. On headless Linux (no display), also `apt install xvfb` and wrap exports with `xvfb-run -a`.
- **Graphviz** (`brew install graphviz` / `apt install graphviz`) — enables `vendor/autolayout.py` for large graphs (>~15 nodes), including `--tune` direction selection.

## Install

```bash
cd drawio-ai-kit
bash install.sh
```

Then restart your Claude app. Try: *"draw an AWS 3-tier web app"*

The unified installer handles MCP server registration and skill placement for all supported agents.
