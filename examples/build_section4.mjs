// Demo v4: sơ đồ tổng thể On-Cloud (mục 4.0) bằng kit.
// MỌI nét đi qua bộ định tuyến chung (src/layout.mjs) — tự thẳng / tự waypoint, KHÔNG hardcode.
import { writeFileSync } from "node:fs";
import { loadCatalog, styleForIcon, validateDiagram } from "../src/core.mjs";
import { routeLR, routeTB } from "../src/layout.mjs";

const c = loadCatalog();
const cells = [];
const R = {}; // registry: id -> rect {x,y,w,h}
const COLW = 240;
const colOf = {}; // id -> column index (để tính khe giữa 2 cột)
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let auto = 0;
const nid = () => `e${++auto}`;

const FX = (i) => 350 + i * 320;
const BOXX = (i) => FX(i) + 20;
const ICONX = (i) => FX(i) + 96;
const BOXW = 200;
const ROWC = [250, 370, 490, 610];

function put(id, x, y, w, h, style, label) {
  R[id] = { x, y, w, h };
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
const iconAt = (id, name, col, row, label) => { colOf[id] = col; put(id, ICONX(col), ROWC[row] - 24, 48, 48, styleForIcon(c, name).style, label); };
const boxAt = (id, col, row, h, label, stroke) => {
  colOf[id] = col;
  put(id, BOXX(col), ROWC[row] - h / 2, BOXW, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${stroke};fontColor=#1A1A1A;fontSize=11;`, label);
};
const rawBox = (id, x, y, w, h, label, fill, stroke, fs = 11, fontStyle = 0) =>
  put(id, x, y, w, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;fontSize=${fs};fontStyle=${fontStyle};`, label);
const frame = (id, x, y, w, h, label, fill, stroke) =>
  put(id, x, y, w, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;verticalAlign=top;fontStyle=1;fontSize=12;fillOpacity=30;arcSize=2;`, label);
function text(id, x, y, w, h, label, fs = 14) {
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}

// Mọi nét gọi qua đây → tự định tuyến từ rect 2 đầu (không pin tay).
function link(src, tgt, label = "", { kind = "flow", dir = "LR" } = {}) {
  // khe đứng = giữa KHE TRẮNG: mép phải frame cột nguồn → mép trái node đích
  const laneX = colOf[src] != null ? (FX(colOf[src]) + COLW + R[tgt].x) / 2 : null;
  const r = dir === "TB" ? routeTB(R[src], R[tgt]) : routeLR(R[src], R[tgt], { laneX });
  let st = "edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;";
  st += kind === "fan" ? "rounded=0;" : "rounded=1;";
  if (kind === "dr") st += "dashed=1;startArrow=block;endArrow=block;strokeColor=#9A6A00;";
  if (label) st += "labelBackgroundColor=#FFFFFF;";
  st += r.pins;
  const geo = r.wp
    ? `<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="${r.wp.x}" y="${r.wp.y}"/></Array></mxGeometry>`
    : `<mxGeometry relative="1" as="geometry"/>`;
  cells.push(`<mxCell id="${nid()}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}">${geo}</mxCell>`);
}

text("title", 320, 24, 1320, 30, "DIH — Kiến trúc tổng thể On-Cloud / AWS (mục 4.0)  ·  Amazon EKS điều phối hợp nhất");

frame("src", 40, 200, 240, 420, "LỚP NGUỒN — 25 nguồn the bank", "#DAE8FC", "#6C8EBF");
rawBox("src_b", 60, 250, 200, 330, "Core Banking · Digital Banking · the bank Card · CRM · Loyalty · Risk DB · trung gian · kho dữ liệu\n\nNạp: Batch + Event Stream", "#FFFFFF", "#6C8EBF");

cells.push(`<mxCell id="aws" value="AWS Cloud — Multi-account (PROD/UAT/DEV) · Multi-AZ ≥3 · Terraform + ArgoCD" style="sketch=0;outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=1;container=1;pointerEvents=0;collapsible=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=34;fontColor=light-dark(#232F3E,#E8E8E8);dashed=0;" vertex="1" parent="1"><mxGeometry x="320" y="120" width="1340" height="900" as="geometry"/></mxCell>`);

frame("c0", FX(0), 180, 240, 580, "Lớp 1 · Thu thập", "#D5E8D4", "#82B366");
frame("c1", FX(1), 180, 240, 580, "Lớp 2 · Xử lý + điều phối", "#FFE6CC", "#D79B00");
frame("c2", FX(2), 180, 240, 580, "Lớp 3 · Lưu trữ", "#FFF2CC", "#D6B656");
frame("c3", FX(3), 180, 240, 580, "Lớp 5 · Tích hợp & Phục vụ", "#E1D5E7", "#9673A6");

boxAt("ing_spark", 0, 0, 50, "Apache Spark / Python\n(trích DB · on EKS)", "#82B366");
iconAt("ing_ds", "datasync", 0, 1, "AWS DataSync\n(batch tệp)");
iconAt("ing_kafka", "ec2", 0, 2, "Confluent Kafka\n(Event Stream · on EC2)");
boxAt("ing_dag", 0, 3, 44, "Dagster — điều phối thu thập", "#82B366");

boxAt("pr_spark", 1, 0, 56, "Apache Spark on EKS\n(Spark Operator · autoscaling)", "#D79B00");
boxAt("pr_dag", 1, 1, 44, "Dagster — orchestration", "#D79B00");
boxAt("pr_qc", 1, 2, 44, "Kiểm tra chất lượng + mã hóa PII", "#D79B00");

iconAt("st_s3", "s3", 2, 0, "Amazon S3 + Iceberg\n(raw/curated/serving)");
iconAt("st_rs", "redshift", 2, 1, "Amazon Redshift (MPP)");
iconAt("st_mem", "memorydb_for_redis", 2, 2, "Amazon MemoryDB");
boxAt("st_mongo", 2, 3, 44, "MongoDB on EKS (NoSQL)", "#D6B656");

boxAt("sv_star", 3, 0, 56, "Starburst / Trino on EKS\n(federated query)", "#9673A6");
boxAt("sv_spark", 3, 1, 44, "Apache Spark (integration)", "#9673A6");
boxAt("sv_ch", 3, 2, 56, "Kênh phục vụ\nAPI · Serving DB · File · Streaming", "#9673A6");

rawBox("cons", 1700, 185, 200, 130, "HỆ THỐNG TIÊU THỤ the bank\n\nBI · ứng dụng · hệ đích", "#DAE8FC", "#6C8EBF", 12, 1);

frame("cc", 350, 800, 1200, 200, "Lớp xuyên suốt (áp dụng cho toàn bộ pipeline phía trên)", "#EEEEEE", "#999999");
const cxi = [380, 560, 740, 920, 1100, 1280, 1460];
const ccIcon = (id, name, x, label) => put(id, x, 850, 48, 48, styleForIcon(c, name).style, label);
ccIcon("x_iam", "identity_and_access_management", cxi[0], "IAM / SSO");
ccIcon("x_kms", "key_management_service", cxi[1], "KMS");
ccIcon("x_sec", "secrets_manager", cxi[2], "Secrets Mgr");
ccIcon("x_cw", "cloudwatch_2", cxi[3], "CloudWatch");
ccIcon("x_os", "elasticsearch_service", cxi[4], "OpenSearch");
ccIcon("x_org", "organizations", cxi[5], "Organizations");
ccIcon("x_dx", "direct_connect", cxi[6], "Direct Connect");
rawBox("x_b1", 370, 935, 360, 44, "OPA (PDP) · OpenMetadata (Governance/Lineage)", "#FFFFFF", "#5A6B7B", 10);
rawBox("x_b2", 1120, 935, 300, 44, "Terraform (IaC) · ArgoCD (GitOps)", "#FFFFFF", "#5A6B7B", 10);

frame("op", 320, 1080, 1340, 150, "ON-PREMISE (the bank · Việt Nam) — SITE DR cho On-Cloud (Nghị định 13)", "#F0F0F0", "#666666");
rawBox("op_minio", 360, 1130, 380, 60, "MinIO  ↔  Amazon S3\n(đồng bộ dữ liệu)", "#FFFFFF", "#666666");
rawBox("op_meta", 780, 1130, 400, 60, "OpenMetadata\n(đồng bộ metadata 2 chiều)", "#FFFFFF", "#666666");
rawBox("op_proc", 1220, 1130, 400, 60, "Thu thập / Xử lý / Phục vụ\ndự phòng", "#FFFFFF", "#666666");

// ---- edges: chỉ khai báo nguồn→đích + nhãn; định tuyến tự lo ----
link("src", "ing_spark", "DB extract", { kind: "fan" });
link("src", "ing_ds", "Batch tệp", { kind: "fan" });
link("src", "ing_kafka", "Event Stream", { kind: "fan" });
link("ing_spark", "pr_spark");
link("ing_kafka", "pr_spark", "streaming");
link("pr_spark", "st_s3");
link("st_s3", "sv_star");
link("st_rs", "sv_star");
link("sv_star", "cons", "federated query");
link("sv_ch", "cons", "API/DB/File/Stream");
link("x_dx", "op", "Direct Connect: đồng bộ dữ liệu / metadata, DR", { kind: "dr", dir: "TB" });

// ---- assemble + validate ----
const xml =
  `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1960" pageHeight="1280" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  cells.join("") + `</root></mxGraphModel>`;
const file = new URL("../../4_oncloud_kit.drawio", import.meta.url);
writeFileSync(file, `<mxfile host="app.diagrams.net"><diagram name="4. On-Cloud AWS (kit)" id="oncloud-kit">${xml}</diagram></mxfile>`);
writeFileSync(new URL("./_last_model.xml", import.meta.url), xml);
const res = validateDiagram(c, xml, { strict: true });
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
