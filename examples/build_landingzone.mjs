// AWS Landing Zone (Organizations / Control Tower) — dựng bằng kit.
import { writeFileSync } from "node:fs";
import { loadCatalog, styleForIcon, validateDiagram } from "../src/core.mjs";
import { routeLR, routeTB } from "../src/layout.mjs";

const c = loadCatalog();
const cells = [];
const R = {};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let auto = 0;
const nid = () => `e${++auto}`;

function put(id, x, y, w, h, style, label) {
  R[id] = { x, y, w, h };
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
const icon = (id, name, x, y, label) => put(id, x, y, 48, 48, styleForIcon(c, name).style, label);
const frame = (id, x, y, w, h, label, fill, stroke, fs = 12) =>
  put(id, x, y, w, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;verticalAlign=top;fontStyle=1;fontSize=${fs};fillOpacity=${fill === "none" ? 100 : 30};arcSize=2;`, label);
const acct = (id, x, y, w, h, label) =>
  put(id, x, y, w, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#5A6B7B;fontColor=#1A1A1A;verticalAlign=top;fontStyle=1;fontSize=11;arcSize=3;`, label);
function text(id, x, y, w, h, label, fs = 14) {
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
function link(src, tgt, label = "", { kind = "flow", dir = "LR" } = {}) {
  const a = R[src], b = R[tgt];
  const r = dir === "TB"
    ? routeTB(a, b, { laneY: (a.y + a.h + b.y) / 2 })
    : routeLR(a, b, { laneX: (a.x + a.w + b.x) / 2 });
  let st = `edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;rounded=${kind === "tree" ? 0 : 1};`;
  if (kind === "dash") st += "dashed=1;";
  if (label) st += "labelBackgroundColor=#FFFFFF;";
  st += r.pins;
  const pts = r.wp.length ? `<Array as="points">${r.wp.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>` : "";
  cells.push(`<mxCell id="${nid()}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
}
// hàng 3 icon trong 1 account
function row3(prefix, accX, accY, items) {
  const xs = [accX + 28, accX + 146, accX + 264];
  items.forEach(([name, label], i) => icon(`${prefix}_${i}`, name, xs[i], accY + 64, label));
}
function row2(prefix, accX, accY, items) {
  const xs = [accX + 86, accX + 206];
  items.forEach(([name, label], i) => icon(`${prefix}_${i}`, name, xs[i], accY + 64, label));
}

text("title", 60, 24, 1620, 30, "AWS Landing Zone — Multi-account (AWS Organizations · Control Tower)");

// Management (root) account
frame("mgmt", 540, 80, 680, 150, "Management Account (Root)", "#E1D5E7", "#9673A6");
icon("m_org", "organizations", 600, 120, "AWS Organizations");
icon("m_ct", "control_tower", 800, 120, "Control Tower");
icon("m_sso", "single_sign_on", 1000, 120, "IAM Identity Center");
text("mgmt_note", 560, 196, 640, 24, "SCPs · Guardrails · Config Rules · Org-wide CloudTrail · Consolidated Billing", 10);

// OU columns
const OUX = [60, 480, 900, 1320], OUW = 360;
frame("ou_sec", OUX[0], 260, OUW, 460, "Security OU", "#F8CECC", "#B85450");
frame("ou_inf", OUX[1], 260, OUW, 460, "Infrastructure OU", "#DAE8FC", "#6C8EBF");
frame("ou_wl", OUX[2], 260, OUW, 460, "Workloads OU", "#D5E8D4", "#82B366");
frame("ou_sbx", OUX[3], 260, OUW, 460, "Sandbox OU", "#F5F5F5", "#999999");

// Security OU accounts
acct("a_log", OUX[0] + 10, 300, 340, 195, "Log Archive Account");
row3("log", OUX[0] + 10, 300, [["s3", "S3 (central logs)"], ["cloudtrail", "CloudTrail"], ["config", "Config"]]);
acct("a_audit", OUX[0] + 10, 510, 340, 195, "Security Tooling / Audit Account");
row3("aud", OUX[0] + 10, 510, [["guardduty", "GuardDuty"], ["security_hub", "Security Hub"], ["key_management_service", "KMS"]]);

// Infrastructure OU accounts
acct("a_net", OUX[1] + 10, 300, 340, 195, "Network Account");
row3("net", OUX[1] + 10, 300, [["transit_gateway", "Transit Gateway"], ["direct_connect", "Direct Connect"], ["vpc", "Shared VPC"]]);
acct("a_shared", OUX[1] + 10, 510, 340, 195, "Shared Services Account");
row2("shr", OUX[1] + 10, 510, [["directory_service", "Directory Service"], ["resource_access_manager", "RAM"]]);

// Workloads OU accounts
acct("a_prod", OUX[2] + 10, 300, 340, 195, "Production Account");
row3("prod", OUX[2] + 10, 300, [["vpc", "VPC"], ["eks", "EKS"], ["ec2", "EC2"]]);
acct("a_nonprod", OUX[2] + 10, 510, 340, 195, "Non-Production (Dev/Test) Account");
row2("np", OUX[2] + 10, 510, [["vpc", "VPC"], ["ec2", "EC2"]]);

// Sandbox OU account
acct("a_sbx", OUX[3] + 10, 300, 340, 195, "Sandbox Account");
row2("sbx", OUX[3] + 10, 300, [["vpc", "VPC"], ["ec2", "EC2"]]);
text("sbx_note", OUX[3] + 10, 520, 340, 40, "Tách biệt, guardrail nới lỏng cho thử nghiệm", 10);

// On-premises
frame("onprem", OUX[1], 790, OUW, 110, "ON-PREMISES (VCB Data Center)", "#F0F0F0", "#666666");
text("onprem_b", OUX[1] + 20, 840, OUW - 40, 40, "Active Directory · hệ thống hiện hữu", 10);

// ---- edges ----
link("mgmt", "ou_sec", "", { dir: "TB", kind: "tree" });
link("mgmt", "ou_inf", "", { dir: "TB", kind: "tree" });
link("mgmt", "ou_wl", "", { dir: "TB", kind: "tree" });
link("mgmt", "ou_sbx", "", { dir: "TB", kind: "tree" });
link("a_net", "a_prod", "via TGW", { kind: "dash" });
link("ou_inf", "onprem", "AWS Direct Connect", { dir: "TB" });

// ---- assemble + validate ----
const xml =
  `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1760" pageHeight="960" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  cells.join("") + `</root></mxGraphModel>`;
const file = new URL("../../landingzone_kit.drawio", import.meta.url);
writeFileSync(file, `<mxfile host="app.diagrams.net"><diagram name="AWS Landing Zone" id="lz">${xml}</diagram></mxfile>`);
writeFileSync(new URL("./_lz_model.xml", import.meta.url), xml);
const res = validateDiagram(c, xml, { strict: true });
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
