# Principles for beautiful draw.io diagrams (AWS & system architecture)

Goal: draw.io XML with **correct stencil names**, **clean layout**, and a **readable flow** on the first try.

## 0. Mandatory workflow for the AI

- **Match a template first.** If the request fits an archetype with a template (the "Templates" table in `diagram-types.md` has exact `examples/<domain>/*.mjs` paths), open that file, reproduce its structure, and run the **Reproduction loop** there. Don't free-hand a pattern a template already encodes.
- **Look up every icon via `search_icon`** — do NOT recall or invent stencil names. Batch all lookups for the diagram in ONE call: `drawio-ai search "s3, lambda, nat gateway"`. Build with `icon("<name>")` using the returned `name`.

## 1. Sizing & alignment

The layout engine computes all x/y, spacing, row/column alignment, and sibling-height equalization automatically; icon sizes and `aspect=fixed` come from the catalog. Your call: **do not stretch a giant full-width banner** — size elements to their content, and don't mix many icon sizes in one diagram.

## 2. Flow direction

- Default **left → right** for data pipelines / request flows; **top → bottom** for tiered layering.
- Keep one consistent direction; avoid back-pointing arrows unless they represent feedback/sync (use dashed lines).

## 3. Group with official containers

Use real group shapes (`search_icon --kind group`) and nest them parent-child in the real order — see the nesting tree in your domain preset (e.g. `aws-architecture.md` "Containers").

## 4. Color — restrained & theme-aware

- Icons keep their official **category** color (hex table in the domain preset) — don't recolor icons arbitrarily.
- For **backgrounds/frames/notes**, use a **small cohesive palette** — a few neutral greys plus one or two soft accents. Do NOT scatter many ad-hoc pastel fills. Target ≤ ~8 distinct fill colors per diagram.
- **Pipeline/stage layers MAY carry a soft tint per stage** — the classic pale progression (light green → amber → yellow → purple) reads as ordered stages and looks good *when the tints are pale and cohesive*. That is desirable, not "rainbow". What to avoid is the **garish** look: saturated/clashing fills, a different colour on every small box, or colour with no meaning. For non-stage containers (Region/VPC/account), neutral grey or the AWS group stencil's own light fill is safest — let the service icons carry most of the colour.
- Prefer theme-aware tokens like `fillColor=light-dark(#fbe7d4, #3a2a16)` for backgrounds/accents so the diagram looks right in **both light and dark mode**.
- Reserve strong color for emphasis/notes (e.g. a red `#f8cecc` note box), not for every box.

## 5. Labels & typography

- Service labels kept short: service name + (role).
- **Limit to 3–4 font sizes** and keep label text **≤ 14px**; never jump to oversized (18+) titles inside the canvas — put a title in its own area.
- Long notes/constraints go in a separate **note box**, never crammed into the icon label.

## 6. Edges — meaning is *intentional*

The builder applies the edge style, corner rounding by role, connection-point pinning, and label waypoints automatically — your calls are the *role* and the *line semantics*:

- **Solid** = primary data/control flow; **dashed** = sync/dependency/policy enforcement/lineage. Color edges by source layer to trace them.
- Double-headed arrows for bidirectional links (Direct Connect, metadata sync).
- In **dense / error-handling diagrams add deliberate waypoints** to avoid line crossings and overlaps — don't rely purely on auto-route there.

## 7. Managed vs self-managed

- **Managed** cloud services: use the official icon + (optional) a "▸ managed" label.
- Third-party/OSS components (no official icon) → rounded box clearly noting "(on EKS)"/"(on EC2)", placed next to the compute icon it runs on.

## 8. Recommended overall layout

Left: **sources/clients**. Center: the **cloud frame** holding the pipeline. Right: **consumer systems**. Cross-cutting layers (security, monitoring, governance, CI/CD) as their own band/column with dashed links to the components they touch.

## 9. Self-check

Run `validate_diagram`; clear ALL `errors`, `warnings`, and `audit.advice` before delivering.
