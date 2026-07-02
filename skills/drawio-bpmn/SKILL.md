---
name: drawio-bpmn
version: 0.1.0
description: Use when the user asks for a BPMN diagram, swimlane diagram, business process map, or workflow diagram with roles/lanes and phases. Builds the diagram with the declarative layout engine using canonical mxgraph.bpmn stencils (events, gateways, typed tasks) in horizontal swimlanes (pool → lanes × phases), validates it (BPMN semantic rules — gateway split/merge, start/end event flow, orphan nodes — plus geometry), and runs a render-based vision self-check before delivering. Default output is the .drawio file. Shares the drawio-ai-kit engine with drawio-cloud-architect; pass {mode:'bpmn'} to get_principles for the BPMN rule set.
license: MIT
---

# Draw.io BPMN

Produce **correct and beautiful** BPMN (Business Process Model and Notation) swimlane diagrams in draw.io. This skill is the workflow layer; the deterministic tools live in the shared `drawio-ai-kit` engine (`src/bpmn.mjs` creators + `src/layout-engine.mjs` `pool()` primitive, and the `drawio-ai-kit` MCP server).

## Tools available (MCP `drawio-ai-kit`)

| Tool | Use |
|---|---|
| `get_principles` | **Pass `{mode:"bpmn"}`** → BPMN swimlane rules + the shared layout principles + catalog shape groups. Call once at the start. |
| `validate_diagram` | Lint: unknown stencils, dangling edges, geometry (overlap/spill), aesthetic advice, **and BPMN semantic rules** — a gateway that neither splits (≥2 outgoing) nor merges (≥2 incoming); a start event with incoming flow; an end event with outgoing flow; orphan nodes. |
| `render_diagram` | Render the XML to PNG and return the image — your built-in **vision self-check**. Look at it and fix before delivering. |
| `get_icon_style` | Full style for a known BPMN stencil name (e.g. `bpmn_start_timer`, `bpmn_task_user`). |
| `search_icon` | Resolve a BPMN shape by keyword (e.g. `bpmn gateway`, `bpmn end error`). |

If the MCP server isn't registered, call the same logic via `node <ABS_KIT>/src/cli.mjs <search|validate|principles>`.

## Delegate the mechanical steps (where your CLI supports it)

The tool calls are deterministic — no reasoning, only legwork. What actually costs you is their *output* cluttering this context (catalog shape lists, rule text, validation advice). Wherever your CLI offers a subagent / sub-task / background worker (Claude Code Tasks, Oh My Pi agents, or equivalent), offload the mechanical loop to it and reserve this context for judgment.

- **Delegate (legwork):** `search_icon` / `get_icon_style` gathering, `get_principles({mode:"bpmn"})` fetch, the `validate_diagram` ↔ fix loop, `render_diagram`.
- **Keep here (judgment):** lane/phase structure, gateway split/merge placement, flow ordering, ambiguous icon choice.

Ask the subagent to report a compressed result ("stencils + styles resolved", "`ok:true`, 0 advice", "rendered, no overlaps") — not the raw dumps. No subagent in your CLI? Run the steps inline — same correctness, just more context spent.

## Element vocabulary (Tier-1) — canonical mxgraph.bpmn stencils

Use the creators in `src/bpmn.mjs` — each looks up its canonical `mxgraph.bpmn` stencil from `catalog/bpmn.json` (monochrome; **red accent only for blocker end events** — error/cancel/terminate). Do NOT hand-draw events/gateways as circles/diamonds.

```js
import { Diagram } from "<ABS_KIT>/src/builder.mjs";
import { renderTree } from "<ABS_KIT>/src/layout-engine.mjs";
import { pool, start, intermediate, end, gateway, userTask, serviceTask, manualTask, scriptTask, businessRuleTask, task, subProcess } from "<ABS_KIT>/src/bpmn.mjs";
```

| Creator | BPMN element | Notes |
|---|---|---|
| `start(id, {lane,col,label,type})` | Start event | `type`: `"none"` (default) \| `"message"` \| `"timer"` |
| `intermediate(id, {...})` | Intermediate event | `type`: `"message"` \| `"timer"` \| `"link"` |
| `end(id, {...})` | End event | `type`: `"none"` \| `"terminate"` \| `"error"` \| `"cancel"` (last 3 render red) |
| `gateway(id, {...})` | Gateway | `type`: `"exclusive"` (XOR) \| `"parallel"` (AND) \| `"inclusive"` (OR) \| `"event"` |
| `userTask` / `serviceTask` / `manualTask` / `scriptTask` / `businessRuleTask` | Typed task | each carries its BPMN marker |
| `task(id, {lane,col,label})` | Plain (untyped) task | marker-less rounded rectangle (canonical) |
| `subProcess(id, {...})` | Collapsed sub-process | rounded rectangle (distinguish from a Task by labelling) |

## Layout — the `pool()` swimlane primitive

