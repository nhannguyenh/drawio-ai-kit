# Azure architecture diagram preset

Icons: `search_icon` with `azure …` (e.g. `azure kubernetes`, `azure sql`, `azure functions`). Azure has **no group/container stencils** in the catalog — draw containers with the engine's `frame(id, label, …)` (a plain labelled box); the icons carry the identity.

## Containers — nest in the real order

Azure's hierarchy is **logical first, network second** — different from AWS:

```
Subscription  →  Resource Group  →  (resources)          ← logical / billing
                 VNet (regional)  →  Subnet  →  NIC/NSG    ← network
```

- **Resource Group is the primary container** and has **no AWS equivalent** — every resource lives in exactly one RG. Draw the RG as the outer logical frame; it is a *grouping*, **not** a network boundary, so a VNet and unrelated PaaS services can sit in the same RG.
- **VNet is regional** (one region); **Subnet** sits inside the VNet. An **NSG** attaches to a subnet or NIC — draw it as a labelled tier/annotation on the subnet, not a wrapping box.
- **Availability Zones** are *within* a region — zonal resources (VMs, zonal disks) are drawn per-zone inside the region; don't model AZ as a top container.
- **Global services** (Entra ID / Azure AD, Azure DNS, Front Door, Traffic Manager, Azure Monitor) are **not regional** — place them in a band outside the Resource Group / region, never inside a subnet.

## Canonical layouts

- **Landing zone / hub-spoke:** a **hub VNet** (shared firewall/gateway/DNS) peered to **spoke VNets** (workloads). Each VNet is a `frame`; peering = a solid edge between the VNet boxes. Management/identity/connectivity subscriptions as sibling frames.
- **N-tier VNet:** VNet is the box; subnets are **tiers stacked top→bottom** (Gateway/Web → App → Data). App Gateway / Load Balancer spans the tiers; a NAT Gateway or Azure Firewall in the perimeter subnet.
- **AKS / container:** the AKS cluster in a subnet; node pools as a stacked group; managed control plane drawn at the VNet edge (Azure manages it).

## Multi-region / HA

- One **VNet per region**; connect regions with **VNet peering** (solid) or a Virtual WAN hub. Never stretch one VNet across regions.
- Zone-redundant services (Zone-Redundant Storage, zonal VMSS) — one icon at the region level with a "zone-redundant" note, or one per zone with a sync link.

## Edges

- Solid = data/control flow; dashed = policy/identity/replication/peering.
- Connect to a container's **border box** (the `frame` id), not to every replica inside it.
- ExpressRoute / VPN Gateway is a **node** between Azure and on-prem — not just a labelled edge.

## Multi-cloud / hybrid composition

A diagram that mixes clouds or spans on-prem is **composed**, not forced into one preset (see `rules/diagram-types.md` §Composing). Each cloud is its **own sibling top-level `frame`** following its own containment rules; connect them through a **neutral boundary node** — Internet, ExpressRoute/VPN, or a partner interconnect — never nest one cloud inside another. Fetch the other cloud's rules too (`get_principles` `mode:"aws"` / `"gcp"`).
