// AWS Landing Zone — type "hierarchy". Layout engine: KHÔNG toạ độ hardcode.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("hierarchy");

// account = khung group_account (vuông) chứa 1 hàng icon dịch vụ
const acct = (id, title, items) =>
  group(id, "group_account", title, { dir: "row", gap: 18 }, items.map(([n, l], i) => icon(`${id}_${i}`, n, l)));

// OU = khung logic (màu) chứa các account
const ou = (id, title, fill, stroke, accts) =>
  frame(id, title, { dir: "col", gap: 22, fill, stroke }, accts);

const mgmt = group("mgmt", "group_account", "Management Account (Organization Root)", { dir: "row", gap: 30 }, [
  icon("m_org", "organizations", "AWS Organizations"),
  icon("m_ct", "control_tower", "Control Tower"),
  icon("m_sso", "single_sign_on", "IAM Identity Center"),
]);

const ous = frame("ous", "", { dir: "row", gap: 46, align: "top", header: 0, fill: "none", stroke: "none" }, [
  ou("ou_sec", "Security OU", "#F8CECC", "#B85450", [
    acct("a_log", "Log Archive Account", [["s3", "S3 (logs)"], ["cloudtrail", "CloudTrail"], ["config", "Config"]]),
    acct("a_aud", "Audit Account (Security Tooling)", [["guardduty", "GuardDuty"], ["security_hub", "Security Hub"], ["detective", "Detective"]]),
  ]),
  ou("ou_inf", "Infrastructure OU", "#DAE8FC", "#6C8EBF", [
    acct("a_net", "Network Account", [["transit_gateway", "Transit Gateway"], ["direct_connect", "Direct Connect"], ["vpc", "Shared VPC"]]),
    acct("a_shr", "Shared Services Account", [["directory_service", "Directory Service"], ["resource_access_manager", "RAM"]]),
  ]),
  ou("ou_wl", "Workloads OU", "#D5E8D4", "#82B366", [
    acct("a_prod", "Production (Workloads_Prod)", [["vpc", "VPC"], ["eks", "EKS"], ["ec2", "EC2"]]),
    acct("a_np", "Non-Production (Workloads_Test)", [["vpc", "VPC"], ["ec2", "EC2"]]),
  ]),
  ou("ou_sbx", "Sandbox OU", "#F5F5F5", "#999999", [
    acct("a_sbx", "Sandbox Account", [["vpc", "VPC"], ["ec2", "EC2"]]),
  ]),
]);

const onprem = frame("onprem", "ON-PREMISES (the bank · Việt Nam)", { dir: "row", fill: "#F0F0F0", stroke: "#666666" }, [
  icon("op_dc", "corporate_data_center", "Active Directory · hệ hiện hữu"),
]);

const tree = frame("lz", "", { dir: "col", gap: 70, align: "center", header: 0, pad: 10, fill: "none", stroke: "none" },
  [mgmt, ous, onprem]);

renderTree(d, tree, [40, 80]);
d.title("AWS Landing Zone — type: hierarchy (AWS Organizations · Control Tower)");

// cây phân cấp: Management → các OU (góc vuông, bus chung); DX xuống on-prem
d.link("mgmt", "ou_sec", "", { dir: "TB", role: "tree" });
d.link("mgmt", "ou_inf", "", { dir: "TB", role: "tree" });
d.link("mgmt", "ou_wl", "", { dir: "TB", role: "tree" });
d.link("mgmt", "ou_sbx", "", { dir: "TB", role: "tree" });
d.link("ou_inf", "onprem", "AWS Direct Connect", { dir: "TB" });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../out/landingzone_kit.drawio", import.meta.url), d.mxfile("AWS Landing Zone"));
