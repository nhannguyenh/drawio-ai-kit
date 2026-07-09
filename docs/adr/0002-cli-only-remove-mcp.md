---
status: accepted
---

# CLI-only kit: remove the MCP server

The Kit shipped two tool surfaces over one engine — an MCP server
(`src/mcp-server.mjs`) and the `drawio-ai` CLI — kept in sync by hand, with a
multi-agent installer (see ADR-0001) that merged MCP config into six agents'
files and symlinked the engine into skill dirs. We are deleting the MCP server
and making the CLI the sole tool surface: a zero-dependency global npm package
(`npm i -g drawio-ai-kit`), consumed by thin per-domain skills that shell out to
it and resolve the engine for `import` via `drawio-ai root`. This supersedes
ADR-0001 — the config-merging installer goes away with MCP.

## Considered options

- **Keep both surfaces.** Rejected: two code paths for one engine, and the
  `@modelcontextprotocol/sdk` dependency, for a capability the CLI can cover.
- **Deprecation shim.** Rejected: prolongs the dual maintenance and the
  dependency; a clean 1.0 break is cheaper than a slow one.

## Consequences

- Dropping `@modelcontextprotocol/sdk` (the package's only dependency) makes the
  Kit zero-dep. Breaking change → 1.0.0.
- The vision self-check loses MCP's inline image. `drawio-ai render` now writes a
  PNG to disk and the agent uses its own `Read` tool to see it — one extra step,
  same loop. This is the main thing we gave up for the simplification.
- Skill distribution moves to the standard npm skills tooling; the bespoke
  installer (`installer.mjs`, `install.mjs`, `installer.test.mjs`) is deleted.
