// VPC Multi-AZ 3-tier — type "network". Lồng container thật: Region→VPC→AZ→Subnet.
import { writeFileSync } from "node:fs";
import { loadCatalog, styleForIcon, styleForGroup, validateDiagram } from "../src/core.mjs";
import { routeLR, routeTB } from "../src/layout.mjs";
import { typePreset, edgeRounded } from "../src/types.mjs";

const c = loadCatalog();
const T = typePreset("network");
const cells = [];
const R = {};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let auto = 0;
const nid = () => `e${++auto}`;

// node lồng: lưu rect TUYỆT ĐỐI (cho routing), geometry phát TƯƠNG ĐỐI theo parent.
function node(id, parent, ax, ay, w, h, style, label) {
  R[id] = { x: ax, y: ay, w, h };
  const ox = parent === "1" ? 0 : R[parent].x, oy = parent === "1" ? 0 : R[parent].y;
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${ax - ox}" y="${ay - oy}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
const grp = (id, parent, ax, ay, w, h, label, gname) => node(id, parent, ax, ay, w, h, styleForGroup(c, gname).style, label);
const ic = (id, parent, ax, ay, name, label) => node(id, parent, ax, ay, 48, 48, styleForIcon(c, name).style, label);
const box = (id, parent, ax, ay, w, h, label, fill, stroke, va = "middle", fs = 11, fst = 0) =>
  node(id, parent, ax, ay, w, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;fontSize=${fs};fontStyle=${fst};verticalAlign=${va};`, label);
function text(id, ax, ay, w, h, label, fs = 14) {
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="1"><mxGeometry x="${ax}" y="${ay}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
function link(src, tgt, label = "", { dir = "LR", role = "flow", dash = false } = {}) {
  const r = dir === "TB" ? routeTB(R[src], R[tgt], { laneY: (R[src].y + R[src].h + R[tgt].y) / 2 })
                         : routeLR(R[src], R[tgt], { laneX: (R[src].x + R[src].w + R[tgt].x) / 2 });
  let st = `edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;rounded=${edgeRounded(T, role)};`;
  if (dash) st += "dashed=1;startArrow=block;endArrow=block;";
  if (label) st += "labelBackgroundColor=#FFFFFF;";
  st += r.pins;
  const pts = r.wp.length ? `<Array as="points">${r.wp.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>` : "";
  cells.push(`<mxCell id="${nid()}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
}

text("title", 300, 24, 1760, 30, "VPC Multi-AZ 3-tier — type: network (Region → VPC → AZ → Subnet)");

// external
box("users", "1", 40, 500, 120, 80, "Users / Internet", "#DAE8FC", "#6C8EBF", "middle", 12, 1);
ic("igw", "1", 250, 516, "internet_gateway", "Internet Gateway");

// Region → VPC
grp("region", "1", 300, 90, 1760, 940, "Region (ap-southeast-1)", "group_region");
grp("vpc", "region", 340, 150, 1280, 800, "VPC  10.0.0.0/16", "group_vpc");

// 2 AZ (đối xứng)
grp("az_a", "vpc", 380, 220, 1180, 300, "Availability Zone A", "group_availability_zone");
grp("az_b", "vpc", 380, 560, 1180, 300, "Availability Zone B", "group_availability_zone");

// subnets + icons cho từng AZ
function azContents(az, baseY, suffix, rdsLabel) {
  grp(`pub_${suffix}`, az, 420, baseY + 50, 200, 180, "Public Subnet", "group_subnet");
  ic(`nat_${suffix}`, `pub_${suffix}`, 496, baseY + 110, "nat_gateway", "NAT Gateway");
  grp(`app_${suffix}`, az, 760, baseY + 50, 220, 180, "Private Subnet (App)", "group_subnet");
  ic(`ec2_${suffix}`, `app_${suffix}`, 846, baseY + 110, "ec2", "EC2 / ECS");
  grp(`db_${suffix}`, az, 1100, baseY + 50, 220, 180, "Private Subnet (Data)", "group_subnet");
  ic(`rds_${suffix}`, `db_${suffix}`, 1186, baseY + 110, "rds", rdsLabel);
}
azContents("az_a", 220, "a", "RDS (Primary)");
azContents("az_b", 560, "b", "RDS (Standby)");

// ALB trải dọc qua các AZ (hub) — nét tới mỗi tier app là ngang thẳng
box("alb", "vpc", 650, 300, 110, 440, "Application\nLoad Balancer\n(Multi-AZ)", "#FFFFFF", "#9673A6", "bottom", 10);
ic("alb_ic", "alb", 681, 318, "application_load_balancer", "");

// Regional services (ngoài VPC, trong Region)
box("reg_svc", "region", 1660, 250, 360, 520, "Regional / Edge services", "#F5F5F5", "#999999", "top", 11, 1);
ic("waf", "reg_svc", 1700, 320, "waf", "AWS WAF");
ic("cw", "reg_svc", 1700, 470, "cloudwatch_2", "CloudWatch");
ic("s3", "reg_svc", 1700, 620, "s3", "S3 (assets/logs)");

// ---- edges ----
link("users", "igw");
link("igw", "alb");
link("alb", "ec2_a");
link("alb", "ec2_b");
link("ec2_a", "rds_a");
link("ec2_b", "rds_b");
link("rds_a", "rds_b", "Multi-AZ replication", { dir: "TB", dash: true });

// ---- assemble + validate ----
const xml =
  `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2100" pageHeight="1080" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  cells.join("") + `</root></mxGraphModel>`;
const file = new URL("../../vpc_multiaz_kit.drawio", import.meta.url);
writeFileSync(file, `<mxfile host="app.diagrams.net"><diagram name="VPC Multi-AZ 3-tier" id="vpc">${xml}</diagram></mxfile>`);
writeFileSync(new URL("./_vpc_model.xml", import.meta.url), xml);
const res = validateDiagram(c, xml, { strict: true });
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
