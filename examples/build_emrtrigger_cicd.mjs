// emr-trigger — author a job → CI/CD (GitOps) → trigger a run. Type "pipeline".
// Layout engine: NO hardcoded coordinates. Shared resources (ECR/S3/CloudWatch) sit in columns
// NEXT TO their consumers (left→right flow) so there are no long detour edges.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, frame, icon, box, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("pipeline");
const BLUE = ["#DAE8FC", "#6C8EBF"], AMBER = ["#FFE6CC", "#D79B00"],
      GREEN = ["#D5E8D4", "#82B366"], PURP = ["#E1D5E7", "#9673A6"],
      GREY = ["#F5F5F5", "#5A6B7B"], WHITE = ["#FFFFFF", "#5A6B7B"];
const rbox = (id, label, [fill, stroke], opts = {}) =>
  box(id, label, { w: opts.w ?? 210, h: opts.h ?? 64, fill, stroke, bold: opts.bold ?? false });

// Author
const author = frame("author", "", { dir: "col", gap: 44, header: 0, fill: "none", stroke: "none" }, [
  icon("dev", "user", "Developer (data engineer)"),
  rbox("art", "Job script (PySpark / Glue .py)\n+ schedule.yaml", BLUE),
]);
// Git + CI/CD
const cicd = frame("cicd", "", { dir: "col", gap: 44, header: 0, fill: "none", stroke: "none" }, [
  rbox("repo", "emr-trigger-ops\n(GitHub repo)", GREY),
  rbox("gha", "GitHub Actions — CI/CD\n(on merge → main)", AMBER, { bold: true }),
]);

// AWS Cloud = columns side by side, in flow order: Registry+Storage → EKS → Compute → Observability.
const regstore = frame("regstore", "Registry & Storage", { dir: "col", gap: 24, fill: GREY[0], stroke: GREY[1] }, [
  icon("ecr", "ecr", "Amazon ECR (worker image)"),
  icon("s3", "s3", "Amazon S3 (scripts · data)"),
]);
const eks = frame("eks", "Amazon EKS cluster", { dir: "col", gap: 20, fill: GREY[0], stroke: GREY[1] }, [
  icon("eks_ic", "eks", "Amazon EKS"),
  rbox("temporal", "Temporal Server\n(Schedules + task queue)", WHITE),
  rbox("worker", "emr-trigger Worker\n(runs TriggerJob)", GREEN),
  icon("iam", "identity_and_access_management", "IAM Role (IRSA)"),
]);
const compute = frame("compute", "Data / ML compute (managed)", { dir: "col", gap: 26, fill: PURP[0], stroke: PURP[1] }, [
  icon("emr", "emr", "Amazon EMR (Serverless/EC2/EKS)"),
  icon("glue", "glue", "AWS Glue"),
  icon("sagemaker", "sagemaker", "Amazon SageMaker"),
]);
const obs = frame("obs", "Observability", { dir: "col", gap: 24, fill: GREY[0], stroke: GREY[1] }, [
  icon("cw", "cloudwatch_2", "CloudWatch (job logs)"),
]);

const cloud = group("aws", "group_aws_cloud_alt", "AWS Cloud — same VPC as Temporal · IRSA (no static keys)",
  { dir: "row", gap: 50, align: "center" }, [regstore, eks, compute, obs]);

const tree = frame("root", "", { dir: "row", gap: 80, align: "center", header: 0, pad: 10, fill: "none", stroke: "none" },
  [author, cicd, cloud]);

renderTree(d, tree, [40, 80]);
d.title("emr-trigger — author job, CI/CD (GitOps) and trigger a run");

// author → ci/cd
d.link("dev", "art", "writes", { dir: "TB" });
d.link("art", "repo", "git push (PR → main)");
d.link("repo", "gha", "review & merge", { dir: "TB" });
// ci/cd publishes artifacts (adjacent Registry & Storage column) + applies schedule
d.link("gha", "ecr", "build & push image");
d.link("gha", "s3", "sync job scripts");
d.link("gha", "temporal", "apply schedule");
// runtime (all within / between adjacent columns)
d.link("ecr", "worker", "pull image", { dash: true });
d.link("temporal", "worker", "dispatch TriggerJob", { dir: "TB" });
d.link("iam", "worker", "IRSA creds", { dir: "TB", dash: true });
d.link("worker", "emr", "StartJobRun + poll", { role: "fanout" });
d.link("worker", "glue", "", { role: "fanout" });
d.link("worker", "sagemaker", "", { role: "fanout" });
// compute reads from the adjacent storage column and emits logs to the adjacent observability column
d.link("s3", "compute", "read script · R/W data", { dash: true });
d.link("compute", "cw", "logs", { dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }, null, 2));
writeFileSync(new URL("../out/emrtrigger_cicd.drawio", import.meta.url), d.mxfile("emr-trigger CI/CD & trigger"));
console.log("WROTE: out/emrtrigger_cicd.drawio");
