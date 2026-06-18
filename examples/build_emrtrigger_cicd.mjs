// emr-trigger — cách viết job → CI/CD (GitOps) → trigger chạy. Type "pipeline".
// Layout engine: NO hardcoded coordinates.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, grid, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("pipeline");

// palette (cohesive, ≤8 fills)
const BLUE = ["#DAE8FC", "#6C8EBF"], AMBER = ["#FFE6CC", "#D79B00"],
      GREEN = ["#D5E8D4", "#82B366"], PURP = ["#E1D5E7", "#9673A6"],
      GREY = ["#F5F5F5", "#5A6B7B"], WHITE = ["#FFFFFF", "#5A6B7B"];
const rbox = (id, label, [fill, stroke], opts = {}) =>
  box(id, label, { w: opts.w ?? 220, h: opts.h ?? 70, fill, stroke, round: false, bold: opts.bold ?? false });

// ---- Zone 1: Author (dev writes a job) ----
const author = frame("author", "", { dir: "col", gap: 40, header: 0, fill: "none", stroke: "none" }, [
  icon("dev", "user", "Developer (data engineer)"),
  rbox("art", "Job script (PySpark / Glue .py)\n+ schedule.yaml", BLUE, { h: 74 }),
]);

// ---- Zone 2: Git + CI/CD ----
const cicd = frame("cicd", "", { dir: "col", gap: 40, header: 0, fill: "none", stroke: "none" }, [
  rbox("repo", "emr-trigger-ops\n(GitHub repo)", GREY),
  rbox("gha", "GitHub Actions — CI/CD\n(on merge → main)", AMBER, { bold: true }),
]);

// ---- Zone 3: AWS Cloud ----
const eks = frame("eks", "Amazon EKS cluster", { dir: "col", gap: 22, fill: GREY[0], stroke: GREY[1] }, [
  icon("eks_ic", "eks", "Amazon EKS"),
  rbox("temporal", "Temporal Server\n(Schedules + task queue)", WHITE, { w: 230 }),
  rbox("worker", "emr-trigger Worker\n(runs TriggerJob)", GREEN, { w: 230 }),
  icon("iam", "identity_and_access_management", "IAM Role (IRSA)"),
]);

const compute = frame("compute", "Data / ML compute (managed)", { dir: "col", gap: 28, fill: PURP[0], stroke: PURP[1] }, [
  icon("emr", "emr", "Amazon EMR (Serverless/EC2/EKS)"),
  icon("glue", "glue", "AWS Glue"),
  icon("sagemaker", "sagemaker", "Amazon SageMaker"),
]);

const topRow = frame("top", "", { dir: "row", gap: 70, align: "top", header: 0, fill: "none", stroke: "none" }, [eks, compute]);

const botRow = frame("bot", "", { dir: "row", gap: 90, header: 0, fill: "none", stroke: "none" }, [
  icon("ecr", "ecr", "Amazon ECR (worker image)"),
  icon("s3", "s3", "Amazon S3 (scripts · data · logs)"),
  icon("cw", "cloudwatch_2", "CloudWatch (job logs)"),
]);

const cloud = group("aws", "group_aws_cloud_alt",
  "AWS Cloud — same VPC as Temporal · IRSA (no static keys)",
  { dir: "col", gap: 46 }, [topRow, botRow]);

// ---- root: Author | CI/CD | AWS Cloud ----
const tree = frame("root", "", { dir: "row", gap: 90, align: "top", header: 0, pad: 10, fill: "none", stroke: "none" },
  [author, cicd, cloud]);

renderTree(d, tree, [40, 80]);
d.title("emr-trigger — viết job, CI/CD (GitOps) và trigger chạy");

// ---- edges ----
d.link("dev", "art", "writes", { dir: "TB" });
d.link("art", "repo", "git push (PR → main)");
d.link("repo", "gha", "review & merge", { dir: "TB" });

d.link("gha", "s3", "① sync job scripts → S3");
d.link("gha", "temporal", "② apply schedule (temporal CLI)");
d.link("gha", "ecr", "build & push image", { dash: true });

d.link("ecr", "worker", "pull image", { dir: "TB", dash: true });
d.link("temporal", "worker", "dispatch TriggerJob (long-poll queue)", { dir: "TB" });
d.link("iam", "worker", "IRSA creds", { dir: "TB", dash: true });

d.link("worker", "emr", "StartJobRun + poll status", { role: "fanout" });
d.link("worker", "glue", "", { role: "fanout" });
d.link("worker", "sagemaker", "", { role: "fanout" });

d.link("compute", "s3", "read script · R/W data", { dir: "TB" });
d.link("compute", "cw", "logs", { dir: "TB", dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit?.advice }, null, 2));
writeFileSync(new URL("../out/emrtrigger_cicd.drawio", import.meta.url), d.mxfile("emr-trigger CI/CD & trigger"));
console.log("WROTE: out/emrtrigger_cicd.drawio");
