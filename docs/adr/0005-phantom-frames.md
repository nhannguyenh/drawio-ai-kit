---
status: accepted
---

# ADR 0005: Phantom frames

## Context

The kit used one `frame()` primitive for two distinct jobs: **visible
containers** that mean something in the topology (VPC, Region, Account) and
**invisible layout-only wrappers** (`stroke:"none"`) that exist purely to
compute geometry. Both emit real `<mxCell>` cells that become parents in the
mxGraph tree, producing deeply nested "hidden layers" tightly coupled and hard
to reason about. Forensic check: 0 occurrences of an edge attaching to an
invisible frame — the wrappers are pure geometry, never topology targets.

## Decision

Make the invisible-wrapper concept an explicit `phantom()` primitive distinct
from visible `frame()`/`group()`. A phantom returns a distinct node kind that:

- emits **no** `<mxCell>`;
- is absent from the Diagram rect map, so `link()` to a phantom throws (with a
  teaching message: "target a visible frame or leaf instead");
- reparents its children to the nearest visible ancestor during emit.

`frame()` and `group()` are visible containers; `phantom()` is the legible
spelling for invisible wrappers. The legacy `frame(..., { stroke: "none" })`
spelling still works in code today (it is not yet rejected) — rejecting it is a
follow-up cleanup once all call sites have migrated to `phantom()`. The examples
have already migrated; `stroke: "none"` survives only as a deprecated escape
hatch, not the intended API.

## Consequences

- The mxGraph tree contains only meaningful layers; topology nesting
  (Region→VPC→AZ→Subnet) is preserved without wrapper noise.
- Arrows can't silently lie about topology — a build error forces visible/leaf
  targets.
- Examples need migration: `frame(..., stroke:"none")` → `phantom()`.

## Alternatives considered

- **Keep `stroke:"none"` as the invisible mechanism.** Rejected: intent is
  hidden behind a secret flag — a reader can't tell a topology container from a
  geometry wrapper.
- **Silently coerce a phantom-edge target to a child.** Rejected: lets arrows
  lie about topology; the build error is the point.
