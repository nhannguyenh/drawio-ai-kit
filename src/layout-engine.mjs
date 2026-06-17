// drawio-ai-kit — layout engine khai báo (flexbox-style cho sơ đồ AWS).
// Bạn KHAI BÁO cấu trúc lồng nhau (group/row/col + icon/box); engine TỰ TÍNH
// mọi x/y/w/h: khung tự bao khít con, hàng/cột tự giãn đều. KHÔNG toạ độ hardcode.
//
//   const tree = group("region","group_region","AWS Region",{dir:"row"},[
//     group("acc","group_account","Account",{dir:"col"},[ icon("s3","s3","S3"), ... ]),
//   ]);
//   renderTree(d, tree, [40, 70]);   // đặt vào Diagram builder, tự set page
//   d.title("...");  d.link("a","b","...");

const ICON = 48;

// ---- node creators ----
export const icon = (id, name, label = "", opts = {}) => ({ kind: "icon", id, name, label, ...opts });
export const box = (id, label = "", opts = {}) => ({ kind: "box", id, label, w: opts.w ?? 150, h: opts.h ?? 60, ...opts });
export const group = (id, gname, label = "", opts = {}, children = []) => ({
  kind: "group", id, gname: gname || null, label, children,
  dir: opts.dir ?? "row", gap: opts.gap ?? 30, pad: opts.pad ?? 24,
  header: label ? (opts.header ?? 36) : (opts.header ?? 14),
  align: opts.align ?? "center", fill: opts.fill, stroke: opts.stroke,
});
/** group không có stencil AWS = khung vuông thường (cho lớp/band logic). */
export const frame = (id, label, opts = {}, children = []) => group(id, null, label, opts, children);

// ---- measure: gán w,h (bottom-up) ----
function measure(n) {
  if (n.kind === "icon") {
    n.w = Math.max(96, Math.min(200, (n.label?.length ?? 0) * 7 + 24));
    n.h = ICON + 34; // icon + nhãn dưới
    return;
  }
  if (n.kind === "box") return; // w,h cho sẵn
  n.children.forEach(measure);
  const ch = n.children, g = n.gap, p = n.pad, head = n.header;
  const sum = (f) => ch.reduce((s, c) => s + f(c), 0);
  const max = (f) => ch.reduce((m, c) => Math.max(m, f(c)), 0);
  if (n.dir === "row") {
    n.w = p * 2 + sum((c) => c.w) + g * Math.max(0, ch.length - 1);
    n.h = head + p * 2 + max((c) => c.h);
  } else { // col
    n.w = p * 2 + max((c) => c.w);
    n.h = head + p * 2 + sum((c) => c.h) + g * Math.max(0, ch.length - 1);
  }
}

// ---- place: gán x,y (top-down) ----
function place(n, x, y) {
  n.x = Math.round(x); n.y = Math.round(y);
  if (n.kind !== "group") return;
  const innerX = n.x + n.pad, innerTop = n.y + n.header + n.pad;
  const innerW = n.w - n.pad * 2, innerH = n.h - n.header - n.pad * 2;
  if (n.dir === "row") {
    let cx = innerX;
    for (const c of n.children) {
      const cy = n.align === "top" ? innerTop : innerTop + (innerH - c.h) / 2;
      place(c, cx, cy); cx += c.w + n.gap;
    }
  } else {
    let cy = innerTop;
    for (const c of n.children) {
      const cx = n.align === "left" ? innerX : innerX + (innerW - c.w) / 2;
      place(c, cx, cy); cy += c.h + n.gap;
    }
  }
}

// ---- emit: phát ra Diagram builder ----
function emit(d, n, parent) {
  if (n.kind === "icon") {
    d.icon(n.id, n.name, [Math.round(n.x + (n.w - ICON) / 2), n.y], { parent, label: n.label });
    return;
  }
  if (n.kind === "box") {
    d.box(n.id, [n.x, n.y], [n.w, n.h], n.label, { parent, fill: n.fill, stroke: n.stroke, round: n.round, va: n.va, bold: n.bold });
    return;
  }
  if (n.gname) d.group(n.id, n.gname, [n.x, n.y], [n.w, n.h], n.label, { parent });
  else d.box(n.id, [n.x, n.y], [n.w, n.h], n.label, { parent, va: "top", bold: true, fill: n.fill ?? "#F5F5F5", stroke: n.stroke ?? "#999999" });
  for (const c of n.children) emit(d, c, n.id);
}

/** Tính layout cho cây + phát vào Diagram d; tự set page theo kích thước thật. */
export function renderTree(d, root, [x = 40, y = 70] = []) {
  measure(root);
  place(root, x, y);
  emit(d, root, "1");
  d.page = [Math.round(root.x + root.w + 40), Math.round(root.y + root.h + 50)];
  return root;
}
