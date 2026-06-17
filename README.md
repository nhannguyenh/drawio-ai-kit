# drawio-ai-kit

A support kit that lets an AI draw **beautiful, correct** draw.io diagrams — especially AWS architectures.

It solves the real failure mode (an AI inventing stencil names → blank icons) with three pieces:

1. **Catalog** — ground-truth list of draw.io stencil names (`mxgraph.aws4.*`) + category + canonical color.
2. **Rules** — encoded layout/design principles (`rules/principles.md`).
3. **Validator** — lints diagram XML so every icon reference is real before it ships.

Exposed to the AI as an **MCP server** and runnable directly as a **CLI**.

## Build a diagram — declarative, no hardcoded coordinates

Pick a **type** (`pipeline`/`hierarchy`/`network`/`hubspoke`/`hybrid`/`mesh`/`sequence`), declare the **nested structure**, and the layout engine computes every x/y/w/h (frames auto-size to fit their children, rows/cols auto-space). You write structure, not pixels.

```js
import { Diagram } from "./src/builder.mjs";
import { group, icon, box, renderTree } from "./src/layout-engine.mjs";

const d = new Diagram("network");
const tree = group("region", "group_region", "Region", { dir: "row" }, [
  group("vpc", "group_vpc", "VPC", { dir: "col" }, [
    icon("alb", "elastic_load_balancing", "ALB"),
    icon("ec2", "ec2", "EC2"),
  ]),
]);
renderTree(d, tree);                 // engine lays everything out + sizes the page
d.title("My VPC");
d.link("alb", "ec2");                // edges by id; router picks straight/corridor
const res = d.validate();            // names real? colors/nesting/labels clean?
// d.mxfile("My VPC")  → write to .drawio, export PNG, then vision self-check
```

Icon names come from `search_icon` (never invented); edge routing, panel sizing, alignment and corner-style-by-type are all computed. The AI's job is structure + a render→look→fix (vision self-check) loop — see `SKILL.md`. Example: `examples/build_mesh.mjs` (zero coordinates).

## Runtime split

- **Node 26** (`.nvmrc`) — serving layer: MCP server, CLI, validator (`src/`). Code is back-compatible to Node 18+, so it runs on Node 22 while you install 26.
- **Python 3.11** (`.python-version`) — data "cook" layer: catalog generator + base64 icon crawler (`scripts/crawl_icons.py`, stdlib only).

Install the targets:

```bash
nvm install 26 && nvm use 26          # or: brew install node   (node@25 also fine for now)
brew install python@3.11              # then: python3.11 --version
```

## MCP tools

| Tool | Purpose |
| --- | --- |
| `search_icon` | Find a stencil by keyword/category → returns the exact name + ready-to-paste draw.io `style` (verbatim from the index: real names, official colors, connection points). |
| `get_icon_style` | Get the full style for one stencil by exact name. |
| `validate_diagram` | Lint XML: unknown stencils, dangling edges, missing `aspect=fixed`, **recolored AWS icons**, **broken AWS group nesting**, plus an aesthetic `audit` (font/palette/fan-out/icon-size). |
| `get_principles` | Design rules + AWS architecture preset + catalog categories. |
| `brand_logo` | Logo for non-AWS brands (AI/LLM + some) as an `image` style, via `vendor/aiicons.py` (lobe-icons). Needs python3. |

A thin **`SKILL.md`** wraps these tools into a full generate → validate → export-PNG → **vision self-check** → final-export workflow. Vendored helpers in `vendor/`: `autolayout.py` (Graphviz layout for >15-node graphs), `aiicons.py`, `repair_png.py`, `encode_drawio_url.py` (browser fallback).

### Register with Claude Code

```bash
cd drawio-ai-kit && npm install        # pulls @modelcontextprotocol/sdk
claude mcp add drawio-ai-kit -- node /Users/vanhungdo/Documents/Work/VCB/drawio-ai-kit/src/mcp-server.mjs
```

Or in `settings.json`:

```json
{
  "mcpServers": {
    "drawio-ai-kit": { "command": "node", "args": ["/abs/path/drawio-ai-kit/src/mcp-server.mjs"] }
  }
}
```

## CLI (works now, no MCP SDK needed)

```bash
node src/cli.mjs search s3
node src/cli.mjs search kubernetes --category Containers
node src/cli.mjs search "aws cloud" --kind group
node src/cli.mjs style simple_storage_service
node src/cli.mjs validate ../4_oncloud.drawio
node src/cli.mjs categories
node src/cli.mjs principles
```

## Catalog (ground-truth, 983 AWS icons)

`catalog/aws.json` is generated from `data/shape-index.json.gz` (10,446-shape index from jgraph/drawio-mcp, Apache-2.0) — real stencil names (`s3`, `eks`, `identity_and_access_management`, ...), official per-icon colors, connection points, and `aspect=fixed`, all **verbatim**. No hand-guessing.

Regenerate after refreshing the index:

```bash
python3.11 scripts/ingest_index.py        # data/shape-index.json.gz → catalog/aws.json (983 icons, 19 groups)
```

For OSS/brand logos draw.io lacks (Confluent, Starburst, MinIO, ...), use the vendored `vendor/aiicons.py` (lobe-icons via image style) or encode your own SVGs:

```bash
python3.11 scripts/crawl_icons.py --mode base64 --src ./svg-oss   # SVGs → catalog/custom-icons.json
```

See `THIRD_PARTY_NOTICES.md` for attributions.

## Tests

```bash
npm test        # node --test
```

## Notes & licensing

- Prefer **native stencils** (this catalog) over base64 — smaller files, crisp vectors, cleaner licensing.
- Use **base64** (`custom-icons.json`) only for icons draw.io lacks (Confluent, Starburst, OpenMetadata, MinIO, Dagster, internal/VCB logos) or when rendering outside draw.io.
- The official AWS Architecture Icons have their own usage terms — review before redistributing a base64 bundle publicly.
- Category colors in the seed are approximate; the generator can refresh them.
