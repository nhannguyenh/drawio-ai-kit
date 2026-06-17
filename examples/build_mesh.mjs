// VPC Lattice multi-account service mesh — type "mesh". Viết bằng Diagram builder (gọn).
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";

const d = new Diagram("mesh", {
  title: "Multi-account service mesh — type: mesh (Amazon VPC Lattice + AWS RAM)",
  page: [1980, 980],
});

// Khung Region (các account ngang hàng nằm trong)
d.group("region", "group_region", [40, 80], [1900, 840], "AWS Region");

// --- Generative AI Account (trái): Bedrock → Proxy → Service 1 (cùng hàng → nét thẳng) ---
d.group("genai", "group_account", [90, 300], [620, 430], "Generative AI Account", { parent: "region" });
d.icon("bedrock", "bedrock", [150, 470], { parent: "genai", label: "Amazon Bedrock" });
d.group("genai_vpc", "group_vpc", [320, 430], [360, 220], "VPC", { parent: "genai" });
d.box("proxy", [380, 470], [150, 70], "Proxy Layer", { parent: "genai_vpc" });
d.icon("svc1", "vpc_lattice", [600, 470], { parent: "genai", label: "VPC Lattice (Service 1)" });

// --- Service Network Account (giữa): hub ---
d.group("snet", "group_account", [780, 220], [560, 600], "Service Network Account", { parent: "region" });
d.icon("ram", "resource_access_manager", [1140, 300], { parent: "snet", label: "AWS RAM" });
d.icon("r53", "route_53", [840, 330], { parent: "snet", label: "Amazon Route 53" });
d.icon("snlat", "vpc_lattice", [1000, 470], { parent: "snet", label: "VPC Lattice (Service network)" });
d.box("snpol", [940, 560], [170, 54], "Service Network Policy", { parent: "snet", fs: 10 });

// --- Workload Accounts (phải, xếp chồng Dev/Test/Prod) ---
// stacked cards: 3 account cùng cỡ, lệch (20,30); Prod ở trước (khai báo cuối), Dev/Test ló sau
d.group("acc_dev", "group_account", [1360, 300], [500, 360], "Dev Workload Account", { parent: "region" });
d.group("acc_test", "group_account", [1380, 330], [500, 360], "Test Workload Account", { parent: "region" });
d.group("acc_prod", "group_account", [1400, 360], [500, 360], "Prod Workload Account", { parent: "region" });
d.group("prod_vpc", "group_vpc", [1440, 420], [420, 250], "VPC", { parent: "acc_prod" });
d.group("prod_sub", "group_subnet", [1500, 470], [300, 160], "Private subnet", { parent: "prod_vpc" });
d.icon("prod_ec2", "ec2", [1630, 520], { parent: "prod_sub", label: "Amazon EC2" });

// --- associations (mesh) ---
d.link("bedrock", "proxy");
d.link("proxy", "svc1");
d.link("svc1", "snlat", "service association");
d.link("snlat", "prod_vpc", "VPC association");

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../../mesh_kit.drawio", import.meta.url), d.mxfile("Service mesh (VPC Lattice)"));
