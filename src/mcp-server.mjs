#!/usr/bin/env node
// drawio-ai-kit — MCP server (stdio).
// Exposes 6 tools for the AI: search_icon, get_icon_style, validate_diagram, render_diagram,
// get_principles, brand_logo.
// Requires: npm i  (to get @modelcontextprotocol/sdk). If not installed, use src/cli.mjs.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  loadCatalog,
  searchIcon,
  getIcon,
  validateDiagram,
  listCategories,
} from "./core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = loadCatalog(process.env.DRAWIO_CATALOG);

let renderSeq = 0;
/** Locate the draw.io desktop CLI: env override → PATH → common install locations. */
function findDrawioCli() {
  if (process.env.DRAWIO_CLI && existsSync(process.env.DRAWIO_CLI)) return process.env.DRAWIO_CLI;
  try { const p = execFileSync("/bin/sh", ["-c", "command -v drawio"], { encoding: "utf8" }).trim(); if (p) return p; } catch { /* not on PATH */ }
  for (const p of ["/opt/homebrew/bin/drawio", "/usr/local/bin/drawio", "/usr/bin/drawio",
                   "/Applications/draw.io.app/Contents/MacOS/draw.io"]) if (existsSync(p)) return p;
  return null;
}

const TOOLS = [
  {
    name: "search_icon",
    description:
      "Search the icon catalog by keyword/category. Covers AWS stencils (mxgraph.aws4 family) AND non-AWS brand/tech icons from the OSS packs — Big Data (spark, kafka, airflow, flink, minio…), Database (postgres, mysql, mongodb, redis, clickhouse…), Databricks, CI/CD (jenkins, argocd, terraform, ansible…), Containers & Kubernetes (kubernetes, docker, helm, istio…), Observability (datadog, prometheus, grafana, opentelemetry…), Network & Gateway (nginx, kong, traefik…), AI/ML (pytorch, tensorflow, huggingface, ollama…). Returns the EXACT NAME + color + a draw.io style. For AWS the style is a ready-to-paste stencil reference; for OSS icons (which embed a large base64 PNG) the style field is a placeholder — build with the layout-engine icon(name) factory (resolves the real style server-side) or call get_icon_style(name) if you need the raw style. ALWAYS search here for ANY component (AWS or third-party) by its name instead of drawing a plain box or recalling stencil names from memory.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Tool/service name or keyword, e.g. 's3', 'kubernetes', 'spark', 'postgres', 'kafka', 'cloud frame'." },
        category: { type: "string", description: "Filter by category, e.g. 'Compute', 'Storage', 'Big Data', 'Database', 'CI/CD', 'Containers & Kubernetes', 'AI / ML'." },
        kind: { type: "string", enum: ["icon", "group"], description: "icon = service; group = grouping frame (VPC/Region/AZ/AWS Cloud)." },
        limit: { type: "number", description: "Maximum number of results (default 8)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_icon_style",
    description: "Get the full draw.io style for a stencil by its exact name (e.g. 's3', 'eks').",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "validate_diagram",
    description:
      "Validate draw.io XML: whether every resIcon/grIcon exists in the catalog (prevents blank icons caused by fabricated names), whether edges point to valid ids, and a few style lints. ALWAYS call this before returning a diagram to the user.",
    inputSchema: {
      type: "object",
      properties: {
        xml: { type: "string", description: "mxGraphModel XML content." },
        strict: { type: "boolean", description: "true = treat unknown stencils as errors instead of warnings." },
      },
      required: ["xml"],
    },
  },
  {
    name: "get_principles",
    description: "Return design principles for clean draw.io diagrams (grid, spacing, grouping, color by group, routing, labels) + AWS architecture presets + the full list of catalog categories WITH COUNTS (includes the Azure & Google Cloud packs and the non-AWS OSS packs: Big Data, Database, Databricks, CI/CD, Containers & Kubernetes, Observability, Network & Gateway, AI/ML) so you know which cloud/third-party tool icons are available to search_icon (search `azure …` / `gcp …` for Azure/GCP services). Pass {mode:'bpmn'} instead for BPMN swimlane rules + the mxgraph.bpmn Tier-1 shape vocabulary.",
    inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["aws", "azure", "gcp", "databricks", "bpmn"], description: "Diagram domain: omit/'aws' = AWS presets; 'azure' = Azure (Management Group→Subscription→Resource Group→VNet→Subnet) rules; 'gcp' = GCP (Org→Folder→Project→global VPC→regional Subnet, Shared VPC) rules; 'databricks' = Databricks lakehouse (logical medallion + control/data-plane deployment) rules; 'bpmn' = BPMN swimlane rules. Each cloud mode includes shared layout + composition (multi-cloud/hybrid) guidance." } } },
  },
  {
    name: "render_diagram",
    description:
      "Render draw.io XML to a PNG and return the image so you can SEE the result and self-correct (the vision self-check). ALWAYS render after validate_diagram passes, look at the image, and fix any overlap/alignment/spacing issues before delivering. Requires the draw.io desktop CLI (set DRAWIO_CLI if it is not on PATH).",
    inputSchema: {
      type: "object",
      properties: {
        xml: { type: "string", description: "mxGraphModel / mxfile XML to render." },
        path: { type: "string", description: "Alternatively, an absolute path to a .drawio file (used if xml is omitted)." },
        scale: { type: "number", description: "Render scale (default 2 for crisp output)." },
        page: { type: "number", description: "Page index for multi-page files (default 0)." },
      },
    },
  },
  {
    name: "brand_logo",
    description:
      "Find brand logos (AI/LLM & some brands) as a draw.io 'image' style via lobe-icons. Use for components that do NOT have an AWS icon. Note: many OSS data-infra tools (Kafka/Starburst/MinIO/Dagster...) are not in lobe-icons — in that case load the SVG yourself via scripts/crawl_icons.py --mode base64. Requires python3.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Brand name, e.g. 'openai', 'spark'." },
        embed: { type: "boolean", description: "Inline SVG base64 (portable, fetches from CDN immediately)." },
        variant: { type: "string", enum: ["color", "mono", "text"] },
      },
      required: ["query"],
    },
  },
];