Build with the declarative engine — **do NOT hand-place coordinates**. Declare a pool with lanes (roles) and optional phases (milestones); each node carries `{ lane, col }` cell tags (`lane` = role row, `col` = horizontal slot, one node per cell). The engine measures, places, and emits lane bands + labels automatically.

```js
const d = new Diagram("bpmn");                       // bpmn type preset: LR, rounded edges, swimlane strategy
const proc = pool("order", "Order Management", {
  lanes:  ["Customer", "Sales", "Warehouse"],        // role rows (top → bottom)
  phases: ["Intake", "Review", "Fulfill"],           // OPTIONAL milestone header bands (even share of columns)
}, [
  start("s1",  { lane: 0, col: 0, label: "Order received" }),
  userTask("t1", { lane: 0, col: 1, label: "Place order" }),
  userTask("t2", { lane: 1, col: 2, label: "Review order" }),
  gateway("g1", { lane: 1, col: 3, label: "Approved?" }),
  serviceTask("t3", { lane: 1, col: 4, label: "Charge card" }),
  end("e2", { lane: 1, col: 5, label: "Rejected", type: "error" }),
  serviceTask("t4", { lane: 2, col: 5, label: "Ship order" }),
  end("e1", { lane: 2, col: 6, label: "Delivered" }),
]);
renderTree(d, proc, [40, 80]);

// sequence flow — solid, rounded (BPMN convention). Handoffs cross lane bands freely.
d.link("s1", "t1", "submit", { flow: true, rounded: true });
d.link("t1", "t2", "placed", { flow: true, rounded: true });   // Customer → Sales handoff
d.link("t2", "g1", "", { flow: true, rounded: true });
d.link("g1", "t3", "yes", { flow: true, rounded: true });
d.link("g1", "e2", "no", { rounded: true });
d.link("t3", "t4", "fulfill", { flow: true, rounded: true });
d.link("t4", "e1", "", { flow: true, rounded: true });
```

Rules of thumb:
- **One start event** top-left of the pool; **end events** on the right (one happy path + one per exception branch).
- A **gateway splits** (≥2 outgoing) or **merges** (≥2 incoming) — never neither.
- **Sequence flow stays within a pool** (solid). Message flow between pools is dashed — Tier-2 (see `docs/bpmn-tier2-roadmap.md`).
- Horizontal by default; pass `orientation: "vertical"` to `pool()` for vertical swimlanes.
- Lane bands and the pool frame are crossable by edges (the engine marks them non-obstacles) — so handoffs route cleanly across lanes.

## Where to write — NEVER into the kit folder

The kit is **READ-ONLY**. Write the user's diagram to an **absolute path under their project directory** (never `process.cwd()`, never the kit's `examples/`/`out/`/`src/`). Resolve `<ABS_KIT>` from the MCP server path or `~/.agents/skills/drawio-bpmn`. See `examples/bpmn/build_bpmn.mjs` for a complete reference template (read-only).

```js
const PROJECT = "/abs/path/to/the/users/project";   // confirm with the user — never the kit, never cwd
writeFileSync(`${PROJECT}/order-process.drawio`, d.mxfile("Order management (BPMN)"));
```

## Workflow

1. **Clarify (if vague)** — the process, the roles (lanes), and the milestones (phases). Default deliverable is the `.drawio` file only.
2. **Read the rules** — `get_principles({mode:"bpmn"})` once. Follow `rules/bpmn.md` (element vocabulary, layout, colour, validation contract).
3. **Plan FIRST** — list the roles (→ lanes), the milestones (→ phases), and the steps in flow order with their `(lane, col)` cells so each node occupies a distinct column. Identify the gateway split/merge points and the end events (incl. exceptions).
4. **Build with the engine** — `pool()` + the `src/bpmn.mjs` creators; `renderTree` computes layout. Add sequence-flow edges with `{ flow:true, rounded:true }`. Write the `.drawio` to the user's project dir, NEVER the kit.
5. **Validate** — `validate_diagram`. Clear all `errors`, then resolve `warnings` and every `audit.advice` item, especially the **BPMN semantic rules** (gateway split/merge, start/end flow, orphans). Re-validate until clean.
6. **Render + vision self-check** — `render_diagram` to LOOK at the result. Fix lop-sided lanes, clipped event labels, edges crossing unrelated shapes, mis-ordered flow. Re-render. Max ~2 rounds.
7. **Deliver the `.drawio`** (default). PNG/SVG only if the user asks.

## Self-check checklist (before delivering)

- [ ] Built with `pool()` + BPMN creators — no hand-drawn circles/diamonds, no hand-written coordinates.
- [ ] `validate_diagram` → `ok: true`, no warnings, `audit.advice` empty (incl. BPMN semantics: every gateway splits or merges; no orphan node).
- [ ] Lanes = roles, phases = milestones; one start event (no incoming), end events on the right (no outgoing).
- [ ] Red used ONLY for blocker end events (error/cancel/terminate).
- [ ] `render_diagram` vision self-check passed (no overlaps / clipped labels / crossing edges / mis-ordered flow).
