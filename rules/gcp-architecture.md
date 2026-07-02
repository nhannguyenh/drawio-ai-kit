# GCP architecture diagram preset

Icons: `search_icon` with `gcp …` (e.g. `gcp compute engine`, `gcp bigquery`, `gcp cloud run`). GCP has **no group/container stencils** in the catalog — draw containers with the engine's `frame(id, label, …)`; the icons carry the identity.

## Containers — nest in the real order

```
Organization → Folder → Project → (resources)                 ← logical / billing / IAM
                                   VPC (GLOBAL) → Subnet (REGIONAL) → resources   ← network
```

- **Project is the primary isolation & billing boundary** (analogous to an AWS account). Draw the Project as the outer frame; Org/Folder above it only when the diagram is about governance.
- **A VPC network is GLOBAL** — this is the key difference from AWS. **One VPC spans all regions.** Draw the VPC as a **wide box that contains multiple Region blocks**; do **NOT** nest the VPC inside a single region.
- **Subnets are REGIONAL** — each subnet belongs to one region and spans the zones in it. Put subnets inside their Region block, inside the (global) VPC.
- **Zones** are within a region — zonal resources (GCE VMs, zonal GKE nodes) sit in the region/subnet; don't model a zone as a top container.
- **Firewall rules are VPC-wide** (network-level, tag/SA-based) — annotate at the VPC, not as a per-subnet wrapping box like an AWS Security Group.
- **Global / multi-regional services** (Cloud DNS, Cloud CDN, global HTTP(S) Load Balancer, multi-region Cloud Storage, IAM) sit **outside** the region blocks — a band at the VPC/Project edge.

## Canonical layouts

- **Global VPC, multi-region:** VPC = the wide outer network box → two+ **Region** frames side by side → **regional Subnet(s)** inside each → workloads. A **global HTTP(S) LB** spans the regions at the top; Cloud DNS/CDN outside.
- **GKE / container:** cluster in a regional subnet; node pools stacked; managed control plane at the subnet/region edge (Google-managed).
- **Data / analytics:** BigQuery, Dataflow, Pub/Sub, Cloud Storage are **regional or multi-regional managed services** — draw at the Project level (they are not in the VPC), connect with flow edges.

## Multi-region / HA

- Because the **VPC is global**, multi-region is natural: additional Region frames inside the *same* VPC box, subnets per region. No peering needed between regions of one VPC.
- Cross-project or cross-VPC connectivity → **VPC Peering** or **Shared VPC** (host project's VPC used by service projects) — draw the host Project's VPC and attach service Projects to it.

## Edges

- Solid = data/control flow; dashed = policy/replication/peering.
- Connect to a container's **border box**, not every replica inside it.
- Cloud Interconnect / Cloud VPN is a **node** between GCP and on-prem / other clouds — not just a labelled edge.

## Multi-cloud / hybrid composition

A diagram that mixes clouds or spans on-prem is **composed**, not forced into one preset (see `rules/diagram-types.md` §Composing). Each cloud is its **own sibling top-level `frame`** following its own containment rules; connect them through a **neutral boundary node** — Internet, Cloud Interconnect/VPN, or a partner interconnect — never nest one cloud inside another. Fetch the other cloud's rules too (`get_principles` `mode:"aws"` / `"azure"`).
