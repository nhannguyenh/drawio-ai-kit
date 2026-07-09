import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { existsSync as fsExistsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const KNOWN_LOCATIONS = [
  "/opt/homebrew/bin/drawio",
  "/usr/local/bin/drawio",
  "/usr/bin/drawio",
  "/Applications/draw.io.app/Contents/MacOS/draw.io",
];

function defaultLocateOnPath() {
  try {
    return execFileSync("/bin/sh", ["-c", "command -v drawio"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Returns the absolute directory containing package.json and src/.
 */
export function packageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Locates the draw.io desktop CLI by priority order.
 * Injectable env + deps for testing without real binaries.
 */
export function findDrawioCli(env, deps = {}) {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const locateOnPath = deps.locateOnPath ?? defaultLocateOnPath;

  // (1) DRAWIO_CLI env var
  if (env.DRAWIO_CLI && existsSync(env.DRAWIO_CLI)) return env.DRAWIO_CLI;

  // (2) locate on PATH
  const onPath = locateOnPath(env);
  if (onPath) return onPath;

  // (3) known locations
  for (const loc of KNOWN_LOCATIONS) {
    if (existsSync(loc)) return loc;
  }

  // (4) nothing found
  return null;
}

/**
 * Builds the draw.io desktop CLI argv array for PNG rendering.
 */
export function buildRenderArgs({ file, out, scale = 2, page = 0 }) {
  return [
    "-x", "-f", "png",
    "-s", String(scale),
    "-p", String(page),
    "--no-sandbox",
    "-o", out,
    file,
  ];
}

/**
 * Returns the Shared Workflow text — agent instructions for build→validate→render→write.
 */
export function workflowText() {
  return `# Shared Workflow: drawio-ai diagram generation

## 1. Import the engine
\`\`\`js
import { loadCatalog, searchIcon, getIcon, group, icon, renderTree } from "$(drawio-ai root)/src/core.mjs";
import { Diagram } from "$(drawio-ai root)/src/builder.mjs";
import { parent, icon as layoutIcon, renderTree as layoutRender } from "$(drawio-ai root)/src/layout-engine.mjs";
\`\`\`

## 2. Build the diagram
Construct the diagram using the declarative layout engine (parent/group/icon nodes). Each node gets absolute coordinates — never hardcode layout; use the layout engine.

## 3. Validate
Run \`drawio-ai validate <file>\` on the generated XML. Fix any errors before proceeding.

## 4. Render
Run \`drawio-ai render <file> -o <output.png>\` to produce a PNG for visual verification.

## 5. Write output to an absolute path under the user's project
Never write into the kit itself. Always write the .drawio (and rendered .png) to the user's project directory, using an absolute path they specify.

## Loop
If the visual check reveals layout issues, go back to step 2 (rebuild), then re-validate and re-render. Do not skip validation.`;
}
