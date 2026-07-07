# Install drawio-ai-kit

## Requirements
- Node.js 18+

Optional (everything else works without them):
- **draw.io desktop app** — enables `drawio-ai render` (PNG/SVG export + vision self-check). If the binary isn't on PATH, set `DRAWIO_CLI` to it. On headless Linux (no display), also `apt install xvfb` and wrap exports with `xvfb-run -a`.
- **Graphviz** (`brew install graphviz` / `apt install graphviz`) — enables `vendor/autolayout.py` for large graphs (>~15 nodes), including `--tune` direction selection.

## Install

```bash
npm i -g github:sparklabx/drawio-ai-kit
```

This puts the `drawio-ai` binary on PATH. The package isn't on the npm registry —
it installs straight from GitHub. Pin a specific version for reproducibility:
`npm i -g github:sparklabx/drawio-ai-kit#<commit-sha>` (or `#v1.0.0` once a tag
exists). To install from a local clone instead: `npm i -g .` (or `npm link` for
live edits).

## Add Domain Skills

The kit ships 5 thin Domain Skills — one per cloud/domain — in its `skills/`
folder. Install them with the `skills` CLI (auto-detects Claude Code, Cursor,
Codex, Gemini CLI, … and writes to each agent's skill dir):

```bash
npx skills add sparklabx/drawio-ai-kit --list               # preview the 5 skills
npx skills add sparklabx/drawio-ai-kit --skill drawio-aws   # just AWS
npx skills add sparklabx/drawio-ai-kit --skill drawio-azure # ...or azure/gcp/databricks/bpmn
npx skills add sparklabx/drawio-ai-kit                      # ...or install all 5
```

Restart your agent after adding a skill. Try: *"draw an AWS 3-tier web app"*

## Verify

```bash
drawio-ai --help
drawio-ai search s3
drawio-ai validate path/to/diagram.drawio
```
