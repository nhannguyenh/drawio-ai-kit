// Layered data analytics pipeline — type "pipeline". A GENERIC template (no project specifics).
// Layout engine: no hardcoded coordinates; boxes auto-size to their labels.
// Pattern: Sources → [Ingest → Process → Store → Serve] inside AWS Cloud + a cross-cutting band → Consumers.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("pipeline");
// Restrained palette: NEUTRAL light-grey frames everywhere; the AWS icons carry the color.
// (Don't give each layer its own bright fill — that reads as "rainbow" / cluttered.)
const FRAME = ["#F5F5F5", "#999999"];
const layer = (id, title, items) => group(id, null, title, { dir: "col", gap: 16, fill: FRAME[0], stroke: FRAME[1] }, items);

// spine = first item of each layer (kept on the same row → straight horizontal flow)
const ingest = layer("ing", "1 · Ingest", [
  icon("kds", "kinesis_data_streams", "Kinesis Data Streams"),
  icon("msk", "managed_streaming_for_kafka", "Amazon MSK"),
  icon("ds", "datasync", "AWS DataSync"),
]);
const process = layer("pr", "2 · Process", [
  icon("emr", "emr", "Amazon EMR / Spark"),
  icon("glue", "glue", "AWS Glue (ETL)"),
  icon("lambda", "lambda", "Lambda"),
]);
const store = layer("st", "3 · Store", [
  icon("s3", "s3", "S3 (data lake)"),
  icon("redshift", "redshift", "Redshift"),
  icon("ddb", "dynamodb", "DynamoDB"),
]);
const serve = layer("sv", "4 · Serve", [
  icon("athena", "athena", "Athena"),
  icon("os", "elasticsearch_service", "OpenSearch"),
  icon("qs", "quicksight", "QuickSight"),
]);

const band = frame("band", "Governance · Security · Monitoring (cross-cutting)", { dir: "row", gap: 36, fill: "#EEEEEE", stroke: "#999999" }, [
  icon("iam", "identity_and_access_management", "IAM"),
  icon("kms", "key_management_service", "KMS"),
  icon("lf", "lake_formation", "Lake Formation"),
  icon("gdc", "glue_data_catalog", "Glue Data Catalog"),
  icon("cw", "cloudwatch_2", "CloudWatch"),
]);

const cloud = group("aws", "group_aws_cloud_alt", "AWS Cloud", { dir: "col", gap: 36 }, [
  frame("pipe", "", { dir: "row", gap: 50, align: "top", header: 0, fill: "none", stroke: "none" }, [ingest, process, store, serve]),
  band,
]);

const tree = frame("root", "", { dir: "row", gap: 50, align: "center", header: 0, pad: 10, fill: "none", stroke: "none" }, [
  box("src", "DATA SOURCES\n\nDB · apps · files\n· event streams", { fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
  cloud,
  box("cons", "CONSUMERS\n\nBI · ML · apps", { fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
]);

renderTree(d, tree, [40, 80]);
d.title("Layered data analytics pipeline — type: pipeline");

d.link("src", "kds", "stream", { role: "fanout" });
d.link("src", "msk", "events", { role: "fanout" });
d.link("src", "ds", "batch", { role: "fanout" });
d.link("kds", "emr", "ingest", { flow: true });   // spine (top row, straight) — animated flow
d.link("emr", "s3", "process", { flow: true });
d.link("s3", "athena", "query", { flow: true });
d.link("athena", "cons", "results");
d.link("s3", "os", "", { role: "fanout" });
d.link("os", "cons", "search");
d.link("qs", "cons", "dashboards");

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../out/pipeline_kit.drawio", import.meta.url), d.mxfile("Data pipeline (pipeline)"));
