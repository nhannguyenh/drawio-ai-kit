---
name: drawio-aws-architect
version: 0.1.0
description: Use when the user asks for an AWS architecture diagram (or any draw.io diagram heavy on AWS services). Builds the diagram with the declarative layout engine (no hardcoded coordinates), uses ground-truth AWS stencils, validates it (stencil names, colors, nesting, geometry — overlap/spill/stacked-arrows), then renders a PNG and runs a vision self-check before delivering. Backed by the drawio-ai-kit MCP server (search_icon / validate_diagram / render_diagram / get_principles / brand_logo).
license: MIT
---

# Draw.io AWS Architect

Produce **correct and beautiful** AWS architecture diagrams in draw.io. This skill is the workflow layer; the deterministic tools live in the `drawio-ai-kit` MCP server (or its CLI `src/cli.mjs`).

## Tools available (MCP `drawio-ai-kit`)

| Tool | Use |
|---|---|
| `search_icon` | Resolve the exact AWS stencil + ready-to-paste style. **Never hand-write `resIcon=` names.** |
| `get_icon_style` | Full style for a known stencil name. |
| `brand_logo` | Logo for non-AWS brands (AI/LLM + some) as an `image` style. For OSS draw.io/lobe-icons lack (Kafka, Starburst, MinIO, Dagster…), encode SVGs via `scripts/crawl_icons.py --mode base64`. |
| `validate_diagram` | Lint: unknown stencils, dangling edges, recolored icons, broken AWS group nesting, **geometry (overlap / child-spills-its-frame / stacked arrowheads)**, aesthetic `audit.advice`. |
| `render_diagram` | Render the XML to PNG and return the image — your built-in **vision self-check**. Look at it and fix before delivering. |
| `get_principles` | Design rules + AWS architecture preset + catalog categories. |

If the MCP server isn't registered, call the same logic via `node src/cli.mjs <search|validate|audit|logo|principles>`.

## Build with the layout engine — do NOT hand-place coordinates

Always construct the diagram with the declarative engine (`src/layout-engine.mjs` + `src/builder.mjs`), which computes every x/y/w/h and routes fan-out/fan-in edges as clean combs. Hand-written coordinates are the #1 cause of overlap/misalignment. Declare the nested structure with `group`/`frame`/`grid` + `icon`/`box`, call `renderTree(d, root)`, then `d.link(...)`. Use `grid({cols})` when an item count doesn't match a sibling row (e.g. 4 icons under 3 columns). See `examples/*.mjs` for each diagram type.

## Workflow

1. **Clarify (if vague)** — diagram type (pipeline / VPC-network / event-driven / hybrid-DR), output format (PNG default), scope.
2. **Read the rules** — call `get_principles` once. Follow `rules/principles.md` + `rules/aws-architecture.md` (grid/alignment, role-based edges, category colors, group nesting, Multi-AZ).
3. **Resolve every icon** — `search_icon` for each AWS service; `brand_logo` for non-AWS brands. Paste styles verbatim. For large graphs (>~15 nodes) describe the graph as JSON and run `python3 vendor/autolayout.py graph.json -o name.drawio` (needs Graphviz `dot`).
4. **Build with the engine** (see section above) — declare the nested structure; let `renderTree` compute layout. Containers nested in real order (`AWS Cloud→Region→VPC→AZ→Subnet→SG`); pipeline left→right; cross-cutting layers as a band. Edges via `d.link(...)` — fan-out/fan-in route as combs automatically.
5. **Validate** — `validate_diagram`. Clear all `errors`, then resolve `warnings` and every `audit.advice` item (geometry overlap/spill/stacked-arrows, font/palette/fan-out/recolor/nesting). Re-validate until clean.
6. **Render + vision self-check** — call `render_diagram` and LOOK at the returned image. Fix anything the static audit can't catch: lop-sided whitespace, clipped labels, edges crossing unrelated shapes, awkward routing. Re-render. Max ~2 rounds.
7. **Review with the user**, apply targeted edits, re-render.
8. **Final export** (editable + crisp), if the user wants files on disk:
   `drawio -x -f png -e -s 2 -o name.drawio.png name.drawio && python3 vendor/repair_png.py name.drawio.png`
   SVG/PDF: `drawio -x -f svg -e -o name.svg name.drawio`.

**No draw.io CLI?** `render_diagram` will say so; fall back to `python3 vendor/encode_drawio_url.py --edit name.drawio` → open the printed URL, or deliver the `.drawio` only.

## Self-check checklist (before delivering)

- [ ] Built with the layout engine — no hand-written coordinates.
- [ ] `validate_diagram` → `ok: true`, no warnings, `audit.advice` empty (incl. geometry: no overlap / spill / stacked arrowheads).
- [ ] Every AWS icon came from `search_icon` (no recolor; category colors intact).
- [ ] Groups nested in real order; managed/global services outside the VPC.
- [ ] `render_diagram` vision self-check passed (no overlaps / clipped labels / crossing edges / lop-sided whitespace).
