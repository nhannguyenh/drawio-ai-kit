// Serverless event-driven — type "hubspoke". Layout engine: KHÔNG toạ độ hardcode.
// Hub EventBridge trải dọc qua các hàng được đặt theo rect ENGINE TÍNH RA.
import { writeFileSync } from "node:fs";
import { Diagram } from "../src/builder.mjs";
import { group, icon, renderTree } from "../src/layout-engine.mjs";

const d = new Diagram("hubspoke");

// 3 cột (label trong suốt, không khung): Producers | Consumers | Downstream
const col = (id, title, items) =>
  group(id, null, title, { dir: "col", gap: 40, fill: "none", stroke: "none", align: "center" }, items);

const tree = group("root", null, "", { dir: "row", gap: 200, align: "top", header: 0, pad: 10, fill: "none", stroke: "none" }, [
  col("producers", "PRODUCERS", [
    icon("p_api", "api_gateway", "API Gateway"),
    icon("p_sch", "eventbridge_scheduler", "EventBridge Scheduler"),
    icon("p_s3", "s3", "S3 (object events)"),
  ]),
  col("consumers", "CONSUMERS", [
    icon("c_lambda", "lambda", "Lambda (xử lý đơn)"),
    icon("c_sfn", "step_functions", "Step Functions"),
    icon("c_sqs", "sqs", "SQS (hàng đợi)"),
  ]),
  col("downstream", "DOWNSTREAM", [
    icon("d_ddb", "dynamodb", "DynamoDB"),
    icon("d_sns", "sns", "SNS (thông báo)"),
  ]),
]);

renderTree(d, tree, [40, 90]);

// Hub EventBridge trải dọc, đặt GIỮA RÃNH Producers↔Consumers — kit tự tính
d.spanV("hub", { icon: "eventbridge", label: "Amazon EventBridge (event bus)", w: 140, pad: 0, stroke: "#E7157B" },
  { between: ["producers", "consumers"], from: "producers", to: "producers" });

d.title("Serverless event-driven — type: hubspoke (Amazon EventBridge làm hub)");

// producers → hub ; hub → consumers (fan-out: góc vuông) ; downstream
d.link("p_api", "hub", "PutEvents");
d.link("p_sch", "hub", "lịch");
d.link("p_s3", "hub", "events");
d.link("hub", "c_lambda", "rule", { role: "fanout" });
d.link("hub", "c_sfn", "rule", { role: "fanout" });
d.link("hub", "c_sqs", "rule", { role: "fanout" });
d.link("c_lambda", "d_ddb", "ghi");
d.link("c_sfn", "d_sns", "notify");

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
writeFileSync(new URL("../out/eventdriven_kit.drawio", import.meta.url), d.mxfile("Event-driven (hubspoke)"));
