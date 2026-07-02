# Examples

Generic templates built with the layout engine (zero hardcoded coordinates). Copy one as a starting point.
Organized into **domain subfolders**. Run any: `node examples/<dir>/<file>` → writes to `out/*.drawio`.

```text
examples/
├── aws/          AWS architectures
├── azure/        Azure architectures
├── gcp/          Google Cloud architectures
├── databricks/   Databricks lakehouse (data platform, cloud-agnostic)
├── multicloud/   multi-cloud / hybrid (compose several)
└── bpmn/         BPMN swimlane processes
```

> Containment rules differ per cloud — call `get_principles` with `mode:"aws"` / `"azure"` / `"gcp"` / `"bpmn"` before building.

## `aws/`

| File | Type | Architecture |
| --- | --- | --- |
| `build_pipeline.mjs` | pipeline | Layered data analytics pipeline (ingest → process → store → serve) + cross-cutting band |
| `build_landingzone.mjs` | hierarchy | AWS Landing Zone / Control Tower org & OUs |
| `build_landingzone_hubspoke_template.mjs` | hubspoke | Multi-account hub-and-spoke Landing Zone (Transit Gateway, ingress/egress VPCs) — multi-tab SA deck |
| `build_multiaz_template.mjs` | network | Multi-AZ workload layer — private-subnet columns, per-app cross-AZ `clusterBox`, GitOps band |
| `build_vpc.mjs` | network | VPC Multi-AZ 3-tier (ALB spanning AZs) |
| `build_vpc_routing.mjs` | network | Subnets + route tables + VPC Endpoint (Gateway) → S3 |
| `build_vpc_eks.mjs` | network | VPC with Bastion, NAT, EKS, Auto Scaling worker nodes |
| `build_vpc_efs.mjs` | network | VPC with Amazon EFS (a mount target per AZ) |
| `build_web3tier.mjs` | network | 3-tier web app (Edge → Web → App → Data) |
| `build_eventdriven.mjs` | hubspoke | Serverless event bus (EventBridge hub → consumers) |
| `build_serverless.mjs` | sequence | Serverless web app, numbered request walkthrough |
| `build_hybrid.mjs` | hybrid | On-prem ↔ AWS over Direct Connect + VPN, mirrored DR |
| `build_mesh.mjs` | mesh | Multi-account connectivity / service mesh |
| `build_iam_accounts.mjs` | hierarchy | Multi-account IAM + cross-account assume-role |

## `azure/`

| File | Type | Architecture |
| --- | --- | --- |
| `build_azure_vnet.mjs` | network | N-tier: Subscription → Resource Group → VNet → Subnet tiers (Firewall in `AzureFirewallSubnet`); PaaS outside the VNet via Private Link |
| `build_azure_hub_spoke_lz.mjs` | network | CAF hub-spoke landing zone: Management Groups → Subscriptions → hub VNet (Bastion/Firewall/Gateway in reserved subnets) + spoke VNets, VNet peering, Private Endpoints |

## `gcp/`

| File | Type | Architecture |
| --- | --- | --- |
| `build_gcp_vpc.mjs` | network | Global VPC across two regions: Project → **global** VPC → **regional** Subnets; managed/global services outside the VPC |
| `build_gcp_shared_vpc_landing_zone.mjs` | network | Shared VPC landing zone: Folder (hierarchical firewall) → host project (global VPC, regional Cloud Router/NAT) + service projects attach; Interconnect, PSC, VPC-SC perimeter |

## `databricks/`

| File | Type | Architecture |
| --- | --- | --- |
| `build_lakehouse.mjs` | pipeline | Lakehouse medallion — Sources → Lakeflow ingest → Delta Bronze/Silver/Gold → Serving → BI, governed by Unity Catalog |
| `build_platform.mjs` | hybrid | Platform deployment — control plane (Databricks account) vs data plane (classic-in-VPC + serverless) + customer object storage, Unity Catalog governance |
| `build_data_intelligence_platform.mjs` | pipeline | The official DIP reference — coral/navy signature bands, Landing→Bronze→Silver→Gold medallion, white zones, equal Governance/Open-Storage cards |
| `build_mlops.mjs` | pipeline | MLOps reference — Git provider (dev→main→release + CI/CD), Development/Staging/Production workspace zones (MLflow + train-deploy workflow), Unity Catalog per-env catalogs (Tables + Models), Lakehouse |

## `multicloud/`

| File | Type | Architecture |
| --- | --- | --- |
| `build_multicloud.mjs` | hybrid | On-prem + AWS + Azure composed as sibling frames, connected through a neutral interconnect (no cloud nested in another) |

## `bpmn/`

| File | Type | Architecture |
| --- | --- | --- |
| `build_bpmn.mjs` | bpmn | Swimlane process — pool → lanes (roles) × phases; canonical `mxgraph.bpmn` events/gateways/tasks |
