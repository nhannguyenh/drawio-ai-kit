---
name: drawio-aws-architect
version: 0.1.0
description: Use when the user asks for an AWS architecture diagram (or any draw.io diagram heavy on AWS services). Generates .drawio XML with ground-truth AWS stencils, validates it (correct stencil names, category colors, group nesting, aesthetic lint), exports to PNG, and runs a vision self-check before delivering. Backed by the drawio-ai-kit MCP server (search_icon / validate_diagram / get_principles / brand_logo).
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
| `validate_diagram` | Lint: unknown stencils, dangling edges, recolored icons, broken AWS group nesting, aesthetic `audit.advice`. |
| `get_principles` | Design rules + AWS architecture preset + catalog categories. |

If the MCP server isn't registered, call the same logic via `node src/cli.mjs <search|validate|audit|logo|principles>`.

## Workflow

1. **Clarify (if vague)** — diagram type (pipeline / VPC-network / event-driven / hybrid-DR), output format (PNG default), scope.
2. **Read the rules** — call `get_principles` once. Follow `rules/principles.md` + `rules/aws-architecture.md` (grid/alignment, role-based edges, category colors, group nesting, Multi-AZ).
3. **Resolve every icon** — `search_icon` for each AWS service; `brand_logo` for non-AWS brands. Paste styles verbatim. For large graphs (>~15 nodes) describe the graph as JSON and run `python3 vendor/autolayout.py graph.json -o name.drawio` (needs Graphviz `dot`).
4. **Generate** the `.drawio` XML. Containers nested in real order (`AWS Cloud→Region→VPC→AZ→Subnet→SG`); pipeline left→right; cross-cutting layers as a band; fan-out edges `rounded=0` + pinned anchors.
5. **Validate** — `validate_diagram`. Clear all `errors`, then resolve `warnings` and `audit.advice` (font/palette/fan-out/recolor/nesting). Re-validate until clean.
6. **Export preview PNG** — resolve the draw.io binary (`drawio` / `draw.io` / `/Applications/draw.io.app/Contents/MacOS/draw.io`), then:
   `drawio -x -f png --width 2000 -o name.png name.drawio`  — **no `-e`** (an embedded-XML PNG breaks the vision API).
7. **Vision self-check** — read `name.png` with the agent's vision. Fix: overlapping shapes, clipped labels, edges crossing unrelated shapes, off-canvas nodes, stacked edges (distribute exitX/entryX). Max 2 rounds, re-export each time. *(This catches visual issues the static audit cannot.)*
8. **Review with the user**, apply targeted edits, re-export.
9. **Final export** with `-e` (editable), then repair PNG:
   `drawio -x -f png -e -s 2 -o name.drawio.png name.drawio && python3 vendor/repair_png.py name.drawio.png`
   SVG/PDF: `drawio -x -f svg -e -o name.svg name.drawio`.

**No draw.io CLI?** Use the browser fallback: `python3 vendor/encode_drawio_url.py --edit name.drawio` → open the printed URL. Or deliver the `.drawio` only.

## Self-check checklist (before delivering)

- [ ] `validate_diagram` → `ok: true`, no warnings, `audit.advice` empty.
- [ ] Every AWS icon came from `search_icon` (no recolor; category colors intact).
- [ ] Groups nested in real order; managed/global services outside the VPC.
- [ ] Fan-out/bus edges: `rounded=0` + pinned anchors. Consistent flow direction.
- [ ] Vision self-check passed (no overlaps / clipped labels / crossing edges).
