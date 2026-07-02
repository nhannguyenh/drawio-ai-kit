// Databricks platform DEPLOYMENT topology — GENERIC template. Shows the canonical control-plane vs
// data-plane split (an account-ownership boundary, not a network tier): Databricks account holds the
// control plane; the customer cloud account holds classic compute (in a VPC), serverless compute, and
// the object storage. Unity Catalog governs across the boundary. Clean house style: white frames,
// identity via borders + icons. Run: node examples/databricks/build_platform.mjs
import { writeFileSync } from "node:fs";
import { Diagram } from "../../src/builder.mjs";
import { frame, icon, box, renderTree } from "../../src/layout-engine.mjs";

const d = new Diagram("hybrid");
const RED = "#FF3621", VPC = "#8C4FFF", STORE = "#B0752A";

// Control plane — Databricks-managed account.
const cp = frame("cp", "Databricks account (control plane)", { dir: "col", gap: 14, stroke: RED }, [
  icon("ws", "databricks", "Workspace / web app"),
  icon("nb", "notebooks", "Notebooks & SQL editor"),
  icon("jobs", "lakeflow_jobs", "Jobs & pipelines UI"),
  icon("uc", "unity_catalog", "Unity Catalog (metastore · governance)"),
]);

// Customer cloud account — serverless plane, classic compute VPC, and object storage all live here.
const cloud = frame("cloud", "Customer cloud account (AWS / Azure / GCP)", { dir: "col", gap: 26, stroke: "#5A6B7B" }, [
  frame("srv", "Serverless compute plane (Databricks-managed)", { dir: "row", gap: 22, stroke: RED }, [
    icon("sql", "databricks_sql", "Serverless SQL warehouse"),
    icon("mos", "mosaic_ai", "Model / agent serving"),
  ]),
  frame("cc", "Classic compute plane — customer VPC", { dir: "row", gap: 22, stroke: VPC }, [
    icon("clus", "photon", "Spark + Photon clusters"),
    icon("strm", "data_streaming", "Structured Streaming"),
  ]),
  frame("store", "Cloud object storage (customer-owned)", { dir: "row", gap: 22, stroke: STORE }, [
    icon("wsb", "s3", "Workspace storage bucket"),
    box("lake", "Data lake — Delta (Bronze · Silver · Gold)", { w: 250, h: 46, stroke: STORE }),
  ]),
]);

const root = frame("root", "Databricks platform deployment — control plane vs data plane", { dir: "row", gap: 90, align: "top", fill: "none", stroke: "none" }, [cp, cloud]);
renderTree(d, root, [40, 70]);

// secure cluster connectivity: control plane <-> both compute planes (solid control edges)
d.link("ws", "cc", "secure cluster connectivity");
d.link("ws", "srv", "secure cluster connectivity");
d.link("jobs", "cc", "", { role: "fanout" });     // control plane orchestrates classic compute
// compute reads/writes the data lake (data-plane flow)
d.link("clus", "lake", "read / write", { flow: true });
d.link("strm", "lake", "", { flow: true });
d.link("sql", "lake", "query", { flow: true });
// Unity Catalog governs storage AND compute (cross-boundary, dashed)
d.link("uc", "store", "governs", { dash: true });
d.link("uc", "cc", "governs", { dash: true });
d.link("uc", "srv", "governs", { dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../../out/databricks_platform_kit.drawio", import.meta.url), d.mxfile("Databricks platform deployment"));
