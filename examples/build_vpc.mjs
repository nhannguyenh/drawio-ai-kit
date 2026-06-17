// VPC Multi-AZ 3-tier — type "network". Written with the layout engine: NO hardcoded coordinates.
// ALB spans 2 AZs + users/IGW outside the VPC are placed by the rect the ENGINE COMPUTES (not typed by hand).
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("network");
const ALBW = 110;

// Each AZ: Public | [empty lane for ALB] | App | Data. Lane width = ALBW + margin → ALB does not overlap subnets.
const azRow = (s, rdsLabel) =>
  group(`az_${s}`, "group_availability_zone", `Availability Zone ${s.toUpperCase()}`, { dir: "row", gap: 40 }, [
    group(`pub_${s}`, "group_subnet", "Public Subnet", { dir: "col" }, [icon(`nat_${s}`, "nat_gateway", "NAT Gateway")]),
    box(`alblane_${s}`, "", { w: ALBW + 30, h: 1, fill: "none", stroke: "none" }),
    group(`app_${s}`, "group_subnet", "Private Subnet (App)", { dir: "col" }, [icon(`ec2_${s}`, "ec2", "EC2 / ECS")]),
    group(`db_${s}`, "group_subnet", "Private Subnet (Data)", { dir: "col" }, [icon(`rds_${s}`, "rds", rdsLabel)]),
  ]);

const tree = group("region", "group_region", "Region (ap-southeast-1)", { dir: "row", gap: 60, align: "center" }, [
  group("vpc", "group_vpc", "VPC  10.0.0.0/16", { dir: "col", gap: 70 }, [
    azRow("a", "RDS (Primary)"),
    azRow("b", "RDS (Standby)"),
  ]),
  group("reg_svc", null, "Regional / Edge services", { dir: "col", gap: 22, fill: "#F5F5F5", stroke: "#999999" }, [
    icon("waf", "waf", "AWS WAF"),
    icon("cw", "cloudwatch_2", "CloudWatch"),
    icon("s3", "s3", "S3 (assets/logs)"),
  ]),
]);

renderTree(d, tree, [300, 90]);     // leave a left margin for users/IGW; the engine computes the rest

// external (left) — placed at the Region's vertical center computed by the engine
const reg = d.rect("region"), cy = Math.round(reg.y + reg.h / 2);
d.box("users", [40, cy - 40], [120, 80], "Users / Internet", { fill: "#DAE8FC", stroke: "#6C8EBF", bold: true });
d.icon("igw", "internet_gateway", [190, cy - 24], { label: "Internet Gateway" });

// ALB spans vertically across 2 AZs — the kit computes it (centered in the reserved lane, spanning app_a → app_b)
d.spanV("alb", { icon: "application_load_balancer", label: "Application Load Balancer (Multi-AZ)", w: ALBW, stroke: "#9673A6" },
  { lane: "alblane_a", from: "app_a", to: "app_b" });

d.title("VPC Multi-AZ 3-tier — type: network (Region → VPC → AZ → Subnet)");

d.link("users", "igw");
d.link("igw", "alb");
d.link("alb", "ec2_a");
d.link("alb", "ec2_b");
d.link("ec2_a", "rds_a");
d.link("ec2_b", "rds_b");
d.link("rds_a", "rds_b", "Multi-AZ replication", { dir: "TB", dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../out/vpc_multiaz_kit.drawio", import.meta.url), d.mxfile("VPC Multi-AZ 3-tier"));
