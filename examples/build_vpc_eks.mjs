// VPC with EKS / Bastion / NAT / Auto Scaling — type "network". Layout engine: NO hardcoded coords.
// Public subnet (Bastion + NAT) and Private subnet (K8s worker nodes in an Auto Scaling Group) per AZ; EKS in the center.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("network");

const az = (s) =>
  group(`az_${s}`, "group_availability_zone", `Availability Zone ${s.toUpperCase()}`, { dir: "col", gap: 18 }, [
    group(`pub_${s}`, "group_subnet", "Public Subnet", { dir: "row", gap: 16 }, [
      icon(`bast_${s}`, "ec2", "Bastion Host"),
      icon(`nat_${s}`, "nat_gateway", "NAT Gateway"),
    ]),
    group(`asg_${s}`, "group_auto_scaling_group", "Auto Scaling Group", { dir: "col", gap: 10 }, [
      group(`prv_${s}`, "group_subnet", "Private Subnet", { dir: "col", gap: 10 }, [icon(`node_${s}`, "ec2", "K8s Worker Nodes")]),
    ]),
  ]);

const tree = group("region", "group_region", "Region (eu-west-1)", { dir: "col", gap: 22, align: "center" }, [
  group("vpc", "group_vpc", "VPC 10.0.0.0/16", { dir: "col", gap: 22 }, [
    icon("igw", "internet_gateway", "Internet Gateway"),
    group("body", null, "", { dir: "row", gap: 60, align: "top", header: 0, fill: "none", stroke: "none" }, [
      az("a"),
      group("ctr", null, "", { dir: "col", gap: 10, header: 0, fill: "none", stroke: "none" }, [icon("eks", "eks", "Amazon EKS")]),
      az("c"),
    ]),
  ]),
]);

renderTree(d, tree, [40, 80]);
d.title("VPC with EKS — type: network (Bastion · NAT · Auto Scaling · Multi-AZ)");

d.link("igw", "bast_a", "", { role: "fanout" });
d.link("igw", "bast_c", "", { role: "fanout" });
d.link("eks", "node_a", "", { role: "fanout" });
d.link("eks", "node_c", "", { role: "fanout" });
d.link("node_a", "nat_a", "egress", { dir: "TB", dash: true });
d.link("node_c", "nat_c", "egress", { dir: "TB", dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../out/vpc_eks_kit.drawio", import.meta.url), d.mxfile("VPC EKS (network)"));
