# Glossary

The canonical vocabulary for the drawio-ai-kit project. Implementation details
live in code and ADRs, not here.

## Kit

**drawio-ai-kit** — the deterministic *tooling backend*. The repo itself: the
AWS/OSS stencil `catalog/`, the `drawio-ai` CLI, the `builder.mjs` +
`layout-engine.mjs` diagram engine, and the `rules/`. A zero-dependency global
npm package (`npm i -g drawio-ai-kit`) on Node 18+. Has no opinions about which
agent consumes it.

## CLI

**`drawio-ai`** — the Kit's sole tool surface: the deterministic commands an
agent shells out to (`search`, `validate`, `render`, `principles`, `workflow`,
`logo`, `root`, …). Replaced the former MCP server; there is no MCP mode.
Skills call the CLI at any time.

## Shared Workflow

The build → validate → render → write-path loop every Domain Skill shares,
served once by `drawio-ai workflow` (not copied into each skill).

## Domain Skill

A small, single-domain `SKILL.md` an agent reads to produce diagrams — one per
rule domain (`drawio-aws`, `drawio-azure`, `drawio-gcp`, `drawio-databricks`,
`drawio-bpmn`). The agent-facing frontend. Each is thin: a sharp trigger
description, a preflight that checks the CLI is installed, a pointer to the
Shared Workflow, and its own rules via `drawio-ai principles --mode <domain>`.
A Domain Skill is inert without the Kit behind it.

## Agent

The coding assistant a Domain Skill is installed *into* — Claude Code, Codex,
Gemini CLI, Cursor, etc. Each Agent has its own skills directory; skills are
distributed via the standard npm skills tooling.
