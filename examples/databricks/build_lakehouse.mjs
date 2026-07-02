// Databricks Lakehouse — GENERIC template. Medallion pipeline: Sources → Lakeflow ingest →
// Delta medallion (Bronze → Silver → Gold) → Serving → BI, all governed by Unity Catalog.
// Clean house style: white frames, identity via borders + icons (no filled backgrounds).
// Run: node examples/databricks/build_lakehouse.mjs
import { writeFileSync } from "node:fs";
import { Diagram } from "../../src/builder.mjs";
import { frame, icon, box, renderTree } from "../../src/layout-engine.mjs";

const d = new Diagram("pipeline");
const RED = "#FF3621";  // Databricks accent — on borders only

const stage = (id, label, kids, stroke = "#B0B0B0") => frame(id, label, { dir: "col", gap: 12, stroke }, kids);

const sources = stage("src", "Sources", [
  icon("kafka", "kafka", "Kafka (events)"),
  icon("oltp", "mysql", "OLTP DB"),
  icon("files", "s3", "Files / object store"),
]);
const ingest = stage("ingest", "Ingestion — Lakeflow", [
  icon("lfc", "lakeflow_connect", "Lakeflow Connect"),
  icon("stream", "data_streaming", "Structured Streaming"),
]);
// Medallion — the Delta layers as tiers; tier identity via colored borders (bronze/silver/gold).
const lake = stage("lake", "Lakehouse — Delta (medallion)", [
  icon("dlt", "lakeflow_declarative_pipelines", "Declarative Pipelines"),
  box("bronze", "Bronze — raw", { w: 160, h: 44, stroke: "#B0752A" }),
  box("silver", "Silver — cleansed", { w: 160, h: 44, stroke: "#8A9099" }),
  box("gold", "Gold — curated", { w: 160, h: 44, stroke: "#C8A21A" }),
], RED);
const serve = stage("serve", "Serving", [
  icon("dbsql", "databricks_sql", "Databricks SQL"),
  icon("mosaic", "mosaic_ai", "Mosaic AI"),
  icon("nb", "notebooks", "Notebooks"),
]);
const consume = stage("consume", "Consumers", [
  icon("bi", "bi_dashboards", "BI Dashboards"),
]);

const stagesRow = frame("stages", "", { dir: "row", gap: 46, align: "top", header: 0, fill: "none", stroke: "none" },
  [sources, ingest, lake, serve, consume]);
// Cross-cutting governance band (spans the pipeline; dashed links to the layers it governs).
const unity = frame("uc", "Unity Catalog — governance · lineage · access", { dir: "row", gap: 24, stroke: "#B0B0B0" },
  [icon("unity", "unity_catalog", "Unity Catalog")]);

const root = frame("root", "Databricks Lakehouse Platform (medallion architecture)", { dir: "col", gap: 34, fill: "none", stroke: "none" },
  [stagesRow, unity]);
renderTree(d, root, [40, 70]);

// ingest
d.link("kafka", "lfc", "", { role: "fanout" });
d.link("oltp", "lfc", "", { role: "fanout" });
d.link("files", "stream", "", { flow: true });
// land into Bronze
d.link("lfc", "bronze", "", { flow: true });
d.link("stream", "bronze", "", { flow: true });
// medallion refinement
d.link("bronze", "silver", "", { flow: true });
d.link("silver", "gold", "", { flow: true });
// serve from Gold
d.link("gold", "dbsql", "", { role: "fanout" });
d.link("gold", "mosaic", "", { role: "fanout" });
d.link("dbsql", "bi", "", { flow: true });
// governance
d.link("unity", "lake", "governs", { dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../../out/databricks_lakehouse_kit.drawio", import.meta.url), d.mxfile("Databricks Lakehouse (medallion)"));
