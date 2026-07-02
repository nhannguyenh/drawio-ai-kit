# Databricks / Lakehouse architecture preset

Icons: `search_icon "databricks …"`. Databricks has **no group/container stencils** — draw containers with `frame`/`stage`/`band`; the icons carry identity. Accent red `#FF3621` on **borders only**, never as a fill (clean house style).

**Pick the view first — the two Databricks diagrams have different containment:**

## A. Logical lakehouse reference (default — "lakehouse / data platform / pipeline")

Left→right compute **lanes**, with two **cross-cutting bands** underneath. This is how Databricks draws its own reference architectures.

- Lanes as `stage`s, in order: **Source → Ingest → Transform → Serve → Analysis**. Compute is Spark + Photon.
- **Storage is a horizontal `band` spanning under the lanes** — it holds the medallion `box`es **Bronze → Silver → Gold** (left→right refinement). Storage is the substrate the Transform/Serve lanes read/write; it is **not** a pipeline column of its own.
- **Unity Catalog is a cross-cutting governance `band` spanning ALL lanes** (one node), dash-linked (`governs`) to storage **and** the serving/ML assets — UC governs tables, volumes, models and features everywhere, not just the lake. Never place UC as a node inside the flow.
- Component vocabulary: Ingest = `lakeflow_connect` (SaaS/DB connectors), `data_streaming` (streaming/CDC), `lakeflow_declarative_pipelines` (DLT). Transform/orchestration = `lakeflow_jobs`, `photon`, `notebooks`. Serve = `databricks_sql`, `mosaic_ai`/`agent_bricks`, `lakebase` (OLTP). Analysis = `bi_dashboards`, `bi_genie`, `databricks_one`, `dbx_apps`. Sharing = `delta_sharing`, `dbx_marketplace`, `dbx_clean_rooms`.

## B. Platform deployment topology ("control plane / data plane / serverless / VPC / on a cloud")

The plane split is an **account-ownership boundary, NOT a network tier**:

- **Control plane = frame "Databricks account (control plane)"** (red border) — workspace/web app (`databricks`), `notebooks`, `lakeflow_jobs` (jobs UI), `databricks_sql` (query UI), `unity_catalog` (metastore + governance). Databricks-managed.
- **Classic compute plane = a dashed customer-cloud VPC frame** (`clusterBox`) in the **customer cloud account**, holding the Spark/`photon` clusters. **Serverless compute plane** = a separate frame on the Databricks-account side.
- **Storage lives in the customer cloud account** — `s3`/ADLS/GCS bucket(s) for workspace storage + the data lake (medallion). Object storage is **not** in the VPC — draw beside the classic compute VPC.
- Edges: control plane ↔ compute = **secure cluster connectivity** (solid); compute → storage = read/write (flow); UC → storage & compute = `governs` (dashed). Composing with a cloud follows `rules/diagram-types.md` §Composing — the cloud is a sibling frame; only the classic compute VPC genuinely nests in the customer account.

## Governance hierarchy (when the diagram is about Unity Catalog)

`Account → Metastore (one per cloud region per account) → Catalog → Schema → Table | View | Volume | Function | Model`. Storage credentials, external locations, connections and shares sit under the metastore. Tables/volumes are **managed** (UC owns storage) or **external** (UC governs only). Draw as a nested `frame` tree (3-level namespace `catalog.schema.object`), not a flow.

## Edges

Solid = data/control flow; dashed = governance/lineage/sharing. Medallion Bronze→Silver→Gold = flow. Connect to a band's border, not each child. `flow:true` on the main ingest→medallion→serve spine.
