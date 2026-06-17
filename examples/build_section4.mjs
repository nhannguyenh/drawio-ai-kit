// Demo v3: sơ đồ tổng thể On-Cloud (mục 4.0) bằng kit.
// Sửa: (1) hộp con hẹp hơn cột (không chờm); (2) trục chính cùng một Y → nét thẳng tắp.
import { writeFileSync } from "node:fs";
import { loadCatalog, styleForIcon, validateDiagram } from "../src/core.mjs";

const c = loadCatalog();
const cells = [];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let auto = 0;
const nid = (p = "n") => `${p}${++auto}`;

// ---- grid: cột rộng 240, hộp con rộng 200 (padding 20), icon canh giữa ----
const FX = (i) => 350 + i * 320;          // mép trái cột (= frame)
const BOXX = (i) => FX(i) + 20;           // hộp con: chừa 20px mỗi bên
const ICONX = (i) => FX(i) + 96;          // icon 48 canh giữa cột 240
const BOXW = 200;
const ROWC = [250, 370, 490, 610];        // tâm Y các hàng (dùng chung mọi cột)

function iconAt(id, name, col, row, label) {
  const s = styleForIcon(c, name);
  if (!s) throw new Error("missing icon " + name);
  const y = ROWC[row] - 24;
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${s.style}" vertex="1" parent="1"><mxGeometry x="${ICONX(col)}" y="${y}" width="48" height="48" as="geometry"/></mxCell>`);
}
function boxAt(id, col, row, h, label, stroke) {
  const y = ROWC[row] - h / 2;
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${stroke};fontColor=#1A1A1A;fontSize=11;" vertex="1" parent="1"><mxGeometry x="${BOXX(col)}" y="${y}" width="${BOXW}" height="${h}" as="geometry"/></mxCell>`);
}
function rawBox(id, x, y, w, h, label, fill, stroke, fs = 11, fontStyle = 0) {
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;fontSize=${fs};fontStyle=${fontStyle};" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
function frame(id, x, y, w, h, label, fill, stroke) {
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;verticalAlign=top;fontStyle=1;fontSize=12;fillOpacity=30;arcSize=2;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
function text(id, x, y, w, h, label, fs = 14) {
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
function edge(src, tgt, label, kind, pin = "") {
  let st = "edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;";
  st += kind === "fan" ? "rounded=0;" : "rounded=1;";
  if (kind === "dr") st += "dashed=1;startArrow=block;endArrow=block;strokeColor=#9A6A00;";
  if (label) st += "labelBackgroundColor=#FFFFFF;";
  st += pin;
  cells.push(`<mxCell id="${nid("e")}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
}

text("title", 320, 24, 1320, 30, "DIH — Kiến trúc tổng thể On-Cloud / AWS (mục 4.0)  ·  Amazon EKS điều phối hợp nhất");

// Sources (cao 420: 200..620, tâm 410)
frame("src", 40, 200, 240, 420, "LỚP NGUỒN — 25 nguồn the bank", "#DAE8FC", "#6C8EBF");
rawBox("src_b", 60, 250, 200, 330, "Core Banking · Digital Banking · the bank Card · CRM · Loyalty · Risk DB · trung gian · kho dữ liệu\n\nNạp: Batch + Event Stream", "#FFFFFF", "#6C8EBF");

// AWS frame
cells.push(`<mxCell id="aws" value="AWS Cloud — Multi-account (PROD/UAT/DEV) · Multi-AZ ≥3 · Terraform + ArgoCD" style="sketch=0;outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=1;container=1;pointerEvents=0;collapsible=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=34;fontColor=light-dark(#232F3E,#E8E8E8);dashed=0;" vertex="1" parent="1"><mxGeometry x="320" y="120" width="1340" height="900" as="geometry"/></mxCell>`);

// Cột (frame cao 580: 180..760)
frame("c0", FX(0), 180, 240, 580, "Lớp 1 · Thu thập", "#D5E8D4", "#82B366");
frame("c1", FX(1), 180, 240, 580, "Lớp 2 · Xử lý + điều phối", "#FFE6CC", "#D79B00");
frame("c2", FX(2), 180, 240, 580, "Lớp 3 · Lưu trữ", "#FFF2CC", "#D6B656");
frame("c3", FX(3), 180, 240, 580, "Lớp 5 · Tích hợp & Phục vụ", "#E1D5E7", "#9673A6");

// Hàng 0 = TRỤC CHÍNH (cùng tâm Y=250 → nét thẳng): ing_spark → pr_spark → st_s3 → sv_star → cons
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

// Consumers (ngoài AWS, tâm Y=250 để nét thẳng từ sv_star)
rawBox("cons", 1700, 250 - 65, 200, 130, "HỆ THỐNG TIÊU THỤ the bank\n\nBI · ứng dụng · hệ đích", "#DAE8FC", "#6C8EBF", 12, 1);

// Cross-cutting
frame("cc", 350, 800, 1200, 200, "Lớp xuyên suốt (áp dụng cho toàn bộ pipeline phía trên)", "#EEEEEE", "#999999");
const cxi = [380, 560, 740, 920, 1100, 1280, 1460];
const ccIcon = (id, name, x, label) => {
  const s = styleForIcon(c, name);
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${s.style}" vertex="1" parent="1"><mxGeometry x="${x}" y="850" width="48" height="48" as="geometry"/></mxCell>`);
};
ccIcon("x_iam", "identity_and_access_management", cxi[0], "IAM / SSO");
ccIcon("x_kms", "key_management_service", cxi[1], "KMS");
ccIcon("x_sec", "secrets_manager", cxi[2], "Secrets Mgr");
ccIcon("x_cw", "cloudwatch_2", cxi[3], "CloudWatch");
ccIcon("x_os", "elasticsearch_service", cxi[4], "OpenSearch");
ccIcon("x_org", "organizations", cxi[5], "Organizations");
ccIcon("x_dx", "direct_connect", cxi[6], "Direct Connect");
rawBox("x_b1", 370, 935, 360, 44, "OPA (PDP) · OpenMetadata (Governance/Lineage)", "#FFFFFF", "#5A6B7B", 10);
rawBox("x_b2", 1120, 935, 300, 44, "Terraform (IaC) · ArgoCD (GitOps)", "#FFFFFF", "#5A6B7B", 10);

// On-prem DR
frame("op", 320, 1080, 1340, 150, "ON-PREMISE (the bank · Việt Nam) — SITE DR cho On-Cloud (Nghị định 13)", "#F0F0F0", "#666666");
rawBox("op_minio", 360, 1130, 380, 60, "MinIO  ↔  Amazon S3\n(đồng bộ dữ liệu)", "#FFFFFF", "#666666");
rawBox("op_meta", 780, 1130, 400, 60, "OpenMetadata\n(đồng bộ metadata 2 chiều)", "#FFFFFF", "#666666");
rawBox("op_proc", 1220, 1130, 400, 60, "Thu thập / Xử lý / Phục vụ\ndự phòng", "#FFFFFF", "#666666");

// ---- edges ----
// src fan: pin exitY theo tâm từng đích (src 200..620, h=420) → 3 nét ngang thẳng
const eyOf = (rc) => ((rc - 200) / 420).toFixed(3);
const entL = "entryX=0;entryY=0.5;entryDx=0;entryDy=0;";
edge("src", "ing_spark", "DB extract", "fan", `exitX=1;exitY=${eyOf(ROWC[0])};exitDx=0;exitDy=0;${entL}`);
edge("src", "ing_ds", "Batch tệp", "fan", `exitX=1;exitY=${eyOf(ROWC[1])};exitDx=0;exitDy=0;${entL}`);
edge("src", "ing_kafka", "Event Stream", "fan", `exitX=1;exitY=${eyOf(ROWC[2])};exitDx=0;exitDy=0;${entL}`);
// trục chính: cùng Y → thẳng tắp
const straight = "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;";
edge("ing_spark", "pr_spark", "", "flow", straight);
edge("pr_spark", "st_s3", "", "flow", straight);
edge("st_s3", "sv_star", "", "flow", straight);
edge("sv_star", "cons", "federated query", "flow", straight);
// phụ
edge("ing_kafka", "pr_spark", "streaming", "flow", "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.7;entryDx=0;entryDy=0;");
edge("st_rs", "sv_star", "", "flow", "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.7;entryDx=0;entryDy=0;");
edge("sv_ch", "cons", "API/DB/File/Stream", "flow", "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.85;entryDx=0;entryDy=0;");
// DR
edge("x_dx", "op", "Direct Connect: đồng bộ dữ liệu / metadata, DR", "dr",
  "exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.87;entryY=0;entryDx=0;entryDy=0;");

// ---- assemble + validate ----
const inner = cells.join("");
const xml =
  `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1960" pageHeight="1280" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  inner + `</root></mxGraphModel>`;
const file = new URL("../../4_oncloud_kit.drawio", import.meta.url);
writeFileSync(file, `<mxfile host="app.diagrams.net"><diagram name="4. On-Cloud AWS (kit)" id="oncloud-kit">${xml}</diagram></mxfile>`);
writeFileSync(new URL("./_last_model.xml", import.meta.url), xml);
const res = validateDiagram(c, xml, { strict: true });
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
