// drawio-ai-kit — core engine (zero-dependency, Node >=18, target Node 26)
// Cung cấp: loadCatalog, searchIcon, styleForIcon, styleForGroup, validateDiagram.
// Không phụ thuộc thư viện ngoài để CLI luôn chạy được kể cả khi chưa cài MCP SDK.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOG = join(__dirname, "..", "catalog", "aws.json");

const FAMILY = "mxgraph.aws4";

/** Đọc catalog JSON và dựng chỉ mục tra cứu. */
export function loadCatalog(path = DEFAULT_CATALOG) {
  const file = isAbsolute(path) ? path : join(process.cwd(), path);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const icons = raw.icons ?? [];
  const groups = raw.groups ?? [];
  const byName = new Map();
  for (const it of icons) byName.set(it.name, { ...it, kind: "icon" });
  for (const g of groups) byName.set(g.name, { ...g, kind: "group" });
  return {
    meta: raw.meta ?? {},
    categoryColors: raw.categoryColors ?? {},
    icons,
    groups,
    byName,
    validNames: new Set(byName.keys()),
  };
}

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Điểm khớp đơn giản giữa query và một entry. */
function scoreEntry(entry, qTokens, qRaw) {
  const name = norm(entry.name);
  const haystack = norm(
    [entry.name, entry.label, entry.category, entry.tags, ...(entry.aliases ?? []), ...(entry.keywords ?? [])].join(" ")
  );
  let score = 0;
  if (name === qRaw) score += 100; // khớp tên chính xác
  if (name.replace(/ /g, "") === qRaw.replace(/ /g, "")) score += 60;
  for (const t of qTokens) {
    if (!t) continue;
    if (name.split(" ").includes(t)) score += 25;
    else if (name.includes(t)) score += 12;
    if (haystack.includes(t)) score += 6;
  }
  return score;
}

/** Tìm icon/group theo từ khóa. */
export function searchIcon(catalog, query, { category, limit = 8, kind } = {}) {
  const qRaw = norm(query);
  const qTokens = qRaw.split(" ").filter(Boolean);
  const cat = category ? norm(category) : null;
  const pool = [...catalog.byName.values()].filter((e) => {
    if (kind && e.kind !== kind) return false;
    if (cat && norm(e.category) !== cat && !norm(e.category).includes(cat)) return false;
    return true;
  });
  const ranked = pool
    .map((e) => ({ entry: e, score: scoreEntry(e, qTokens, qRaw) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => decorate(catalog, r.entry, r.score));
  return ranked;
}

function colorFor(catalog, entry) {
  return entry.color || catalog.categoryColors[entry.category] || "#232F3E";
}

function decorate(catalog, entry, score) {
  const styleObj = entry.kind === "group" ? styleForGroup(catalog, entry.name) : styleForIcon(catalog, entry.name);
  return {
    name: entry.name,
    fqn: `${FAMILY}.${entry.name}`,
    label: entry.label ?? entry.name,
    category: entry.category ?? null,
    kind: entry.kind,
    color: colorFor(catalog, entry),
    aliases: entry.aliases ?? [],
    style: styleObj.style,
    ...(styleObj.width ? { width: styleObj.width, height: styleObj.height } : {}),
    ...(score != null ? { score } : {}),
  };
}

/** Style draw.io đầy đủ cho một resource icon AWS (verbatim từ index nếu có). */
export function styleForIcon(catalog, name, { width, height } = {}) {
  const entry = catalog.byName.get(name);
  if (!entry) return null;
  if (entry.style) return { style: entry.style, width: width ?? entry.w ?? 48, height: height ?? entry.h ?? 48 };
  // fallback dựng tay (khi catalog ở dạng seed cũ)
  const color = colorFor(catalog, entry);
  const style =
    `sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=${color};` +
    `strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;` +
    `html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=${FAMILY}.resourceIcon;resIcon=${FAMILY}.${name};`;
  return { style, width: width ?? 48, height: height ?? 48 };
}

/** Style cho khung nhóm (AWS Cloud / Region / VPC / AZ ...) — verbatim từ index nếu có. */
export function styleForGroup(catalog, name) {
  const entry = catalog.byName.get(name);
  if (entry?.style) return { style: entry.style, width: entry.w, height: entry.h };
  const stroke = entry?.stroke || "#232F3E";
  const fill = entry?.fill || "none";
  const style =
    `sketch=0;outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;` +
    `container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=${FAMILY}.group;` +
    `grIcon=${FAMILY}.${name};strokeColor=${stroke};fillColor=${fill};verticalAlign=top;align=left;` +
    `spacingLeft=30;fontColor=${stroke};dashed=${entry?.dashed ? 1 : 0};`;
  return { style };
}

const RE_RESICON = /resIcon=mxgraph\.aws4\.([a-z0-9_]+)/g;
const RE_GRICON = /grIcon=mxgraph\.aws4\.([a-z0-9_]+)/g;
const RE_SHAPE = /shape=mxgraph\.aws4\.([a-zA-Z0-9_]+)/g;
const RE_ID = /\bid="([^"]+)"/g;
const RE_SRC = /\bsource="([^"]+)"/g;
const RE_TGT = /\btarget="([^"]+)"/g;

