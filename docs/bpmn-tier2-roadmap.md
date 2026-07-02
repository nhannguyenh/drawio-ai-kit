# BPMN Tier-2 Roadmap — Deferred Elements

**Status:** Deferred / future work
**Purpose:** Pick up and implement these BPMN elements after Tier-1 ships.

---

## Context

Tier-1 ships events (start/end/intermediate), activities (task/user task/service task/sub-process), gateways (XOR/AND/OR/event-based), sequence flow, message flow, and containers (pool/lane/phase). This document covers everything deliberately deferred: each was excluded because it either adds layout complexity the Kit does not yet support (parent-relative attachment, choreography lifelines) or models a BPMN pattern rare enough to skip for an initial cut.

---

## Tier-2 Element Catalog

### 1. Data Objects & Data Stores

**Semantics:** A data object represents a document or piece of data consumed or produced by an activity; a data store represents a persistent repository (database, file system) accessible across the process.

**Visual:** Data object = a folded-corner document shape (upper-right dog-ear); data store = a cylinder (database can icon). Both carry a name label inside. Connected to activities via thin solid association lines (not sequence flow arrows).

**Proposed Kit mapping:**
- Data object → `d.box(id, [x,y], [w,h], label, { ...opts })` with a custom `style` string using `shape=document` (draw.io built-in document shape with the folded corner). The `box()` method emits `mxCell` with `style=rounded=...;whiteSpace=wrap;...` — the deferred work is to introduce a new builder helper (e.g. `dataObject(id, ...)`) that substitutes the `shape=document;whiteSpace=wrap;...` style instead of the default `rounded=` rectangle. Alternatively, use `_put` directly with the correct style.
- Data store → `d.box(id, ...)` with `shape=cylinder3` or `shape=cylinder` in the style string. Same pattern: new helper or raw `_put` call.
- Association edge → `d.link(src, tgt, label, { dash: true })` with a thin stroke. The existing `dash: true` option emits `dashed=1` in the edge style. No arrowhead differentiation needed for a first pass (BPMN associations are open arrowheads, but solid lines are close enough for readability).

**Why Tier-2:** Data objects/stores rarely appear in the high-level process maps the Kit targets first. They matter for executable BPMN and detailed data-flow diagrams, which are a later use case.

**Hard bits:** The document/cylinder shapes are not in the AWS catalog. The Kit's `box()` hardcodes `rounded=0;whiteSpace=wrap;html=1;...` in its style template. Either add a `shape` option to `box()` (one line) or create thin wrappers. Validation (`RE_SHAPE`) currently only knows `mxgraph.aws4.*` — it will need to also accept `shape=document` / `shape=cylinder3` or these will flag as unknown shapes in strict mode.

---

### 2. Text Annotations & Annotation Associations

**Semantics:** A text annotation adds a free-form note to any diagram element without affecting process execution. The annotation association (dotted line) links the note to the element it describes.

**Visual:** A text annotation = a small rectangle with a folded top-right corner (like a sticky note) containing text. The association = a thin dotted line from the annotation to its target element.

**Proposed Kit mapping:**
- Annotation box → `d.box(id, [x,y], [w,h], label, { fill: THEME.note, stroke: THEME.noteStroke, round: false })`. The `note` / `noteStroke` tokens already exist in `THEME` and are the right color for callouts. Shape-wise this is just a plain rectangle (the folded-corner is cosmetic; a simple box with the note theme color communicates the intent). For fidelity, `shape=note` is a draw.io built-in that adds the fold.
- Association → `d.link(src, tgt, "", { dash: true })`.

**Why Tier-2:** Annotations are metadata, not process logic. They're useful for human readability but don't change the executable model.

**Hard bits:** Trivial to implement. The only question is whether to use `shape=note` for the fold or keep it as a themed rectangle. No layout changes needed.

---

### 3. Boundary Events

**Semantics:** A boundary event is attached to the border of an activity (task or sub-process) and models something that can happen while that activity is active — an interrupting error, a timeout timer, or an incoming message.

**Visual:** A small circle (solid or dashed border depending on interrupting vs. non-interrupting) pinned to the edge of a parent activity rectangle. Contains an inner marker (clock for timer, envelope for message, lightning bolt for error). An outgoing sequence flow connects the boundary event to whatever handles it.

