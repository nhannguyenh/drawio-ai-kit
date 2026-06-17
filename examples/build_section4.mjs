// DIH On-Cloud tổng thể (mục 4.0) — type "pipeline". Layout engine: KHÔNG toạ độ hardcode.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("pipeline");
const BW = 210, BH = 48; // box dịch vụ OSS
const svc = (id, label, stroke) => box(id, label, { w: BW, h: BH, stroke });
const layer = (id, title, fill, stroke, items) => group(id, null, title, { dir: "col", gap: 16, fill, stroke }, items);

// Cột theo tầng; PHẦN TỬ ĐẦU mỗi cột = trục chính (row0) → engine top-align → nét spine thẳng
const ingest = layer("c_ing", "Lớp 1 · Thu thập", "#D5E8D4", "#82B366", [
  svc("ing_spark", "Apache Spark / Python (DB)", "#82B366"),
  icon("ing_ds", "datasync", "AWS DataSync"),
  icon("ing_kafka", "ec2", "Confluent Kafka (EC2)"),
  svc("ing_dag", "Dagster — điều phối", "#82B366"),
]);
const process = layer("c_pr", "Lớp 2 · Xử lý", "#FFE6CC", "#D79B00", [
  svc("pr_spark", "Apache Spark on EKS", "#D79B00"),
  svc("pr_dag", "Dagster — orchestration", "#D79B00"),
  svc("pr_qc", "Chất lượng + mã hóa PII", "#D79B00"),
]);
const storage = layer("c_st", "Lớp 3 · Lưu trữ", "#FFF2CC", "#D6B656", [
  icon("st_s3", "s3", "S3 + Iceberg"),
  icon("st_rs", "redshift", "Redshift (MPP)"),
  icon("st_mem", "memorydb_for_redis", "MemoryDB"),
  svc("st_mongo", "MongoDB on EKS", "#D6B656"),
]);
const serving = layer("c_sv", "Lớp 5 · Tích hợp & Phục vụ", "#E1D5E7", "#9673A6", [
  svc("sv_star", "Starburst / Trino on EKS", "#9673A6"),
  svc("sv_spark", "Apache Spark (integration)", "#9673A6"),
  svc("sv_ch", "Kênh: API · DB · File · Stream", "#9673A6"),
]);

const pipeline = frame("pipe", "", { dir: "row", gap: 56, align: "top", header: 0, fill: "none", stroke: "none" }, [
  box("src", "LỚP NGUỒN\n25 nguồn VCB\n(Batch + Event Stream)", { w: 180, h: 150, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
  ingest, process, storage, serving,
  box("cons", "HỆ TIÊU THỤ VCB\n(BI · ứng dụng · hệ đích)", { w: 170, h: 120, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
]);

const cross = frame("cc", "Lớp xuyên suốt (áp dụng toàn pipeline)", { dir: "row", gap: 34, fill: "#EEEEEE", stroke: "#999999" }, [
  icon("x_iam", "identity_and_access_management", "IAM / SSO"),
  icon("x_kms", "key_management_service", "KMS"),
  icon("x_sec", "secrets_manager", "Secrets Mgr"),
  icon("x_cw", "cloudwatch_2", "CloudWatch"),
  icon("x_os", "elasticsearch_service", "OpenSearch"),
  icon("x_org", "organizations", "Organizations"),
  icon("x_dx", "direct_connect", "Direct Connect"),
]);

const onprem = frame("op", "ON-PREMISE (VCB · VN) — SITE DR (Nghị định 13)", { dir: "row", gap: 30, fill: "#F0F0F0", stroke: "#666666" }, [
  box("op_minio", "MinIO ↔ Amazon S3", { w: 220, h: 56 }),
  box("op_meta", "OpenMetadata (đồng bộ 2 chiều)", { w: 240, h: 56 }),
  box("op_proc", "Thu thập/Xử lý/Phục vụ dự phòng", { w: 240, h: 56 }),
]);

const tree = frame("root", "", { dir: "col", gap: 50, align: "left", header: 0, pad: 10, fill: "none", stroke: "none" },
  [pipeline, cross, onprem]);

renderTree(d, tree, [40, 80]);
d.title("DIH — Kiến trúc tổng thể On-Cloud / AWS (mục 4.0) — type: pipeline");

// fan từ nguồn (pin theo đích → ngang thẳng); spine cùng hàng → thẳng; phụ = 1 góc
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
d.link("x_dx", "op", "Direct Connect", { dir: "TB" });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../../4_oncloud_kit.drawio", import.meta.url), d.mxfile("4. On-Cloud AWS (kit)"));
