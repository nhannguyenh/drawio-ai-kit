# Adding a Domain Skill

A Domain Skill is a sharp trigger that hands an AI the right rules for one diagram domain (AWS, Azure, GCP, Databricks, BPMN). Domain knowledge stays in the Kit behind the CLI; the skill is a pointer to the Shared Workflow. This keeps each skill thin and the Kit single-sourced.

Three moves, in order:

## Move 1 — Add the rule file

Create `rules/<domain>-architecture.md` with the domain's hierarchy and shape rules.

Follow the pattern of any existing rule file:
`rules/aws-architecture.md`, `azure-architecture.md`, `gcp-architecture.md`, `databricks-architecture.md`, or `bpmn.md`.

Content: layer ordering, parent-child constraints, forbidden connectors, icon naming conventions — whatever makes a correct diagram for that domain.

## Move 2 — Wire `--mode`

In `src/cli.mjs`, the `principles` case maps a `--mode` value to its rule file.

- **Cloud-like domains** — add an entry to the `cloudMap` object:
  ```js
  const cloudMap = { azure: "azure-architecture.md", gcp: "gcp-architecture.md", databricks: "databricks-architecture.md", "<domain>": "<domain>-architecture.md" };
  ```
  These get combined with the shared files (`principles.md`, `diagram-types.md`, `style-guide.md`).

- **Non-cloud domains** (like BPMN) — add a dedicated `if (mode === "...")` branch with whatever file combination the domain needs.

Default (`aws`) and `bpmn` branches already exist as reference.

## Move 3 — Drop in the skill folder

Create `skills/drawio-<domain>/SKILL.md` from the canonical template below.

Replace `<DOMAIN>` with the domain name. Write a sharp `description` in frontmatter — it is the trigger for the AI to load this skill.

```markdown
---
name: drawio-<DOMAIN>
version: 1.0.0
description: <SHARP DOMAIN TRIGGER — e.g. "AWS architecture diagram">
license: MIT
---

# Draw.io <Domain>

<one-line purpose>. This skill is a thin frontend; the deterministic engine,
validator, and rules live in the `drawio-ai-kit` package, reached via the
`drawio-ai` CLI.

## 0. Preflight — the CLI must be installed

```bash
command -v drawio-ai >/dev/null 2>&1 || echo "Install the Kit first:  npm i -g github:sparklabx/drawio-ai-kit"
```

If `drawio-ai` is **not** on PATH, stop and tell the user to run
`npm i -g github:sparklabx/drawio-ai-kit`. **Never run `npm i -g` yourself** — nothing mutates the
user's global environment without their say-so.

## 1. Delegate the build (preferred when your harness supports it)

If your harness can spawn autonomous subagents that run shell commands AND read
images (e.g. Claude Code's Task tool, a general-purpose agent), run the whole
build loop in a subagent — the rules, icon searches, and every render/fix
iteration then cost this conversation nothing. If it can't (or the subagent
can't read images), skip to **Inline path** below — same loop, same rules.

**Before spawning**, resolve what the subagent cannot ask about: diagram scope,
output directory (absolute path under the user's project), filename. Run the
preflight above yourself. For a multi-diagram request, spawn one subagent per
diagram in parallel with distinct filenames.


**Model routing** — if your harness lets you choose the subagent's model, route by
task weight: a **fast/cheap tier** (Claude Haiku-class — must support vision) when
the request matches a template from the rules' Templates table (reproduction is
mechanical; the validator's advice strings teach every fix), your **default strong
model** for free-hand or novel architectures. If a cheap subagent returns VALIDATE
not ok or ITERATIONS > 3, respawn ONCE on the strong model before taking over
inline. Multi-diagram requests: route each diagram independently.

Subagent prompt (fill every `<...>`):

<subagent prompt template — copy from any existing skills/drawio-*/SKILL.md and
swap the domain noun + `--mode <DOMAIN>`; keep the 7-line return contract
(DRAWIO/PNG/VALIDATE/ICONS/ITERATIONS/SUMMARY/ASSUMPTIONS) identical>

Relay `DRAWIO`, `PNG` and `SUMMARY` to the user verbatim; do NOT re-read the
.drawio or PNG in this conversation. If `VALIDATE` is not ok, take over via the
Inline path (the build .mjs and .drawio are on disk at the returned paths).

## Inline path (no subagent support)

### 1. Shared Workflow

```bash
drawio-ai workflow
```

Prints the build → validate → render → write-to-project-path loop every diagram
follows. Read it; it is the source of truth for the process.

### 2. Domain rules

```bash
drawio-ai principles --mode <DOMAIN>
```

Returns the <Domain> rules + shared principles + catalog categories.

### 3. Build with the engine, then validate + render

Resolve the Kit's install dir, then `import` the engine by absolute path (the
Shared Workflow shows the exact pattern):

```bash
ROOT="$(drawio-ai root)"     # absolute path to the installed Kit
```

Build with the declarative layout engine (NO hand-written coordinates), then:
`drawio-ai validate <file>` → `drawio-ai render <file> -o <file>.png` (`Read` the
PNG for the vision self-check) → write the `.drawio` to an **absolute path under
the user's project** (never the Kit, never `cwd`).

## Domain notes
<domain-specific hierarchy/shape rules — see per-domain rule file>

## Self-check (before delivering)
- [ ] Built with the layout engine — no hand-written coordinates.
- [ ] `drawio-ai validate` → ok, no warnings, no advice.
- [ ] Every icon came from `drawio-ai search` (category colors intact).
- [ ] `drawio-ai render` vision self-check passed.
- [ ] Output written under the user's project, not the Kit.
```

## Checklist

- [ ] `rules/<domain>-architecture.md` written, follows existing rule file pattern.
- [ ] `src/cli.mjs` `cloudMap` (or dedicated branch) wired for the new mode.
- [ ] `skills/drawio-<domain>/SKILL.md` created from the canonical template with a sharp description.
- [ ] `drawio-ai principles --mode <domain>` returns the right rules.
- [ ] `drawio-ai validate` and `drawio-ai search` work against a test diagram in the new domain.
- [ ] No hand-written coordinates in the template — engine only.
