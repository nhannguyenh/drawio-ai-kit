// drawio-ai-kit — Diagram builder. Bundles all boilerplate: icon/box/group/panel/link
// + auto-routing by type + auto-size panel + validate + XML export. Goal: build
// a diagram with just a few lines of declaration (easy to use, easy to extend).
import { loadCatalog, styleForIcon, styleForGroup, validateDiagram } from "./core.mjs";
import { routeLR, routeTB, routeLRFan, routeTBFan, routeLRFanIn, routeTBFanIn, centerInBoxX, distributeY, centerInGapX, panelSize } from "./layout.mjs";
import { typePreset, edgeRounded } from "./types.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class Diagram {
  /** type: pipeline|hierarchy|network|hubspoke|hybrid|mesh|sequence */
  constructor(type = "pipeline", { title = "", page = [2000, 1200] } = {}) {
    this.c = loadCatalog();
    this.type = type;
    this.preset = typePreset(type);
    this.page = page;
    this.cells = [];
    this.R = {};
    this.eid = 0;
    this.edgeSpecs = [];        // edges recorded first, built later (to bundle fan-out 1→N)
    this._edgesBuilt = false;
    if (title) this.text("__title", [0, 24], page[0], title, { fs: 14 });
  }
  _put(id, parent, x, y, w, h, style, label) {
    this.R[id] = { x, y, w, h };
    const ox = parent === "1" ? 0 : this.R[parent].x, oy = parent === "1" ? 0 : this.R[parent].y;
    this.cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x - ox}" y="${y - oy}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    return this.R[id];
  }
  /** AWS icon by catalog name (verbatim style). [x,y] = top-left corner (48×48 icon). */
  icon(id, name, [x, y], { parent = "1", label = "" } = {}) {
    const s = styleForIcon(this.c, name);
    if (!s) throw new Error(`Icon not found in catalog: "${name}" — use search_icon to look up the correct name.`);
    return this._put(id, parent, x, y, 48, 48, s.style, label);
  }
  // Default SQUARE CORNERS — AWS diagrams rarely use rounded frames. (round:true if needed.)
  box(id, [x, y], [w, h], label = "", { parent = "1", fill = "#FFFFFF", stroke = "#5A6B7B", va = "middle", bold = false, fs = 11, round = false } = {}) {
    return this._put(id, parent, x, y, w, h, `rounded=${round ? 1 : 0};whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;fontSize=${fs};fontStyle=${bold ? 1 : 0};verticalAlign=${va};`, label);
  }
  /** AWS group container (group_aws_cloud_alt, group_region, group_vpc, group_account, ...). */
  group(id, gname, [x, y], [w, h], label = "", { parent = "1" } = {}) {
    const s = styleForGroup(this.c, gname);
    if (!s) throw new Error(`Group not found: "${gname}"`);
    return this._put(id, parent, x, y, w, h, s.style, label);
  }
  /** Title centered across the page width (call after the page size is known). */
  title(label, { fs = 14 } = {}) { this.text("__title", [0, 24], this.page[0], label, { fs }); return this; }
  text(id, [x, y], w, label, { fs = 14, parent = "1" } = {}) {
    const ox = parent === "1" ? 0 : this.R[parent].x, oy = parent === "1" ? 0 : this.R[parent].y;
    this.R[id] = { x, y, w, h: 30 };
    this.cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="${parent}"><mxGeometry x="${x - ox}" y="${y - oy}" width="${w}" height="30" as="geometry"/></mxCell>`);
  }
  /**
   * Panel that AUTO-SIZES to the icon count: draws a snug box, icons centered in columns + evenly distributed.
   * items = [[iconName, label], ...]. Returns the panel's rect.
   */
  panel(id, [x, y], title, items, { parent = "1", cols = 1, fill = "#F5F5F5", stroke = "#999999", itemW = 130, itemH = 84 } = {}) {
    const { w, h } = panelSize(items.length, { cols, itemW, itemH });
    this.box(id, [x, y], [w, h], title, { parent, fill, stroke, va: "top", bold: true });
    const pad = 20, header = 34, gap = 18;
    items.forEach(([name, label], i) => {
      const r = Math.floor(i / cols), col = i % cols;
      const ix = Math.round(x + pad + col * (itemW + gap) + (itemW - 48) / 2);
      const iy = Math.round(y + header + pad + r * (itemH + gap));
      this.icon(`${id}_${i}`, name, [ix, iy], { parent: id, label });
    });
    return this.R[id];
  }
  /** Edge: just provide source→target + label; the router goes straight/through-gap automatically; corners by type+role.
   *  Recorded first — toXML() bundles edges with the SAME SOURCE and same direction into a fan-out BUNDLE
   *  (comb/trunk sharing a lane) so 1→N edges don't overlap/break. dir LR|TB, role flow|fanout|tree. */
  link(src, tgt, label = "", opts = {}) {
    if (!this.R[src]) throw new Error(`link: source does not exist yet "${src}"`);
    if (!this.R[tgt]) throw new Error(`link: target does not exist yet "${tgt}"`);
    this.edgeSpecs.push({ src, tgt, label, opts });
    return this;
  }

  /** Build all edges. Detect FAN-OUT bundles (1 source → ≥2 same-direction targets) and
   *  FAN-IN bundles (≥2 same-direction sources → 1 target); each bundle SHARES one lane so
   *  collinear segments merge into a single trunk and arrowheads don't stack. Fan-out wins
   *  when an edge qualifies as both. */
  _buildEdges() {
    if (this._edgesBuilt) return;
    this._edgesBuilt = true;
    const dirOf = (e) => e.opts.dir || "LR";
    const R = (i, side) => this.R[this.edgeSpecs[i][side]];
    const clamp = (v) => Math.max(0.2, Math.min(0.8, v));
    const route = this.edgeSpecs.map(() => null);

    // FAN-OUT: group by (direction, source)
    const outG = {};
    this.edgeSpecs.forEach((e, i) => ((outG[`${dirOf(e)}|${e.src}`] ||= []).push(i)));
    for (const k in outG) {
      const idxs = outG[k];
      if (idxs.length < 2) continue;
      const axis = k.slice(0, 2), s = R(idxs[0], "src");
      const lane = axis === "LR"
        ? Math.round((s.x + s.w + Math.min(...idxs.map((i) => R(i, "tgt").x))) / 2)
        : Math.round((s.y + s.h + Math.min(...idxs.map((i) => R(i, "tgt").y))) / 2);
      idxs.forEach((i) => (route[i] = { kind: "fanout", axis, lane }));
    }

    // FAN-IN: group by (direction, target) — only for edges not already in a fan-out bundle
    const inG = {};
    this.edgeSpecs.forEach((e, i) => ((inG[`${dirOf(e)}|${e.tgt}`] ||= []).push(i)));
    for (const k in inG) {
      const idxs = inG[k].filter((i) => !route[i]);
      if (idxs.length < 2) continue;
      const axis = k.slice(0, 2), t = R(idxs[0], "tgt");
      const lane = axis === "LR"
        ? Math.round((Math.max(...idxs.map((i) => { const s = R(i, "src"); return s.x + s.w; })) + t.x) / 2)
        : Math.round((Math.max(...idxs.map((i) => { const s = R(i, "src"); return s.y + s.h; })) + t.y) / 2);
      const ord = [...idxs].sort((a, b) => axis === "LR"
        ? R(a, "src").y - R(b, "src").y : R(a, "src").x - R(b, "src").x);
      ord.forEach((i, j) => (route[i] = { kind: "fanin", axis, lane, frac: clamp((j + 1) / (ord.length + 1)) }));
    }

    this.edgeSpecs.forEach((e, i) => this._emitEdge(e, route[i]));
  }

  _emitEdge({ src, tgt, label = "", opts = {} }, ro) {
    const { dir = "LR", role = "flow", dash = false, laneX = null, laneY = null } = opts;
    const a = this.R[src], b = this.R[tgt];
    let r, fan = false;
    if (ro && ro.kind === "fanout") {
      fan = true;
      r = ro.axis === "LR" ? routeLRFan(a, b, { laneX: laneX ?? ro.lane }) : routeTBFan(a, b, { laneY: laneY ?? ro.lane });
    } else if (ro && ro.kind === "fanin") {
      fan = true;
      r = ro.axis === "LR" ? routeLRFanIn(a, b, { laneX: laneX ?? ro.lane, entryY: ro.frac })
                           : routeTBFanIn(a, b, { laneY: laneY ?? ro.lane, entryX: ro.frac });
    } else if (dir === "TB") r = routeTB(a, b, { laneY: laneY != null ? laneY : (a.y + a.h + b.y) / 2 });
    else r = routeLR(a, b, { laneX: laneX != null ? laneX : (a.x + a.w + b.x) / 2 });
    let st = `edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;rounded=${edgeRounded(this.preset, fan ? "fanout" : role)};`;
    if (dash) st += "dashed=1;";
    if (label) st += "labelBackgroundColor=#FFFFFF;";
    st += r.pins;
    const pts = r.wp.length ? `<Array as="points">${r.wp.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>` : "";
    this.cells.push(`<mxCell id="ed${++this.eid}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
  }
  // reusable layout helpers
  centerInGapX(a, b, w) { return centerInGapX(a, b, w); }
  rect(id) { return this.R[id]; }

  /**
   * Node that "spans vertically" (LB/bus/hub) across multiple rows — the kit computes the rect, no numbers/coords at the call site.
   *   spec: { icon, label, w, pad?, fill?, stroke? }
   *   at:   { lane }  (centered in a pre-reserved lane) OR { between:[idA,idB] } (in the gap between 2 nodes)
   *         + { from, to } (height from the top edge of `from` to the bottom edge of `to`)
   */
  spanV(id, { icon, label = "", w, pad = 16, fill = "#FFFFFF", stroke = "#5A6B7B" }, { lane, between, from, to }) {
    const F = this.R[from], T = this.R[to] || F;
    const x = lane ? Math.round(this.R[lane].x + (this.R[lane].w - w) / 2)
                   : centerInGapX(this.R[between[0]], this.R[between[1]], w);
    const y = Math.round(F.y - pad), h = Math.round(T.y + T.h - F.y + pad * 2);
    this.box(id, [x, y], [w, h], label, { fill, stroke, va: "bottom", fs: 10 });
    if (icon) this.icon(`${id}_ic`, icon, [Math.round(x + (w - 48) / 2), y + 12]);
    return this.R[id];
  }

  toXML() {
    this._buildEdges();
    return `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${this.page[0]}" pageHeight="${this.page[1]}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${this.cells.join("")}</root></mxGraphModel>`;
  }
  validate(opts = { strict: true }) { return validateDiagram(this.c, this.toXML(), opts); }
  mxfile(name = "Diagram") { return `<mxfile host="app.diagrams.net"><diagram name="${esc(name)}" id="d">${this.toXML()}</diagram></mxfile>`; }
}
