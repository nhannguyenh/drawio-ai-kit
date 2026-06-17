#!/usr/bin/env node
// drawio-ai-kit — MCP server (stdio).
// Expose 4 tool cho AI: search_icon, get_icon_style, validate_diagram, get_principles.
// Cần: npm i  (để có @modelcontextprotocol/sdk). Nếu chưa cài, dùng src/cli.mjs.

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
      "Tìm stencil draw.io (AWS, theo họ mxgraph.aws4) theo từ khóa/category. Trả về TÊN CHÍNH XÁC + style draw.io đầy đủ để dán thẳng vào XML. LUÔN dùng tool này thay vì tự nhớ tên stencil (chống bịa tên).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khóa, ví dụ 's3', 'kubernetes', 'kms', 'cloud frame'." },
        category: { type: "string", description: "Lọc theo nhóm, ví dụ 'Compute', 'Storage', 'Security'." },
        kind: { type: "string", enum: ["icon", "group"], description: "icon = dịch vụ; group = khung nhóm (VPC/Region/AZ/AWS Cloud)." },
        limit: { type: "number", description: "Số kết quả tối đa (mặc định 8)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_icon_style",
    description: "Lấy style draw.io đầy đủ cho một stencil theo tên chính xác (ví dụ 's3', 'eks').",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "validate_diagram",
    description:
      "Kiểm tra XML draw.io: mọi resIcon/grIcon có tồn tại trong catalog không (chống icon-trống do bịa tên), edge có trỏ tới id hợp lệ không, và vài lint về style. LUÔN gọi trước khi trả sơ đồ cho người dùng.",
    inputSchema: {
      type: "object",
      properties: {
        xml: { type: "string", description: "Nội dung mxGraphModel XML." },
        strict: { type: "boolean", description: "true = coi stencil lạ là lỗi thay vì cảnh báo." },
      },
      required: ["xml"],
    },
  },
  {
    name: "get_principles",
    description: "Trả nguyên tắc thiết kế sơ đồ draw.io đẹp (lưới, spacing, group, màu theo nhóm, routing, nhãn) + preset kiến trúc AWS + danh sách nhóm icon có trong catalog.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "brand_logo",
    description:
      "Tìm logo thương hiệu (AI/LLM & một số brand) dạng draw.io 'image' style qua lobe-icons. Dùng cho thành phần KHÔNG có icon AWS. Lưu ý: nhiều OSS data-infra (Kafka/Starburst/MinIO/Dagster...) không có trong lobe-icons — khi đó tự nạp SVG qua scripts/crawl_icons.py --mode base64. Cần python3.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Tên brand, vd 'openai', 'spark'." },
        embed: { type: "boolean", description: "Inline SVG base64 (portable, fetch CDN ngay)." },
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
        return r ? text(r) : text(`Không thấy stencil "${args.name}".`);
      }
      case "validate_diagram":
        return text(validateDiagram(catalog, args.xml, { strict: !!args.strict }));
      case "get_principles": {
        const base = join(__dirname, "..", "rules");
        const md = readFileSync(join(base, "principles.md"), "utf8");
        const aws = readFileSync(join(base, "aws-architecture.md"), "utf8");
        const types = readFileSync(join(base, "diagram-types.md"), "utf8");
        return text([md, aws, types].join("\n\n---\n\n") + "\n\n## Nhóm icon có trong catalog\n" + JSON.stringify(listCategories(catalog), null, 2));
      }
      case "brand_logo": {
        const script = join(__dirname, "..", "vendor", "aiicons.py");
        const argv = [script, String(args.query), "--json"];
        if (args.embed) argv.push("--embed");
        if (args.variant) argv.push("--variant", args.variant);
        try {
          const out = execFileSync("python3", argv, { encoding: "utf8", timeout: 20000 });
          return text(out.trim() || "Không tìm thấy logo phù hợp.");
        } catch (e) {
          return { content: [{ type: "text", text: `Không chạy được aiicons.py (cần python3): ${e.message}` }], isError: true };
        }
      }
      default:
        return { content: [{ type: "text", text: `Tool không tồn tại: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Lỗi: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("drawio-ai-kit MCP server đang chạy (stdio). Catalog:", catalog.icons.length, "icons,", catalog.groups.length, "groups.");
