// DIH — CHƯƠNG 4: Kiến trúc tổng thể On-Cloud / AWS. type "pipeline".
// Layout engine: KHÔNG toạ độ hardcode. Bọc trong khung AWS Cloud, 9 lớp + Hybrid/DR.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("pipeline");
const BW = 200, BH = 46;
const svc = (id, label, stroke) => box(id, label, { w: BW, h: BH, stroke });          // phần mềm OSS trên EKS/EC2
const layer = (id, title, fill, stroke, items) => group(id, null, title, { dir: "col", gap: 14, fill, stroke }, items);
const bandBox = (id, label) => box(id, label, { w: 240, h: 42, fill: "#FFFFFF", stroke: "#5A6B7B", fs: 10 });

// ---- 4 tầng pipeline (phần tử đầu mỗi cột = trục chính → spine ngang thẳng) ----
const ingest = layer("c_ing", "Lớp 1 · Thu thập (2.2)", "#D5E8D4", "#82B366", [
  svc("ing_spark", "Apache Spark / Python (trích DB)", "#82B366"),
  icon("ing_ds", "datasync", "AWS DataSync (batch tệp)"),
  icon("ing_kafka", "ec2", "Confluent Kafka (Event Stream · EC2)"),
  svc("ing_dag", "Dagster — điều phối thu thập", "#82B366"),
]);
const process = layer("c_pr", "Lớp 2 · Xử lý (2.4)", "#FFE6CC", "#D79B00", [
  svc("pr_spark", "Apache Spark on EKS (Operator·autoscale)", "#D79B00"),
  svc("pr_dag", "Dagster — orchestration", "#D79B00"),
  svc("pr_qc", "Kiểm tra chất lượng + mã hóa PII", "#D79B00"),
]);
const storage = layer("c_st", "Lớp 3 · Lưu trữ (2.3)", "#FFF2CC", "#D6B656", [
  icon("st_s3", "s3", "Amazon S3 + Iceberg (zones)"),
  icon("st_rs", "redshift", "Amazon Redshift (MPP)"),
  icon("st_mem", "memorydb_for_redis", "Amazon MemoryDB (cache)"),
  svc("st_mongo", "MongoDB on EKS (NoSQL)", "#D6B656"),
]);
const serving = layer("c_sv", "Lớp 5 · Tích hợp & Phục vụ (2.7)", "#E1D5E7", "#9673A6", [
  svc("sv_star", "Starburst / Trino on EKS (federated)", "#9673A6"),
  svc("sv_spark", "Apache Spark (integration)", "#9673A6"),
  svc("sv_ch", "Kênh phục vụ: API · DB · File · Stream", "#9673A6"),
]);
const pipe = frame("pipe", "", { dir: "row", gap: 46, align: "top", header: 0, fill: "none", stroke: "none" },
  [ingest, process, storage, serving]);

// ---- lớp xuyên suốt (Lớp 4·6·7·8·9): hàng icon AWS + hàng box OSS ----
const cross = frame("cc", "Lớp xuyên suốt — Quản trị · Kiểm soát truy cập · Bảo mật · Giám sát · Tự động hóa", { dir: "col", gap: 16, fill: "#EEEEEE", stroke: "#999999" }, [
  frame("cc_ic", "", { dir: "row", gap: 28, header: 0, fill: "none", stroke: "none" }, [
    icon("x_iam", "identity_and_access_management", "IAM / SSO (+AD/LDAP)"),
    icon("x_kms", "key_management_service", "AWS KMS"),
    icon("x_sec", "secrets_manager", "Secrets Manager"),
    icon("x_cw", "cloudwatch_2", "CloudWatch"),
    icon("x_os", "elasticsearch_service", "OpenSearch"),
    icon("x_eks", "eks", "Amazon EKS"),
    icon("x_org", "organizations", "Organizations"),
    icon("x_dx", "direct_connect", "Direct Connect"),
  ]),
  frame("cc_bx", "", { dir: "row", gap: 22, header: 0, fill: "none", stroke: "none" }, [
    bandBox("x_om", "OpenMetadata — Governance / Lineage (đồng bộ 2 chiều)"),
    bandBox("x_opa", "OPA — Policy Decision Point (cell-level)"),
    bandBox("x_iac", "Terraform (IaC) · ArgoCD (GitOps)"),
  ]),
]);

// ---- khung AWS Cloud bọc pipeline + lớp xuyên suốt ----
const cloud = group("aws", "group_aws_cloud_alt",
  "AWS Cloud — Multi-account (PROD/UAT/DEV) · Multi-AZ ≥3 · Amazon EKS điều phối hợp nhất · Terraform + ArgoCD",
  { dir: "col", gap: 40 }, [pipe, cross]);

// ---- on-prem (SITE DR) ----
const onprem = frame("op", "ON-PREMISE (VCB · Việt Nam) — SITE DR cho On-Cloud (Nghị định 13)", { dir: "row", gap: 26, fill: "#F0F0F0", stroke: "#666666" }, [
  box("op_minio", "MinIO ↔ Amazon S3", { w: 210, h: 54 }),
  box("op_meta", "OpenMetadata (đồng bộ 2 chiều)", { w: 230, h: 54 }),
  box("op_proc", "Thu thập / Xử lý / Phục vụ dự phòng", { w: 240, h: 54 }),
]);

// ---- gốc: [Nguồn | AWS Cloud | Tiêu thụ] rồi On-prem ----
const tree = frame("root", "", { dir: "col", gap: 56, align: "left", header: 0, pad: 10, fill: "none", stroke: "none" }, [
  frame("band", "", { dir: "row", gap: 50, align: "center", header: 0, fill: "none", stroke: "none" }, [
    box("src", "LỚP NGUỒN\n25 nguồn VCB\n\nBatch + Event Stream", { w: 180, h: 160, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
    cloud,
    box("cons", "HỆ THỐNG TIÊU THỤ VCB\n\nBI · ứng dụng · hệ đích", { w: 180, h: 130, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
  ]),
  onprem,
]);

renderTree(d, tree, [40, 80]);
d.title("DIH — CHƯƠNG 4: Kiến trúc tổng thể On-Cloud / AWS (mục 4.0)");

// nguồn → thu thập (fan, góc vuông); spine cùng hàng → thẳng; phụ = 1 góc; DR
d.link("src", "ing_spark", "DB extract", { role: "fanout" });
d.link("src", "ing_ds", "Batch tệp", { role: "fanout" });
d.link("src", "ing_kafka", "Event Stream", { role: "fanout" });
d.link("ing_spark", "pr_spark");
d.link("pr_spark", "st_s3");
d.link("st_s3", "sv_star");
d.link("sv_star", "cons", "federated query");
d.link("ing_kafka", "pr_spark", "streaming");
d.link("st_rs", "sv_star");
d.link("sv_ch", "cons", "API/DB/File/Stream");
d.link("x_dx", "op", "Direct Connect (đồng bộ dữ liệu / metadata, DR)", { dir: "TB" });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../out/4_oncloud_kit.drawio", import.meta.url), d.mxfile("4. On-Cloud AWS (kit)"));