function collect(re, xml) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/**
 * Kiểm tra một chuỗi XML draw.io:
 *  - mọi resIcon / grIcon có tồn tại trong catalog không (chống AI bịa tên)
 *  - edge có trỏ tới id tồn tại không
 *  - vài lint cơ bản về style icon
 * Trả { ok, errors, warnings, stats }.
 */
export function validateDiagram(catalog, xml, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const knownShapeWords = new Set(["resourceIcon", "group", "productIcon"]);

  const resIcons = collect(RE_RESICON, xml);
  const grIcons = collect(RE_GRICON, xml);
  const shapes = collect(RE_SHAPE, xml).filter((s) => !knownShapeWords.has(s));

  const checkRef = (name, where) => {
    if (catalog.validNames.has(name)) return;
    const msg = `Stencil không có trong catalog: mxgraph.aws4.${name} (tại ${where})`;
    const suggestions = searchIcon(catalog, name.replace(/_/g, " "), { limit: 3 }).map((s) => s.name);
    const full = suggestions.length ? `${msg} — gợi ý: ${suggestions.join(", ")}` : msg;
    if (strict || !catalog.meta.incomplete) errors.push(full);
    else warnings.push(full + " (catalog đang ở dạng seed, có thể chưa đủ — chạy generator để xác thực)");
  };

  for (const n of resIcons) checkRef(n, "resIcon");
  for (const n of grIcons) checkRef(n, "grIcon");
  for (const n of shapes) checkRef(n, "shape");

  // edge references
  const ids = new Set(collect(RE_ID, xml));
  const dangling = [];
  for (const re of [RE_SRC, RE_TGT]) {
    for (const ref of collect(re, xml)) {
      if (!ids.has(ref)) dangling.push(ref);
    }
  }
  for (const d of [...new Set(dangling)]) {
    warnings.push(`Edge trỏ tới id không tồn tại: "${d}"`);
  }

  // lint: mỗi style chứa resourceIcon nên có aspect=fixed
  const iconStyles = xml.match(/style="[^"]*mxgraph\.aws4\.resourceIcon[^"]*"/g) ?? [];
  for (const c of iconStyles) {
    if (!/aspect=fixed/.test(c)) {
      warnings.push("resourceIcon thiếu 'aspect=fixed' → icon có thể méo khi resize.");
      break;
    }
  }

  const audit = auditAesthetics(xml);
  audit.advice.push(...auditAwsConventions(catalog, xml));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    audit,
    stats: {
      resIcons: resIcons.length,
      grIcons: grIcons.length,
      shapes: shapes.length,
      uniqueStencils: new Set([...resIcons, ...grIcons, ...shapes]).size,
      cellIds: ids.size,
    },
  };
}

const RE_OPENCELL = /<mxCell\b[^>]*?>/g;
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * Kiểm "độ đẹp" rút ra từ so sánh bản AI vẽ vs bản người sửa.
 * Chỉ xét sắp xếp nét / bố cục / nhất quán thị giác. Trả advisory (không phải lỗi cứng).
 */
