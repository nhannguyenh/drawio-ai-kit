# Diagram types — layout & routing presets

Different diagram types need different layout and **edge routing**, not one strategy for all. Pick the type first, then apply its preset (`src/types.mjs` → `typePreset(name)`); the routing helpers in `src/layout.mjs` do the geometry.

## Pick the type

| User intent | Type key |
|---|---|
| Data/request pipeline, ETL, request-response across tiers | `pipeline` |
| Org structure, Landing Zone, account/OU hierarchy | `hierarchy` |
| VPC / network topology, Multi-AZ deployment, 3-tier in a VPC | `network` |
| Event-driven, message bus, fan-in/fan-out around a hub | `hubspoke` |
| Hybrid / disaster recovery (on-prem ↔ cloud, two sites) | `hybrid` |
| Multi-account connectivity / service mesh (VPC Lattice, TGW, peering, RAM share) | `mesh` |
| Numbered request walkthrough over an architecture | `sequence` |

## Frames are square — AWS convention

AWS architecture diagrams use **square-corner** containers, not rounded frames. Use the official group stencils (`group_*`, already square) for Region/Account/VPC/AZ/Subnet, and keep resource boxes square too. The `Diagram` builder's `box()` defaults to square (pass `round:true` only when you deliberately want a rounded shape).

## Per-type layout & routing

### pipeline
- **Layout:** left → right, one column per tier (Ingest → Process → Store → Serve). Cross-cutting layers as a band below.
- **Routing:** put the connected "spine" nodes at the **same Y** so the main flow is straight horizontal. Bent edges use **two waypoints in the inter-column corridor** (`routeLR` with `laneX`). Fan-out from one source → **sharp** corners (`rounded=0`).

### hierarchy
- **Layout:** top → down. Parent (Management/Root) on top; children (OUs/accounts) nested below. Group by OU containers.
- **Routing:** **sharp** corners. All siblings of one parent exit the parent at its bottom-centre and share **one horizontal lane** just below the parent (a bus) before dropping to each child — `routeTB` with a shared `laneY`.

### network
- **Layout:** nest **Region → VPC → Availability Zone → Subnet → Security Group** with real parent-child containment. **Mirror the AZs** (stack them vertically). Tiers flow left → right inside each AZ: Public (NAT/IGW) → Private app → Private data.
- **Routing:** make the **load balancer a tall node spanning the AZs** so its edges to each AZ's app tier are straight horizontals. Edges between tiers are horizontal; go **vertical only to cross AZs** (e.g. RDS primary → standby). Cross-AZ replication / DR uses **dashed** lines. Regional/edge services (WAF, CloudWatch, S3) sit **outside the VPC** but inside the Region.

### hubspoke
- **Layout:** hub (bus/TGW/EventBridge/SNS) in the **centre** of the producer/consumer row.
- **Routing:** producers connect from one side (`exitX=1`), consumers from the other (`exitX=0`) with short horizontal edges → no crossings.

### hybrid
- **Layout:** two site blocks (on-prem, cloud) as separate frames.
- **Routing:** connect through a single **Direct Connect / VPN** node; mirror matching components on both sides; bidirectional links are **dashed double-headed**.

## Fan-out edges (1 source → many targets)

This is the #1 source of ugly diagrams. The kit handles it automatically: when one
source has **≥2 edges in the same direction**, all of them are routed as a **comb**
— a single shared trunk lane with one short branch per target — so the segments
merge into one clean line instead of overlapping/zig-zagging. You don't compute
lanes: just call `d.link(src, t1)`, `d.link(src, t2)`, … and the builder groups them.
Works on both axes (LR: hub→consumers; TB: management account→OUs, org-chart style).

Keep targets roughly **column-aligned** (same x for LR, same y for TB) so the comb
branches stay short and even — the layout engine's `frame`/`group` already does this.

## Validation hooks

`validate_diagram` enforces several of these regardless of type: unknown stencils, recolored icons, broken Region→…→SG nesting, off-centre labels on bent edges, and fan-out edges that should be sharp + pinned. Clear all `audit.advice` before delivering.