**Proposed Kit mapping:**
- The boundary event circle → `d._put(id, parentActivityId, x, y, 24, 24, style, label)` directly (bypassing `box()` to get an ellipse shape `ellipse;...`). Tier-1 already requires ellipse primitives for start/end events, so the shape style is established.
- The challenge is *pinning* the circle to the parent activity's border. Today `_put` places cells at absolute coordinates offset from their parent; it has no concept of "pin to parent's top edge" or "pin to parent's right edge." The implementer must either:
  1. Compute the boundary event's (x, y) from the parent activity's known geometry (`d.R[parentActivityId]`) at emit time, or
  2. Extend the layout engine to support a `pin: "top" | "right" | "bottom" | "left"` property on nodes, where `place()` computes the offset from the parent's border rather than from the parent's inner content area.

**Why Tier-2:** Boundary events break the Kit's current layout model, which assumes all children live *inside* a parent container at inner-content coordinates. A boundary event lives *on the border* — a fundamentally different attachment semantics.

**Hard bits:**
- **Parent-relative border pinning.** The layout engine's `place()` function (layout-engine.mjs:105-136) assigns children to inner content coordinates (`innerX + pad`, `innerTop + header + pad`). Boundary events need to sit on the parent rectangle's edge itself (e.g. `parentX + parentW - 12, parentY + parentH / 2 - 12` for right-edge). This requires a new placement mode — not just a new node kind.
- **Non-interrupting vs. interrupting.** The visual difference (dashed vs. solid circle border) is easy in the style string, but the semantic distinction affects edge routing: a non-interrupting boundary event's outgoing flow should be visually subordinate (thinner or lighter).
- **Multiple boundary events on one activity.** The layout must distribute them along the border without overlap.

---

### 4. Event Sub-Process

**Semantics:** An event sub-process is a sub-process embedded within a parent activity that is triggered by a start event (not by a sequence flow). It can be interrupting (cancels the parent activity) or non-interrupting (runs in parallel).

**Visual:** A dashed rounded rectangle containing a start event (timer/error/signal/etc.) and its own flow. It is drawn inside or overlapping the parent activity's boundary — visually distinct from a normal sub-process by the dashed border.

**Proposed Kit mapping:**
- The dashed sub-process frame → `d.box(id, [x,y], [w,h], label, { dash: true, round: true, fill: "none", stroke: ... })` placed inside the parent activity. The Kit's `box()` currently has no `dash` option for vertices (edges have it). Adding `dashed=1` to the vertex style string is a one-line change, or use `_put` directly.
- The start event inside it → standard Tier-1 start event primitive.
- Flows inside the event sub-process → standard `d.link()` calls.

**Why Tier-2:** Event sub-processes combine the complexity of sub-processes with boundary-event semantics (interrupting vs. non-interrupting). They are relatively rare in high-level process maps.

**Hard bits:**
- **Vertex dashed borders.** The Kit's `box()` does not support `dashed=1` in vertex styles. Either add a `dash` option or use `_put`.
- **Nested placement.** The event sub-process must be sized and positioned relative to its parent activity, but it contains its own internal flow. This is conceptually similar to the existing `group()` nesting, but with the added constraint of the dashed border semantics.
- **Interrupting semantics.** The visual distinction (dashed = non-interrupting, solid = interrupting) must be tracked as metadata for the downstream consumer, even if the Kit only draws the picture.

---

### 5. Transaction & Compensation

**Semantics:** A transaction is a special sub-process that uses a compensation protocol: if any activity within it fails, all completed activities are compensated (undone) via compensation handlers. A compensation activity is a task that performs the undo operation.

**Visual:**
- Transaction = a rounded rectangle with a **double-line border** (draw.io style: `double=1` in the stroke). Contains activities, gateways, and flows as normal.
- Compensation handler = a task with a **circular-arrow marker** (the compensation symbol, a counter-clockwise arrow forming a circle) in the bottom-center of the task rectangle. Connected to the compensating activity via a dashed arrow with a circular-arrow end marker.

**Proposed Kit mapping:**
- Transaction frame → `d.box(id, [x,y], [w,h], label, { round: true })` with `double=1;` appended to the style string. The `box()` method would need a `double` option, or use `_put` directly.
- Compensation task marker → A small icon or styled element placed at the bottom-center of the task box. Could be a `d.icon(id, name, ...)` using a custom BPMN stencil, or a `_put` call with a `shape=mxgraph.bpmn...` style if the stencil decision (see Open Questions) lands on using mxgraph BPMN shapes.
- Compensation flow → `d.link(src, tgt, "", { dash: true })` with a custom end-arrow style (`endArrow=...`).

