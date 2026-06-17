// Event-driven serverless — type "hubspoke". Chỉ dùng kit: core + layout + types.
import { writeFileSync } from "node:fs";
import { loadCatalog, styleForIcon, validateDiagram } from "../src/core.mjs";
import { routeLR } from "../src/layout.mjs";
import { typePreset, edgeRounded } from "../src/types.mjs";

const c = loadCatalog();
const T = typePreset("hubspoke");
const cells = [];
const R = {};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let auto = 0;
const nid = () => `e${++auto}`;

const put = (id, x, y, w, h, style, label) => {
  R[id] = { x, y, w, h };
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
};
const ic = (id, name, x, y, label) => put(id, x, y, 48, 48, styleForIcon(c, name).style, label);
const box = (id, x, y, w, h, label, fill, stroke, va = "middle", fs = 11, fst = 0) =>
  put(id, x, y, w, h, `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#1A1A1A;fontSize=${fs};fontStyle=${fst};verticalAlign=${va};`, label);
const text = (id, x, y, w, h, label, fs = 14) =>
  cells.push(`<mxCell id="${id}" value="${esc(label)}" style="text;html=1;align=center;fontStyle=1;fontSize=${fs};fontColor=light-dark(#232F3E,#E8E8E8);" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
function link(src, tgt, label = "", { role = "flow", dash = false } = {}) {
  const r = routeLR(R[src], R[tgt], { laneX: (R[src].x + R[src].w + R[tgt].x) / 2 });
  let st = `edgeStyle=orthogonalEdgeStyle;html=1;jettySize=auto;orthogonalLoop=1;fontSize=10;fontColor=#1A1A1A;rounded=${edgeRounded(T, role)};`;
  if (dash) st += "dashed=1;";
  if (label) st += "labelBackgroundColor=#FFFFFF;";
  st += r.pins;
  const pts = r.wp.length ? `<Array as="points">${r.wp.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>` : "";
  cells.push(`<mxCell id="${nid()}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`);
}

const ROW = (j) => 210 + j * 150;
text("title", 40, 24, 1200, 30, "Serverless event-driven — type: hubspoke (Amazon EventBridge làm hub)");

// Producers (trái)
text("pl", 60, 150, 180, 20, "PRODUCERS", 11);
ic("p_api", "api_gateway", 110, ROW(0) - 24, "API Gateway");
ic("p_sch", "eventbridge_scheduler", 110, ROW(1) - 24, "EventBridge Scheduler");
ic("p_s3", "s3", 110, ROW(2) - 24, "S3 (object events)");

// Hub (giữa) — trải dọc qua các hàng để nét spoke ngang thẳng
box("hub", 470, 180, 150, 420, "Amazon EventBridge\n(event bus)", "#FFFFFF", "#E7157B", "bottom", 11, 1);
ic("hub_ic", "eventbridge", 521, 200, "");

// Consumers (phải)
text("cl", 850, 150, 180, 20, "CONSUMERS", 11);
ic("c_lambda", "lambda", 900, ROW(0) - 24, "Lambda (xử lý đơn)");
ic("c_sfn", "step_functions", 900, ROW(1) - 24, "Step Functions");
ic("c_sqs", "sqs", 900, ROW(2) - 24, "SQS (hàng đợi)");

// Data / downstream (phải cùng)
ic("d_ddb", "dynamodb", 1180, ROW(0) - 24, "DynamoDB");
ic("d_sns", "sns", 1180, ROW(1) - 24, "SNS (thông báo)");

// ---- edges: producers → hub ; hub → consumers ; downstream ----
link("p_api", "hub", "PutEvents");
link("p_sch", "hub", "lịch");
link("p_s3", "hub", "events");
link("hub", "c_lambda", "rule", { role: "fanout" });
link("hub", "c_sfn", "rule", { role: "fanout" });
link("hub", "c_sqs", "rule", { role: "fanout" });
link("c_lambda", "d_ddb", "ghi");
link("c_sfn", "d_sns", "notify");

const xml =
  `<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1380" pageHeight="720" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  cells.join("") + `</root></mxGraphModel>`;
const file = new URL("../../eventdriven_kit.drawio", import.meta.url);
writeFileSync(file, `<mxfile host="app.diagrams.net"><diagram name="Event-driven (hubspoke)" id="evt">${xml}</diagram></mxfile>`);
writeFileSync(new URL("./_evt_model.xml", import.meta.url), xml);
const res = validateDiagram(c, xml, { strict: true });
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));
