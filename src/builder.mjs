// drawio-ai-kit — Diagram builder. Gom mọi boilerplate: icon/box/group/panel/link
// + auto-routing theo type + auto-size panel + validate + xuất XML. Mục tiêu: tạo
// một sơ đồ chỉ bằng vài dòng khai báo (dễ dùng, dễ mở rộng).
import { loadCatalog, styleForIcon, styleForGroup, validateDiagram } from "./core.mjs";
import { routeLR, routeTB, centerInBoxX, distributeY, centerInGapX, panelSize } from "./layout.mjs";
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
    if (title) this.text("__title", [0, 24], page[0], title, { fs: 14 });
  }
  _put(id, parent, x, y, w, h, style, label) {
    this.R[id] = { x, y, w, h };
    const ox = parent === "1" ? 0 : this.R[parent].x, oy = parent === "1" ? 0 : this.R[parent].y;
    this.cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x - ox}" y="${y - oy}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    return this.R[id];
  }
  /** Icon AWS theo tên catalog (style verbatim). [x,y] = góc trên-trái (icon 48×48). */
  icon(id, name, [x, y], { parent = "1", label = "" } = {}) {
    const s = styleForIcon(this.c, name);
    if (!s) throw new Error(`Icon không có trong catalog: "${name}" — dùng search_icon để tra tên đúng.`);
    return this._put(id, parent, x, y, 48, 48, s.style, label);
  }
  // Mặc định GÓC VUÔNG — sơ đồ AWS gần như không dùng khung bo góc. (round:true nếu cần.)
  box(id, [x, y], [w, h], label = "", { parent = "1", fill = "#FFFFFF", stroke = "#5A6B7B", va = "middle", bold = false, fs = 11, round = false } = {}) {
    return this._put(id, parent, x, y, w, h, `rounded=${round ? 1 : 0};whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;fontSize=${fs};fontStyle=${bold ? 1 : 0};verticalAlign=${va};`, label);
  }
  /** Container nhóm AWS (group_aws_cloud_alt, group_region, group_vpc, group_account, ...). */
  group(id, gname, [x, y], [w, h], label = "", { parent = "1" } = {}) {
    const s = styleForGroup(this.c, gname);
    if (!s) throw new Error(`Group không có: "${gname}"`);
    return this._put(id, parent, x, y, w, h, s.style, label);
  }
  text(id, [x, y], w, label, { fs = 14, parent = "1" } = {}) {
    const ox = parent === "1" ? 0 : this.R[parent].x, oy = parent === "1" ? 0 : this.R[parent].y;
    this.R[id] = { x, y, w, h: 30 };
    this.cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="${parent}"><mxGeometry x="${x - ox}" y="${y - oy}" width="${w}" height="30" as="geometry"/></mxCell>`);
  }
  /**
   * Panel TỰ CO theo số icon: vẽ box vừa khít, icon canh giữa cột + phân bố đều.
   * items = [[iconName, label], ...]. Trả rect của panel.
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
  /** Cạnh: chỉ cần nguồn→đích + nhãn; router tự thẳng/qua-khe; góc theo type+role. */
  link(src, tgt, label = "", { dir = "LR", role = "flow", dash = false, laneX = null, laneY = null } = {}) {
    const a = this.R[src], b = this.R[tgt];
    const r = dir === "TB"
      ? routeTB(a, b, { laneY: laneY != null ? laneY : (a.y + a.h + b.y) / 2 })
      : routeLR(a, b, { laneX: laneX != null ? laneX : (a.x + a.w + b.x) / 2 });
    let st = `edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;rounded=${edgeRounded(this.preset, role)};`;
    if (dash) st += "dashed=1;";
    if (label) st += "labelBackgroundColor=#FFFFFF;";
    st += r.pins;
    const pts = r.wp.length ? `<Array as="points">${r.wp.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>` : "";
    this.cells.push(`<mxCell id="ed${++this.eid}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
  }
  // tiện ích layout tái dùng
  centerInGapX(a, b, w) { return centerInGapX(a, b, w); }
  rect(id) { return this.R[id]; }

  toXML() {
    return `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${this.page[0]}" pageHeight="${this.page[1]}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${this.cells.join("")}</root></mxGraphModel>`;
  }
  validate(opts = { strict: true }) { return validateDiagram(this.c, this.toXML(), opts); }
  mxfile(name = "Diagram") { return `<mxfile host="app.diagrams.net"><diagram name="${esc(name)}" id="d">${this.toXML()}</diagram></mxfile>`; }
}