const server = new Server(
  { name: "drawio-ai-kit", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });
  try {
    switch (name) {
      case "search_icon":
        return text(searchIcon(catalog, args.query, { category: args.category, kind: args.kind, limit: args.limit ?? 8 }));
      case "get_icon_style": {
        const r = getIcon(catalog, args.name);
        return r ? text(r) : text(`Stencil "${args.name}" not found.`);
      }
      case "validate_diagram":
        return text(validateDiagram(catalog, args.xml, { strict: !!args.strict }));
      case "get_principles": {
        const base = join(__dirname, "..", "rules");
        const read = (f) => readFileSync(join(base, f), "utf8");
        const cats = () => "\n\n## Icon groups available in the catalog\n" + JSON.stringify(listCategories(catalog), null, 2);
        if (args.mode === "bpmn") {
          return text(read("bpmn.md") + "\n\n---\n\n## Shared layout principles (apply to BPMN too)\n" + read("principles.md") + "\n\n## Shape groups in the catalog\n" + JSON.stringify(listCategories(catalog), null, 2));
        }
        // Cloud/platform presets share principles + composition + style; only the architecture rule differs.
        const cloudRule = { azure: "azure-architecture.md", gcp: "gcp-architecture.md", databricks: "databricks-architecture.md" }[args.mode];
        if (cloudRule) {
          return text([read(cloudRule), read("principles.md"), read("diagram-types.md"), read("style-guide.md")].join("\n\n---\n\n") + cats());
        }
        return text([read("principles.md"), read("aws-architecture.md"), read("diagram-types.md"), read("style-guide.md")].join("\n\n---\n\n") + cats());
      }
      case "render_diagram": {
        const cli = findDrawioCli();
        if (!cli) return { content: [{ type: "text", text: "draw.io CLI not found. Install the draw.io desktop app, or set DRAWIO_CLI to its binary path. (On headless Linux, run it under xvfb-run.)" }], isError: true };
        let input = args.path;
        if (!input) {
          if (!args.xml) return { content: [{ type: "text", text: "Provide either 'xml' or 'path'." }], isError: true };
          input = join(tmpdir(), `drawio-ai-${process.pid}-${++renderSeq}.drawio`);
          writeFileSync(input, args.xml.includes("<mxfile") ? args.xml : `<mxfile><diagram id="d">${args.xml}</diagram></mxfile>`);
        }
        const out = join(tmpdir(), `drawio-ai-${process.pid}-${renderSeq}.png`);
        try {
          execFileSync(cli, ["-x", "-f", "png", "-s", String(args.scale ?? 2), "-p", String(args.page ?? 0), "--no-sandbox", "-o", out, input], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) {
          return { content: [{ type: "text", text: `Render failed: ${e.message}. The draw.io CLI needs a display; on a server use xvfb-run.` }], isError: true };
        }
        if (!existsSync(out)) return { content: [{ type: "text", text: "Render produced no output file." }], isError: true };
        const b64 = readFileSync(out).toString("base64");
        return { content: [
          { type: "text", text: `Rendered to ${out}. Inspect the image for overlaps, misalignment, broken/overlapping edges, and frames that don't hug their content; fix and re-render if needed.` },
          { type: "image", data: b64, mimeType: "image/png" },
        ] };
      }
      case "brand_logo": {
        const script = join(__dirname, "..", "vendor", "aiicons.py");
        const argv = [script, String(args.query), "--json"];
        if (args.embed) argv.push("--embed");
        if (args.variant) argv.push("--variant", args.variant);
        try {
          const out = execFileSync("python3", argv, { encoding: "utf8", timeout: 20000 });
          return text(out.trim() || "No matching logo found.");
        } catch (e) {
          return { content: [{ type: "text", text: `Could not run aiicons.py (requires python3): ${e.message}` }], isError: true };
        }
      }
      default:
        return { content: [{ type: "text", text: `Tool does not exist: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("drawio-ai-kit MCP server running (stdio). Catalog:", catalog.icons.length, "icons,", catalog.groups.length, "groups.");
