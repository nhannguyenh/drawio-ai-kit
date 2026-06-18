// CHAPTER 4 — DIH On-Cloud / AWS. 10 diagrams (4.0 overview + 9 layers) in ONE .drawio file.
// Built with the latest drawio-ai-kit: layout engine (no hardcoded coords), square frames,
// spine-first straight flow, fan-out/fan-in combs, geometry-validated.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, box, renderTree } from "../src/layout-engine.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const oss = (id, label, stroke) => box(id, label, { w: 200, h: 46, fill: "#FFFFFF", stroke: stroke || "#5A6B7B", fs: 10 });
const note = (id, label) => box(id, label, { w: 230, h: 42, fill: "#FFFFFF", stroke: "#5A6B7B", fs: 10 });
const srcBox = (id, label) => box(id, label, { w: 160, h: 120, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true });

const pages = [];
const add = (name, d) => pages.push({ name, d });

/* ---------------- 4.0 — Tổng quan On-Cloud ---------------- */
{
  const d = new Diagram("pipeline");
  const layer = (id, title, fill, stroke, items) => group(id, null, title, { dir: "col", gap: 14, fill, stroke }, items);
  const ingest = layer("c_ing", "Lớp 1 · Thu thập", "#D5E8D4", "#82B366", [
    oss("ing_spark", "Spark / Python (DB extract)", "#82B366"),
    icon("ing_ds", "datasync", "AWS DataSync"),
    icon("ing_kafka", "ec2", "Confluent Kafka (EC2)"),
  ]);
  const proc = layer("c_pr", "Lớp 2 · Xử lý", "#FFE6CC", "#D79B00", [
    oss("pr_spark", "Spark on EKS", "#D79B00"),
    oss("pr_dag", "Dagster orchestration", "#D79B00"),
    oss("pr_qc", "Quality + PII masking", "#D79B00"),
  ]);
  const store = layer("c_st", "Lớp 3 · Lưu trữ", "#FFF2CC", "#D6B656", [
    icon("st_s3", "s3", "S3 + Iceberg"),
    icon("st_rs", "redshift", "Redshift"),
    icon("st_mem", "memorydb_for_redis", "MemoryDB"),
  ]);
  const serve = layer("c_sv", "Lớp 5 · Tích hợp & Phục vụ", "#E1D5E7", "#9673A6", [
    oss("sv_star", "Starburst / Trino on EKS", "#9673A6"),
    oss("sv_ch", "API · DB · File · Stream", "#9673A6"),
  ]);
  const cross = frame("cc", "Lớp xuyên suốt — Quản trị · Truy cập · Bảo mật · Giám sát · Tự động hoá", { dir: "row", gap: 26, fill: "#EEEEEE", stroke: "#999999" }, [
    icon("x_iam", "identity_and_access_management", "IAM / SSO"),
    icon("x_kms", "key_management_service", "KMS"),
    icon("x_sec", "secrets_manager", "Secrets Manager"),
    icon("x_cw", "cloudwatch_2", "CloudWatch"),
    icon("x_os", "elasticsearch_service", "OpenSearch"),
    icon("x_eks", "eks", "Amazon EKS"),
    icon("x_org", "organizations", "Organizations"),
  ]);
  const cloud = group("aws", "group_aws_cloud_alt", "AWS Cloud — Multi-account · Multi-AZ ≥3 · EKS điều phối · Terraform + ArgoCD", { dir: "col", gap: 36 }, [
    frame("pipe", "", { dir: "row", gap: 46, align: "top", header: 0, fill: "none", stroke: "none" }, [ingest, proc, store, serve]),
    cross,
  ]);
  const onprem = frame("op", "ON-PREMISE (VCB) — SITE DR cho On-Cloud", { dir: "row", gap: 26, fill: "#F0F0F0", stroke: "#666666" }, [
    note("op_minio", "MinIO ↔ Amazon S3"),
    note("op_meta", "OpenMetadata (đồng bộ 2 chiều)"),
    note("op_dr", "Thu thập / Xử lý / Phục vụ dự phòng"),
  ]);
  const tree = frame("root", "", { dir: "col", gap: 50, align: "left", header: 0, pad: 10, fill: "none", stroke: "none" }, [
    frame("band", "", { dir: "row", gap: 50, align: "center", header: 0, fill: "none", stroke: "none" }, [
      srcBox("src", "LỚP NGUỒN\n25 nguồn VCB\n\nBatch + Stream"),
      cloud,
      box("cons", "TIÊU THỤ\n\nBI · ứng dụng\n· hệ đích", { w: 150, h: 120, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
    ]),
    onprem,
  ]);
  renderTree(d, tree, [40, 80]);
  d.title("4.0 — Kiến trúc tổng thể On-Cloud / AWS");
  d.link("src", "ing_spark", "DB", { role: "fanout" });
  d.link("src", "ing_ds", "Batch", { role: "fanout" });
  d.link("src", "ing_kafka", "Stream", { role: "fanout" });
  d.link("ing_spark", "pr_spark");
  d.link("pr_spark", "st_s3");
  d.link("st_s3", "sv_star");
  d.link("sv_star", "cons", "federated");
  d.link("sv_ch", "cons", "serving");
  d.link("x_eks", "op", "Direct Connect (DR)", { dir: "TB" });
  add("4.0 Tổng quan On-Cloud", d);
}

/* ---------------- helper for a single-layer "Region → EKS" diagram ---------------- */
function layerDiagram({ title, sources, eksLabel, eksItems, sinks, links }) {
  const d = new Diagram("pipeline");
  const left = sources.length
    ? frame("srcs", "", { dir: "col", gap: 20, header: 0, fill: "none", stroke: "none" }, sources)
    : null;
  const eks = group("eks", "group_aws_cloud_alt", eksLabel, { dir: "col", gap: 14 }, eksItems);
  const right = sinks.length
    ? frame("sinks", "", { dir: "col", gap: 20, header: 0, fill: "none", stroke: "none" }, sinks)
    : null;
  const row = [left, eks, right].filter(Boolean);
  const tree = group("region", "group_region", "AWS Region (ap-southeast-1) — Amazon EKS, Multi-AZ ≥3", { dir: "row", gap: 70, align: "center" }, row);
  renderTree(d, tree, [40, 80]);
  d.title(title);
  for (const [s, t, label, opt] of links) d.link(s, t, label || "", opt || {});
  return d;
}

/* 4.1 Thu thập */
add("4.1 Thu thập", layerDiagram({
  title: "4.1 — Lớp 1 · Thu thập dữ liệu (Data Ingestion)",
  sources: [srcBox("src", "HỆ THỐNG NGUỒN\n25 nguồn VCB\n\nBatch + Event Stream")],
  eksLabel: "Amazon EKS — Ingestion (node group, Multi-AZ)",
  eksItems: [
    oss("spark", "Spark / Python — DB extract · CDC", "#82B366"),
    icon("ds", "datasync", "AWS DataSync (batch tệp)"),
    icon("kafka", "ec2", "Confluent Kafka (Event Stream · EC2)"),
    oss("dag", "Dagster — điều phối thu thập", "#82B366"),
  ],
  sinks: [icon("s3", "s3", "S3 (raw / landing)")],
  links: [
    ["src", "spark", "JDBC / CDC", { role: "fanout" }],
    ["src", "ds", "tệp", { role: "fanout" }],
    ["src", "kafka", "events", { role: "fanout" }],
    ["spark", "s3"], ["ds", "s3"], ["kafka", "s3"],
  ],
}));

/* 4.2 Xử lý */
add("4.2 Xử lý", layerDiagram({
  title: "4.2 — Lớp 2 · Xử lý dữ liệu (Data Processing) & điều phối",
  sources: [icon("raw", "s3", "S3 (raw)"), icon("kafka", "ec2", "Kafka (stream)")],
  eksLabel: "Amazon EKS — Processing (Spark Operator, autoscale)",
  eksItems: [
    oss("spark", "Spark (batch + structured streaming)", "#D79B00"),
    oss("dag", "Dagster — orchestration", "#D79B00"),
    oss("qc", "Quality checks + PII masking", "#D79B00"),
    oss("meta", "OpenMetadata — lineage", "#D79B00"),
  ],
  sinks: [icon("cur", "s3", "S3 (curated / gold)"), icon("quar", "s3", "S3 (quarantine)")],
  links: [
    ["raw", "spark", "đọc"], ["kafka", "spark", "streaming"],
    ["spark", "cur", "ghi"], ["spark", "quar", "bản ghi lỗi", { dash: true }],
  ],
}));

/* 4.3 Lưu trữ */
add("4.3 Lưu trữ", layerDiagram({
  title: "4.3 — Lớp 3 · Lưu trữ dữ liệu (Data Storage)",
  sources: [oss("spark", "Từ Lớp 2 — Spark (ghi)", "#82B366")],
  eksLabel: "Lưu trữ trên AWS — Lakehouse + DWH + cache",
  eksItems: [
    icon("s3", "s3", "S3 + Iceberg (zones)"),
    icon("rs", "redshift", "Redshift (MPP DWH)"),
    icon("mem", "memorydb_for_redis", "MemoryDB (cache)"),
    oss("mongo", "MongoDB on EKS (NoSQL)", "#D6B656"),
  ],
  sinks: [icon("bk", "s3", "AWS Backup / snapshot")],
  links: [
    ["spark", "s3", "ghi dữ liệu thô"],
    ["s3", "rs", "", { role: "fanout" }],
    ["s3", "mem", "", { role: "fanout" }],
    ["s3", "mongo", "", { role: "fanout" }],
    ["s3", "bk", "snapshot", { dir: "TB", dash: true }],
  ],
}));

/* 4.4 Quản trị dữ liệu */
add("4.4 Quản trị dữ liệu", layerDiagram({
  title: "4.4 — Lớp 4 · Quản trị dữ liệu (Data Governance)",
  sources: [],
  eksLabel: "Amazon EKS — OpenMetadata (Multi-AZ)",
  eksItems: [
    oss("om", "OpenMetadata — Application", "#9673A6"),
    oss("db", "Metadata Database", "#9673A6"),
    icon("os", "elasticsearch_service", "OpenSearch (catalog index)"),
    oss("dce", "Data Contract Extension", "#9673A6"),
  ],
  sinks: [
    icon("dx", "direct_connect", "Direct Connect"),
    box("onp", "On-Premise OpenMetadata\n(đồng bộ 2 chiều)", { w: 200, h: 70, fill: "#F0F0F0", stroke: "#666666" }),
  ],
  links: [
    ["om", "dx", "API OpenMetadata"],
    ["dx", "onp", "metadata 2 chiều", { dash: true }],
  ],
}));

/* 4.5 Tích hợp & Phục vụ */
add("4.5 Tích hợp & Phục vụ", layerDiagram({
  title: "4.5 — Lớp 5 · Tích hợp & Phục vụ (Integration & Serving)",
  sources: [icon("s3", "s3", "S3 / Iceberg"), icon("rs", "redshift", "Redshift"), oss("mongo", "MongoDB (EKS)", "#9673A6")],
  eksLabel: "Amazon EKS — Federated serving",
  eksItems: [
    oss("star", "Starburst / Trino — federated query", "#9673A6"),
    oss("spark", "Spark — integration", "#9673A6"),
    oss("ch", "Kênh phục vụ: API · DB · File · Stream", "#9673A6"),
  ],
  sinks: [box("cons", "HỆ THỐNG TIÊU THỤ VCB\n\nBI · ứng dụng · hệ đích", { w: 170, h: 120, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true })],
  links: [
    ["s3", "star", "", { role: "fanout" }], ["rs", "star", "", { role: "fanout" }], ["mongo", "spark", ""],
    ["star", "cons", "federated query"], ["ch", "cons", "API/DB/File/Stream"],
  ],
}));

/* 4.6 Giám sát */
add("4.6 Giám sát", layerDiagram({
  title: "4.6 — Lớp 6 · Quản trị, giám sát & cảnh báo",
  sources: [box("cfg", "Toàn bộ cấu phần DIH\n(Spark · Dagster · Starburst ·\nOpenMetadata · Kafka)", { w: 190, h: 90, fill: "#F0F0F0", stroke: "#666666" })],
  eksLabel: "Amazon EKS — Logging & Monitoring (+ CloudWatch hạ tầng)",
  eksItems: [
    oss("lm", "Logging & Monitoring cluster (TSDB · dashboard · alertmanager)", "#9673A6"),
    icon("cw", "cloudwatch_2", "CloudWatch (managed)"),
  ],
  sinks: [
    icon("s3", "s3", "S3 (log dài hạn)"),
    icon("sns", "sns", "SNS → Email / Ticket / ChatOps"),
  ],
  links: [
    ["cfg", "lm", "push metric/log"],
    ["lm", "s3", "log dài hạn"], ["lm", "sns", "cảnh báo", { dash: true }],
  ],
}));

/* 4.7 Kiểm soát truy cập */
add("4.7 Kiểm soát truy cập", layerDiagram({
  title: "4.7 — Lớp 7 · Quản trị & kiểm soát truy cập (Access Control)",
  sources: [icon("iam", "identity_and_access_management", "IAM / SSO (+ AD/LDAP)")],
  eksLabel: "Amazon EKS — Policy enforcement",
  eksItems: [
    oss("opa", "OPA — Policy Decision Point (cell-level)", "#9673A6"),
    oss("pep", "Starburst — Policy Enforcement Point", "#9673A6"),
    oss("cls", "OpenMetadata — phân loại (classification)", "#9673A6"),
  ],
  sinks: [box("data", "Đối tượng dữ liệu\n(S3 · Redshift · MongoDB)", { w: 190, h: 80, fill: "#FFF2CC", stroke: "#D6B656" })],
  links: [
    ["iam", "opa", "yêu cầu truy cập"],
    ["opa", "pep", "quyết định"], ["pep", "data", "thực thi"],
    ["cls", "opa", "", { dash: true }],
  ],
}));

/* 4.8 Bảo mật */
add("4.8 Bảo mật", layerDiagram({
  title: "4.8 — Lớp 8 · Bảo mật (Security)",
  sources: [box("net", "Lưu lượng nội bộ &\nra/vào hệ thống", { w: 170, h: 70, fill: "#F0F0F0", stroke: "#666666" })],
  eksLabel: "Amazon EKS — Dịch vụ DIH (mã hoá in-transit/at-rest)",
  eksItems: [
    oss("svc", "DIH services (Spark · Starburst · OpenMetadata …)", "#9673A6"),
    icon("kms", "key_management_service", "AWS KMS (at-rest)"),
    icon("sec", "secrets_manager", "Secrets Manager"),
  ],
  sinks: [
    box("store", "Kho dữ liệu\n(S3 · Redshift · MemoryDB · EBS)", { w: 190, h: 80, fill: "#FFF2CC", stroke: "#D6B656" }),
    box("sdlc", "Secure SDLC — Terraform / ArgoCD", { w: 190, h: 56, fill: "#F0F0F0", stroke: "#666666" }),
  ],
  links: [
    ["net", "svc", "TLS 1.2+ (in-transit)"],
    ["svc", "store", "mã hoá AES-256"],
    ["kms", "store", "khoá mã hoá", { dir: "TB", dash: true }],
  ],
}));

/* 4.9 Tự động hoá */
add("4.9 Tự động hoá", layerDiagram({
  title: "4.9 — Lớp 9 · Tự động hoá & quản lý hạ tầng",
  sources: [box("git", "Git — trạng thái mong muốn\n(IaC + GitOps)", { w: 180, h: 70, fill: "#F0F0F0", stroke: "#666666" })],
  eksLabel: "AWS Organizations — Landing Zone (multi-account)",
  eksItems: [
    oss("argo", "ArgoCD — GitOps", "#82B366"),
    oss("tf", "Terraform — IaC", "#82B366"),
    icon("ekscp", "eks", "Amazon EKS (control plane)"),
    icon("org", "organizations", "Organizations (PROD/UAT/DEV)"),
  ],
  sinks: [
    icon("dx", "direct_connect", "Direct Connect"),
    box("onp", "On-Premise (DR)", { w: 170, h: 60, fill: "#F0F0F0", stroke: "#666666" }),
  ],
  links: [
    ["git", "argo", "đồng bộ"],
    ["argo", "ekscp", "deploy"], ["tf", "org", "provision"],
    ["org", "dx", ""], ["dx", "onp", "DR", { dash: true }],
  ],
}));

/* ---------------- combine 10 pages into one .drawio ---------------- */
let allOk = true;
for (const { name, d } of pages) {
  const r = d.validate();
  if (!r.ok || r.audit.advice.length) allOk = false;
  console.log(`${r.ok ? "OK " : "ERR"} ${name}  err=${r.errors.length} warn=${r.warnings.length} advice=${r.audit.advice.length}` + (r.audit.advice.length ? "\n   - " + r.audit.advice.join("\n   - ") : ""));
}
const xml = `<mxfile host="app.diagrams.net">` +
  pages.map(({ name, d }, i) => `<diagram name="${esc(name)}" id="p${i}">${d.toXML()}</diagram>`).join("") +
  `</mxfile>`;
writeFileSync(new URL("../../04_Chapter4_DIH_AWS_v2.drawio", import.meta.url), xml);
console.log(`\nWrote 04_Chapter4_DIH_AWS_v2.drawio (${pages.length} diagrams). allClean=${allOk}`);
