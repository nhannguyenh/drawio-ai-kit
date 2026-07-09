---
status: accepted
---

# ADR 0003: Scaffold/Bake output contract split

## Context

When a human opens a kit-generated `.drawio` diagram in draw.io and moves an
element, connected arrows detach, kink, or pin to stale coordinates — defeating
the kit's "easy to pick up and edit later" north star. Forensic check against
generated XML: ~83% of emitted edges carry frozen absolute waypoints. The root
cause, verified against the draw.io mxGraph source, is that draw.io never
translates waypoints on a vertex drag — only the endpoint's own geometry moves,
so the route deforms the moment an element is moved. The kit's own code comment
already concedes this: *"Clear Waypoints in draw.io to re-flow after moving a
node."*

## Decision

Split the kit's output into two explicit contracts with the draw.io editor,
selected per-render (not a property of the diagram):

- **Scaffold (default)** — edges carry only their pinned connection sides
  (`exitX`/`exitY`/`entryX`/`entryY` fractions) + `edgeStyle=orthogonalEdgeStyle`,
  and omit the `<Array as="points">` block entirely. draw.io recomputes the
  orthogonal route from terminal bounds on every edit; a moved element never
  needs re-linking.
- **Bake (opt-in)** — a full collision-free, nudged, deterministic route is
  frozen into the XML as absolute `mxPoint` waypoints. Polished for final PNG/PDF
  export; deforms if edited. Selected at *diagram build* time via
  `new Diagram(type, { contract: "bake" })`; the waypoints are then baked into
  the `.drawio`/`.xml` before `drawio-ai render` ever runs.

The kit's `_buildEdges()` router still runs in *both* modes: its `face()`/
`decollide()` pin-selection output feeds scaffold (the pins); its full geometry
feeds bake (the waypoints).

This rests on an irreducible constraint (from the mxGraph source): a
pre-computed route and a drag-resilient route are different contracts. A route
either freezes on drag (bake) or is discarded on drag (scaffold). There is no
third option.

## Consequences

- Scaffold serves the north-star default; bake preserves presentation polish.
- Breaking change — the default flips from bake to scaffold.
- Scaffold route quality is capped by draw.io's native engine. Accepted; polish
  is reserved for bake. (Empirically verified during design: the densest
  examples rendered with waypoints stripped did not catastrophically break route
  quality — the bet that "draw.io-native + kit pins is acceptable as the
  default" holds at moderate confidence.)

## Alternatives considered

- **A "smart scaffold" that re-freezes waypoints on drag.** Rejected:
  architecturally impossible without reintroducing waypoints — draw.io owns
  drag-time routing, and any frozen route deforms on drag by the mxGraph
  constraint above.