**Why Tier-2:** Transactions and compensation are advanced BPMN patterns used in financial, booking, and order-management workflows. They are uncommon in the general process diagrams the Kit targets first.

**Hard bits:**
- **Double-line border style.** Draw.io supports `double=1;doubleFixed=0` in vertex styles, but the Kit's `box()` has no path to emit it. Needs either a new option or raw `_put`.
- **Compensation marker placement.** The circular-arrow icon must be positioned relative to the task's bottom edge — again a border-pinning problem similar to boundary events.
- **Semantic correctness.** Compensation is a paired pattern (compensate activity A → compensation handler for A). Ensuring the Kit can express this pairing without a full BPMN engine is an open design question.

---

### 6. Call Activity

**Semantics:** A call activity invokes a reusable, named global process (defined at the diagram level) and waits for it to complete. It is visually similar to a task but with a thick border and a small marker indicating it is a call.

**Visual:** A rounded rectangle with a **thicker-than-normal border** (typically 2× stroke width). Some BPMN renderings add a small "+" or folded-corner icon in the bottom-center, but the thick border is the distinguishing feature.

**Proposed Kit mapping:**
- `d.box(id, [x,y], [w,h], label, { round: true, strokeWidth: 4 })`. The Kit's `box()` currently hardcodes stroke width at 1 in the style template (no explicit `strokeWidth` key). Adding a `sw` option to `box()` that emits `strokeWidth=N` is a small change.

**Why Tier-2:** Call activities require the concept of "global process references" — a named process defined elsewhere that the call activity invokes. The Kit currently has no mechanism for cross-diagram references or reusable sub-diagrams.

**Hard bits:**
- **Stroke width option.** Currently `box()` emits no `strokeWidth` key, so draw.io defaults to 1. Adding `sw: 4` or similar is trivial.
- **Cross-diagram references.** The Kit is single-diagram. A call activity pointing to another diagram would need a new concept (a `callProcess` node that stores the target process name as metadata).
- **Expand/collapse.** Call activities can be collapsed (showing just the thick-bordered box) or expanded (showing the internal process flow inline). The collapsed form is easy; expanded requires nesting a sub-process inside the call activity box.

---

### 7. Additional Event Markers

Tier-1 covers none/message/timer events for start, end, and intermediate positions. Tier-2 adds the remaining BPMN 2.0 event marker types:

| Marker | Catch/Throw | Inner Symbol | Typical Use |
|--------|-------------|-------------|-------------|
| **Escalation** | Both | Upward arrow (↑) | Escalate from sub-process to parent |
| **Conditional** | Catch only | Diamond/hexagon | Wait for a condition to become true |
| **Signal** | Both | Triangle (similar to message, but broadcast) | Broadcast event to all listeners |
| **Link** | Both | Circle-with-arrow (→) | Off-page connector, goto-like |
| **Cancel** | End only | X (bold) | Cancel a transaction |
| **Multiple** | Both | Pentagon (5-point star) | Multiple triggers; any one fires |
| **Parallel Multiple** | Catch only | Pentagon with "+" inside | Wait for ALL triggers simultaneously |

**Proposed Kit mapping:** All event markers share the same circle shape from Tier-1. Each adds a different inner symbol. Implementation is identical to Tier-1 events: `d._put(id, parent, x, y, 30, 30, "ellipse;...", label)` with the appropriate inner icon drawn as an additional child cell or encoded in the style string (e.g. `bpmnSymbol=event_escalation`). The exact mechanism depends on the stencil decision (see Open Questions).

**Why Tier-2:** These markers are individually rare. Signal and escalation are the most useful; cancel and parallel-multiple are niche.

**Hard bits:**
- **Inner symbol rendering.** If using `mxgraph.bpmn.*` stencils, each marker has a built-in shape that draws the inner symbol automatically. If hand-rolling from geometric primitives, each inner symbol needs its own style recipe (trickier for pentagons and nested "+" symbols).
- **Signal vs. message visual distinction.** Signal and message events look similar (both use envelope-like shapes). The Kit must maintain a clear visual distinction (signal = triangle with broadcast rays, message = envelope).

---

### 8. Collaboration vs. Choreography

**Semantics:** A **collaboration** diagram shows two or more independent participants (pools) exchanging messages — the pools interact but each maintains its own internal process. A **choreography** diagram shows the message exchange *between* participants as the primary focus, with no internal process detail — each message is drawn as a choreography task connecting two participant bands.