export function auditAesthetics(xml) {
  const advice = [];

  // 1) Cỡ chữ: giới hạn 3–4 cỡ, tránh khổng lồ.
  const fontSizes = [...xml.matchAll(/fontSize=(\d+)/g)].map((m) => Number(m[1]));
  const uniqFonts = [...new Set(fontSizes)].sort((a, b) => a - b);
  if (uniqFonts.length > 4)
    advice.push(`Quá nhiều cỡ chữ (${uniqFonts.length}): [${uniqFonts.join(", ")}] — giới hạn 3–4 cỡ cho nhất quán.`);
  const big = uniqFonts.filter((s) => s >= 16);
  if (big.length) advice.push(`Cỡ chữ quá lớn [${big.join(", ")}] — dùng ≤ 14 cho nhãn; tiêu đề tách riêng, đừng phình.`);

  // 2) Palette: chỉ tính màu NỀN/HỘP — bỏ qua màu icon/group AWS (bắt buộc theo category).
  const fills = [];
  for (const tag of xml.match(RE_OPENCELL) ?? []) {
    const st = attr(tag, "style") || "";
    if (/mxgraph\.aws4\.(resourceIcon|group)/.test(st)) continue; // màu icon/group là canonical
    const fm = st.match(/fillColor=([^;"}]+)/);
    if (fm) fills.push(fm[1].trim().toLowerCase());
  }
  const uniqFills = [...new Set(fills.filter((c) => c && c !== "none" && c !== "default"))];
  if (uniqFills.length > 8)
    advice.push(`Bảng màu lan man (${uniqFills.length} màu nền) — dùng palette hạn chế, để màu mạnh cho điểm nhấn/note.`);
  if (uniqFills.length && !/light-dark\(/.test(xml))
    advice.push("Cân nhắc token màu light-dark(...) cho nền/accent để sơ đồ đẹp ở cả light & dark mode.");

  // 3) Cạnh: lấy source/target/style của mọi edge.
  const edges = [];
  for (const tag of xml.match(RE_OPENCELL) ?? []) {
    if (attr(tag, "edge") !== "1") continue;
    edges.push({ source: attr(tag, "source"), target: attr(tag, "target"), style: attr(tag, "style") || "" });
  }
  const bySource = new Map();
  for (const e of edges) {
    if (!e.source) continue;
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source).push(e);
  }
  // fan-out (1 nguồn → ≥3 đích): nên góc vuông + pin điểm nối để các nét song song thẳng hàng.
  for (const [src, list] of bySource) {
    if (list.length < 3) continue;
    if (list.every((e) => /rounded=1/.test(e.style)))
      advice.push(`Nhánh fan-out từ "${src}" (${list.length} cạnh) nên dùng rounded=0 (góc vuông) thay vì bo tròn.`);
    if (list.every((e) => !/(exitX|entryX)=/.test(e.style)))
      advice.push(`Pin điểm nối (exitX/exitY, entryX/entryY) cho nhánh fan-out từ "${src}" để các nét song song thẳng hàng.`);
  }

  // 4) Kích thước icon nhất quán.
  const iconW = [
    ...xml.matchAll(/<mxCell\b[^>]*resourceIcon[^>]*>\s*<mxGeometry\b[^>]*\bwidth="([\d.]+)"/g),
  ].map((m) => Number(m[1]));
  const uniqW = [...new Set(iconW)];
  if (uniqW.length > 2)
    advice.push(`Kích thước icon không đồng nhất [${uniqW.sort((a, b) => a - b).join(", ")}] — nên dùng 1 cỡ (vd 48 hoặc 78).`);

  return {
    advice,
    metrics: { fontSizes: uniqFonts, fillColors: uniqFills.length, edges: edges.length, fanOutSources: [...bySource.values()].filter((l) => l.length >= 3).length },
  };
}

// Thứ bậc lồng group AWS: số nhỏ = bao ngoài.
const GROUP_LEVEL = {
  group_aws_cloud: 0, group_aws_cloud_alt: 0, group_account: 0,
  group_corporate_data_center: 0, group_on_premise: 0,
  group_region: 1,
  group_vpc: 2, group_vpc2: 2,
  group_availability_zone: 3,
  group_subnet: 4,
  group_security_group: 5,
};

/**
 * Kiểm quy ước riêng cho kiến trúc AWS:
 *  - icon bị đổi màu khác màu category chuẩn (mất nhận diện).
 *  - group lồng sai thứ tự (AWS Cloud→Region→VPC→AZ→Subnet→SG).
 * Trả advisory.
 */
export function auditAwsConventions(catalog, xml) {
  const advice = [];
  const cells = (xml.match(RE_OPENCELL) ?? []).map((tag) => ({
    id: attr(tag, "id"),
    parent: attr(tag, "parent"),
    style: attr(tag, "style") || "",
  }));
  const byId = new Map(cells.filter((c) => c.id).map((c) => [c.id, c]));

  // 1) Icon đổi màu so với màu chuẩn của chính nó.
  for (const c of cells) {
    const m = c.style.match(/resIcon=mxgraph\.aws4\.([a-zA-Z0-9_]+)/);
    if (!m) continue;
    const entry = catalog.byName.get(m[1]);
    if (!entry?.color) continue;
    const fm = c.style.match(/fillColor=([^;]+)/);
    if (!fm) continue;
    const used = fm[1].trim().toLowerCase();
    if (used.startsWith("light-dark")) continue;
    if (used !== String(entry.color).trim().toLowerCase())
      advice.push(`Icon "${m[1]}" bị đổi màu (fillColor=${fm[1].trim()} ≠ màu chuẩn ${entry.color}) — giữ màu category để dễ nhận diện.`);
  }

  // 2) Lồng group đúng thứ tự.
  const groupTok = (style) => (style.match(/grIcon=mxgraph\.aws4\.([a-zA-Z0-9_]+)/) || [])[1];
  const ancestorLevels = (c) => {
    const out = [];
    let p = byId.get(c.parent);
    let guard = 0;
    while (p && guard++ < 50) {
      const g = groupTok(p.style);
      if (g != null && GROUP_LEVEL[g] != null) out.push(GROUP_LEVEL[g]);
      p = byId.get(p.parent);
    }
    return out;
  };
  for (const c of cells) {
    const g = groupTok(c.style);
    if (g == null) continue;
    const lvl = GROUP_LEVEL[g];
    if (lvl == null || lvl === 0) continue; // top-level hoặc group không xếp hạng
    if (!ancestorLevels(c).some((l) => l < lvl))
      advice.push(`Group "${g}" nên được lồng trong group cấp cao hơn (AWS Cloud→Region→VPC→AZ→Subnet→SG) — hiện đặt phẳng/sai thứ tự.`);
  }
  return advice;
}

export function listCategories(catalog) {
  const counts = new Map();
  for (const e of catalog.byName.values()) {
    const c = e.category ?? "(none)";
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([category, count]) => ({ category, count }));
}

export function getIcon(catalog, name) {
  const e = catalog.byName.get(name);
  return e ? decorate(catalog, e) : null;
}
