// VPC Lattice multi-account service mesh — type "mesh".
// KHÔNG toạ độ hardcode: chỉ khai báo cấu trúc, layout engine tự tính x/y/w/h.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("mesh");

// Workload accounts: lồng đồng tâm — mỗi group 1 con → tự bao khít (concentric wrap)
const workloads =
  group("acc_dev", "group_account", "Dev Workload Account", { dir: "col" }, [
    group("acc_test", "group_account", "Test Workload Account", { dir: "col" }, [
      group("acc_prod", "group_account", "Prod Workload Account", { dir: "col" }, [
        group("prod_vpc", "group_vpc", "VPC", { dir: "col" }, [
          group("prod_sub", "group_subnet", "Private subnet", { dir: "col" }, [
            icon("prod_ec2", "ec2", "Amazon EC2"),
          ]),
        ]),
      ]),
    ]),
  ]);

const tree = group("region", "group_region", "AWS Region", { dir: "row", gap: 70, pad: 40 }, [
  // Generative AI Account: Bedrock → Proxy(VPC) → Service 1
  group("genai", "group_account", "Generative AI Account", { dir: "row", gap: 36 }, [
    icon("bedrock", "bedrock", "Amazon Bedrock"),
    group("genai_vpc", "group_vpc", "VPC", { dir: "row" }, [box("proxy", "Proxy Layer", { w: 150, h: 64 })]),
    icon("svc1", "vpc_lattice", "VPC Lattice (Service 1)"),
  ]),
  // Service Network Account (hub)
  group("snet", "group_account", "Service Network Account", { dir: "col", gap: 28 }, [
    icon("ram", "resource_access_manager", "AWS RAM"),
    icon("r53", "route_53", "Amazon Route 53"),
    icon("snlat", "vpc_lattice", "VPC Lattice (Service network)"),
    box("snpol", "Service Network Policy", { w: 180, h: 50 }),
  ]),
  workloads,
]);

renderTree(d, tree);                  // engine tính toàn bộ layout + set page
d.title("Multi-account service mesh — type: mesh (Amazon VPC Lattice + AWS RAM)");

// associations (mesh): nối theo id, router tự định tuyến
d.link("bedrock", "proxy");
d.link("proxy", "svc1");
d.link("svc1", "snlat", "service association");
d.link("snlat", "prod_vpc", "VPC association");

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../../mesh_kit.drawio", import.meta.url), d.mxfile("Service mesh (VPC Lattice)"));