**Visual:**
- **Collaboration:** Multiple pools side by side (already in Tier-1). Message flows (dashed arrows) between them. The internal flow within each pool is normal sequence flow.
- **Choreography:** Two vertical **participant bands** (lifeline-style columns, similar to UML sequence diagrams) with **choreography tasks** drawn as rounded rectangles *between* the bands. Each choreography task has an envelope icon on the initiating side and a smaller envelope on the receiving side. A sequence arrow below the task goes to the next choreography task.

**Proposed Kit mapping:**
- Collaboration is effectively Tier-1 (pools + message flow). No additional Kit work.
- Choreography participant bands → `d.box(id, [x,y], [w,h], label, { fill: "none", stroke: ... })` as tall vertical rectangles. This is already achievable with existing primitives.
- Choreography task → `d.box(id, [x,y], [w,h], label, { round: true })` positioned between two participant bands. Requires computing the horizontal span between the two bands — doable with `d.R[]`.
- Envelope markers on the choreography task → Small icons (`d.icon()` or `_put`) at the left and right edges of the task box. This is a border-pinning problem (similar to boundary events), but for a *horizontal* span rather than a single edge.

**Why Tier-2:** Choreography is a fundamentally different diagram topology. The Kit's layout engine operates on nested groups/rows/columns — it has no concept of "tasks spanning between two independent vertical bands." The entire layout model would need a new axis.

**Hard bits:**
- **Spanning layout.** Choreography tasks must be horizontally centered between two participant bands. The layout engine would need a concept of "span between sibling nodes" that is not parent-child containment. `spanV` exists for vertical spanning but it uses absolute lane/between references, not a declarative layout-tree node.
- **Lifeline-style participant bands.** These are tall, narrow columns with the participant name at the top — conceptually different from pools (which are wide containers). The Kit has no "vertical lifeline" primitive.
- **Low demand.** Choreography diagrams are uncommon in most enterprise process modeling. Collaboration (pools + message flow) covers the vast majority of multi-participant scenarios.

---

## Cross-Cutting Implementation Notes

### New Shape Primitives

| Need | Current State | Change Required |
|------|--------------|-----------------|
| Ellipse | Not in `box()` style | Tier-1 already adds this (events). Reuse for boundary events and additional markers. |
| Document shape (folded corner) | Not in `box()` style | Add `shape=document` to style template or create `dataObject()` helper. |
| Cylinder shape | Not in `box()` style | Add `shape=cylinder3` to style template or create `dataStore()` helper. |
| Dashed vertex border | `box()` has no `dash` option for vertices | Add `dashed=1` to vertex style when `dash: true` is passed. One-line change in `box()`. |
| Double-line border | Not supported | Add `double=1;doubleFixed=0` to vertex style. New option on `box()`. |
| Variable stroke width | `box()` emits no `strokeWidth` | Add `sw` (strokeWidth) option to `box()`. |
| Compensation marker (circular arrow) | No stencil in AWS catalog | New BPMN stencil asset or hand-rolled style. |
| Choreography task (envelope on both sides) | No stencil | New stencil or compound shape (task box + two envelope icons). |

### Validation Changes

- `RE_SHAPE` in `core.mjs:133` matches only `shape=mxgraph.aws4.*`. BPMN shapes (`shape=document`, `shape=cylinder3`, `shape=ellipse`, `shape=mxgraph.bpmn.*`) must be added to the validation whitelist or `validateDiagram` will report unknown shapes in strict mode.
- `RE_GRICON` similarly matches only `mxgraph.aws4.*`. If BPMN uses group-level icons, these need whitelisting.
- `isContainer` / `isVertex` heuristics in `validateDiagram` (core.mjs:153-225) are AWS-specific. BPMN introduces its own containment hierarchy (process → sub-process → tasks → boundary events). The validator needs a parallel set of heuristics or a configurable containment model.

### Theme Tokens

The existing `THEME` tokens in `theme.mjs` cover most BPMN needs out of the box:
- `THEME.note` / `THEME.noteStroke` — annotations.
- `THEME.base` / `THEME.baseStroke` — tasks, data objects.
- `THEME.edge.stroke` / `THEME.edge.dash` — sequence and message flow.

BPMN-specific additions to consider:
- Event colors (timer = amber, error = red, message = blue, signal = green) — not in the current theme. These could be constants in the BPMN skill rather than Kit-wide theme tokens.
- Pool/lane fill/stroke — may reuse `THEME.base` / `THEME.baseStroke` or need distinct tokens for the pool header.

### Catalog Stencils

