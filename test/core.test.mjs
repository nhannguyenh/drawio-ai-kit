import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog, searchIcon, getIcon, styleForIcon, validateDiagram, auditAesthetics } from "../src/core.mjs";

const catalog = loadCatalog();

test("search tìm đúng S3 với tên thật 's3'", () => {
  const r = searchIcon(catalog, "s3");
  assert.ok(r.some((x) => x.name === "s3"), "phải có icon tên 's3'");
  const s3 = r.find((x) => x.name === "s3");
  assert.match(s3.style, /resIcon=mxgraph\.aws4\.s3;/);
});

test("search tìm EKS theo từ khóa kubernetes", () => {
  const r = searchIcon(catalog, "kubernetes");
  assert.ok(r.some((x) => x.name === "eks"));
});

test("styleForIcon trả style verbatim (S3 = xanh lá + points + aspect=fixed)", () => {
  const s = styleForIcon(catalog, "s3");
  assert.match(s.style, /fillColor=#7AA116/);
  assert.match(s.style, /aspect=fixed/);
  assert.match(s.style, /points=/);
});

test("validate phát hiện stencil bịa tên", () => {
  const xml = `<mxCell style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.totally_made_up;" />`;
  const res = validateDiagram(catalog, xml);
  assert.ok(res.warnings.length + res.errors.length >= 1);
});

test("validate sạch với stencil hợp lệ", () => {
  const s = styleForIcon(catalog, "ec2").style;
  const xml = `<mxCell id="a" style="${s}"/>`;
  const res = validateDiagram(catalog, xml, { strict: true });
  assert.equal(res.errors.length, 0);
});

test("validate cảnh báo edge trỏ id không tồn tại", () => {
  const xml = `<mxCell id="a"/><mxCell source="a" target="ghost" edge="1"/>`;
  const res = validateDiagram(catalog, xml);
  assert.ok(res.warnings.some((w) => w.includes("ghost")));
});

test("getIcon trả null cho tên không có", () => {
  assert.equal(getIcon(catalog, "nope_nope"), null);
});

test("audit bắt cỡ chữ khổng lồ và quá nhiều cỡ", () => {
  const xml = `<a fontSize="10"/><a fontSize="11"/><a fontSize="12"/><a fontSize="13"/><a fontSize="18"/>`
    .replace(/fontSize="(\d+)"/g, "fontSize=$1;");
  const a = auditAesthetics(xml);
  assert.ok(a.advice.some((x) => /cỡ chữ/i.test(x)));
  assert.ok(a.advice.some((x) => /quá lớn/i.test(x)));
});

test("audit gợi ý fan-out: góc vuông + pin điểm nối", () => {
  const e = (s, t) => `<mxCell edge="1" source="${s}" target="${t}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;"/>`;
  const xml = `<root>${e("hub", "a")}${e("hub", "b")}${e("hub", "c")}</root>`;
  const a = auditAesthetics(xml);
  assert.ok(a.advice.some((x) => /rounded=0|góc vuông/.test(x)));
  assert.ok(a.advice.some((x) => /Pin điểm nối/.test(x)));
  assert.equal(a.metrics.fanOutSources, 1);
});

test("AWS: bắt icon bị đổi màu sai category", () => {
  const xml = `<mxCell id="a" style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;fillColor=#FF0000;aspect=fixed;"/>`;
  const res = validateDiagram(catalog, xml);
  assert.ok(res.audit.advice.some((x) => /đổi màu/.test(x)), "phải cảnh báo S3 đổi màu");
});

test("AWS: bắt group lồng sai thứ tự (subnet đặt phẳng)", () => {
  const subnet = styleForIcon ? null : null;
  const xml = `<root>
    <mxCell id="sn" parent="1" vertex="1" style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet;"/>
  </root>`;
  const res = validateDiagram(catalog, xml);
  assert.ok(res.audit.advice.some((x) => /lồng trong group cấp cao/.test(x)));
});

test("AWS: group lồng đúng (subnet trong VPC) không cảnh báo nesting", () => {
  const xml = `<root>
    <mxCell id="vpc" parent="1" style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;"/>
    <mxCell id="sn" parent="vpc" style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet;"/>
  </root>`;
  const res = validateDiagram(catalog, xml);
  assert.ok(!res.audit.advice.some((x) => /group_subnet.*lồng trong/.test(x)));
});

test("audit bắt palette lan man", () => {
  const colors = ["#111", "#222", "#333", "#444", "#555", "#666", "#777", "#888", "#999"];
  const xml = colors.map((c) => `<x style="fillColor=${c};"/>`).join("");
  const a = auditAesthetics(xml);
  assert.ok(a.advice.some((x) => /lan man/.test(x)));
});
