#!/usr/bin/env node
// drawio-ai-kit — MCP server (stdio).
// Exposes 4 tools for the AI: search_icon, get_icon_style, validate_diagram, get_principles.
// Requires: npm i  (to get @modelcontextprotocol/sdk). If not installed, use src/cli.mjs.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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

const TOOLS = [
  {
    name: "search_icon",
    description:
      "Search draw.io stencils (AWS, from the mxgraph.aws4 family) by keyword/category. Returns the EXACT NAME + the full draw.io style ready to paste directly into XML. ALWAYS use this tool instead of recalling stencil names from memory (prevents fabricated names).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword, e.g. 's3', 'kubernetes', 'kms', 'cloud frame'." },
        category: { type: "string", description: "Filter by group, e.g. 'Compute', 'Storage', 'Security'." },
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
    description: "Return design principles for clean draw.io diagrams (grid, spacing, grouping, color by group, routing, labels) + AWS architecture presets + the list of icon groups available in the catalog.",
    inputSchema: { type: "object", properties: {} },
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
        const md = readFileSync(join(base, "principles.md"), "utf8");
        const aws = readFileSync(join(base, "aws-architecture.md"), "utf8");
        const types = readFileSync(join(base, "diagram-types.md"), "utf8");
        return text([md, aws, types].join("\n\n---\n\n") + "\n\n## Icon groups available in the catalog\n" + JSON.stringify(listCategories(catalog), null, 2));
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