BPMN does not use AWS stencils. The Kit currently loads from `catalog/aws.json` exclusively (`DEFAULT_CATALOG`). BPMN shapes need either:
1. A new `catalog/bpmn.json` with BPMN-specific shapes (following the same index format), or
2. Direct style strings in the builder without catalog lookup (simpler for the ~20 BPMN shapes).

This decision cascades into `loadCatalog`, `styleForIcon`, and `validateDiagram`.

### Layout Engine Changes

| Change | Affected Function | Scope |
|--------|-------------------|-------|
| Border pinning (boundary events, compensation markers, choreography envelopes) | `place()` in layout-engine.mjs | New placement mode: child positioned on parent border instead of inner content. |
| Dashed vertex borders | `emit()` in layout-engine.mjs (passes through to `d.box()`) | Pass `dash` option through to builder. |
| Choreography spanning | No existing support | New node kind or `spanH` counterpart to `spanV` that spans horizontally between two bands. |
| Event sub-process inside activity | Existing `group()` nesting works | The event sub-process is a dashed group inside an activity box — `emit()` can already do this if the box is treated as a container. |

---

## Suggested Implementation Order

1. **Data Objects & Data Stores** — Simplest: new `shape` style option on `box()`. No layout changes. Useful in data-flow-heavy process maps. Validation whitelist update.

2. **Text Annotations** — Trivial: themed `box()` + dotted `link()`. Zero layout impact.

3. **Boundary Events** — Forces the border-pinning layout change. Once that mechanism exists, compensation markers and choreography envelope pinning become easier. High value: boundary events are the most-missed Tier-2 element in real process diagrams.

4. **Additional Event Markers** — Pure visual: new inner symbols on existing ellipse shape. Depends on the stencil decision but no layout changes. Can be done incrementally (escalation/signal first, the rest as needed).

5. **Event Sub-Process** — Requires dashed vertex borders (small change to `box()`) plus nesting inside an activity. Builds on boundary-event layout work.

6. **Call Activity** — Simple visual (thick border) but introduces cross-diagram references. Low layout complexity.

7. **Transaction & Compensation** — Combines double borders, compensation markers (border pinning), and paired-handler semantics. Higher complexity, lower demand.

8. **Choreography** — Largest layout change (spanning between bands, lifeline columns). Lowest demand. Defer until choreography is explicitly requested.

---

## Open Questions

1. **Stencil strategy — `mxgraph.bpmn.*` or hand-rolled?** Tier-1 events will make this decision first (do we adopt draw.io's built-in `mxgraph.bpmn` stencil family or construct event shapes from primitive styles like `ellipse;fontIcon=...;`). The outcome cascades here: if Tier-1 goes mxgraph.bpmn, then data objects/compensation markers/choreography tasks should too; if Tier-1 hand-rolls, consistency demands the same here. The implementer must check the Tier-1 outcome before starting.

2. **Border pinning API design.** Boundary events need a `pin: "top"|"right"|"bottom"|"left"` property (or equivalent). This could live on the layout-engine tree node (`{ kind: "boundaryEvent", pin: "right", parentActivity: "task_1" }`) or be computed at emit time from absolute geometry. The latter is simpler but loses re-layout capability. The former is correct but requires changes to `measure()`, `place()`, and `emit()`.

3. **BPMN-specific diagram type.** Should BPMN diagrams get their own entry in `DIAGRAM_TYPES` (types.mjs)? BPMN has a distinct orientation convention (top-to-bottom for process flow within a pool, left-to-right for message flow between pools) that doesn't map cleanly to any existing type. A `bpmn` type preset with `orientation: "TB"`, `edgeCorner: "rounded"`, and a new `laneStrategy` (e.g. `"bpmn-lanes"`) would clarify the routing intent.

4. **Validation scope for BPMN.** The Kit's `validateDiagram()` is AWS-specific (nesting rules, stencil checks, aesthetics). BPMN diagrams need a separate validation pass (e.g. "sequence flow must not cross pool boundaries," "gateways must have at least 2 outgoing flows"). Is this a new `validateBpmn()` function, or is `validateDiagram` extended with a configurable ruleset?

5. **Multi-diagram / global process references.** Call activities and link events reference named processes defined elsewhere. The Kit is currently single-diagram. If multi-diagram support is out of scope, call activities and link events should be limited to collapsed visual-only representations with the target process name as a label.

6. **Choreography spanning mechanism.** If `spanV` is the precedent, should there be a `spanH(id, { w, label }, { band: "left", between: ["right"] })` that computes horizontal geometry between two vertical bands? Or is choreography rare enough to hand-compute coordinates at the call site?
