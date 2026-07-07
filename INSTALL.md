# Install drawio-ai-kit

## Requirements
- Node.js 18+

Optional (everything else works without them):
- **draw.io desktop app** — enables `drawio-ai render` (PNG/SVG export + vision self-check). If the binary isn't on PATH, set `DRAWIO_CLI` to it. On headless Linux (no display), also `apt install xvfb` and wrap exports with `xvfb-run -a`.
- **Graphviz** (`brew install graphviz` / `apt install graphviz`) — enables `vendor/autolayout.py` for large graphs (>~15 nodes), including `--tune` direction selection.

## Install

```bash
npm i -g drawio-ai-kit
```

This puts the `drawio-ai` binary on PATH.

## Add Domain Skills

The kit ships 5 thin Domain Skills — one per cloud/domain. Add the ones you need
via the standard npm skills tooling:

```bash
npx skills add drawio-aws        # AWS
npx skills add drawio-azure      # Azure
npx skills add drawio-gcp        # GCP
npx skills add drawio-databricks # Databricks
npx skills add drawio-bpmn       # BPMN
```

Restart your agent after adding a skill. Try: *"draw an AWS 3-tier web app"*

## Verify

```bash
drawio-ai --help
drawio-ai search s3
drawio-ai validate path/to/diagram.drawio
```
