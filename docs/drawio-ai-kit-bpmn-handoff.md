# Handoff — drawio-ai-kit BPMN skill-surface + engine optimization

**Date:** 2026-07-01
**Repo:** `/Users/huybui/code/drawio-ai-kit` (branch: working tree, uncommitted)
**Ponytail mode:** active (full)

## Next-session focus (from user)

Two threads to carry forward:

1. **Skill-file placement asymmetry** — the user believes the AWS `SKILL.md` "should be in the same place" as the BPMN one (`skills/<name>/SKILL.md`). This is an **open decision awaiting user input** — see below. Do NOT silently move files; the current layout is load-bearing and verified.
2. **Core engine problems + future optimization** — the user flagged that "the core engine contains problems" and wants optimization work in the future. Capture the specific friction points encountered while adding BPMN (listed below) as the optimization backlog.

## Current state (done + verified — do not redo)

The BPMN swimlane capability is **complete and verified end-to-end**. All 69 tests pass (`node --test`). Do not re-implement any of this; reference it.

| Area | Artifact | Status |
|---|---|---|
| Swimlane primitive | `src/layout-engine.mjs` — `pool()` (measure/place/`emitPool`) | done, tested |
| BPMN domain layer | `src/bpmn.mjs` — creators over `mxgraph.bpmn` catalog styles | done |
| Type preset | `src/types.mjs` — `bpmn` (LR, rounded, swimlane) | done |
| Catalog | `catalog/bpmn.json` — 19 Tier-1 stencils | done (names verified vs draw.io `bpmn.xml`) |
| Rules | `rules/bpmn.md` | done |
| Tier-2 roadmap | `docs/bpmn-tier2-roadmap.md` | done (deferred scope lives here) |
| Validation | `src/core.mjs` — `auditBpmn` (gateway split/merge, start/end flow, orphan) | done, +1 test |
| MCP | `src/mcp-server.mjs` — `get_principles({mode:"bpmn"})` | done |
| Example | `examples/build_bpmn.mjs` | builds, validates clean, renders |
| Installer | `src/installer.mjs` + `src/install.mjs` — stages both skills, attaches engine via sibling symlinks | done, +1 test |
| Skill doc | `skills/drawio-bpmn/SKILL.md` | done |

Change set (uncommitted): 8 modified, 6 new. `out/` is gitignored. Run `git status --short` for the exact list.

## Open decision: skill-file symmetry (BLOCKED on user)

**The question:** should `./SKILL.md` (AWS) move to `skills/drawio-aws-architect/SKILL.md` so both skills sit symmetrically under `skills/`?

**Empirical answer found this session: NO — it breaks staging.** Verified by project-local `skills` CLI staging (global store `~/.agents/skills/` untouched in all tests):

- **Root `SKILL.md`** → the `skills` CLI treats the **whole repo** as the skill → `src/`, `catalog/`, `rules/`, `vendor/` all stage with it. ✓
- **`skills/drawio-aws-architect/SKILL.md`** → the CLI scopes the skill to **that subdir only** → every engine file returns `MISSING` on staging. ✗ (tested: `src/builder.mjs`, `catalog/aws.json`, `rules/bpmn.md` all absent)

**Root cause:** the `skills` CLI defines a skill as *its containing directory*. The `skills/drawio-bpmn/` subdir skill stages as **only its `SKILL.md`** — that's why the installer attaches the engine to it via **sibling symlinks** (`~/.agents/skills/drawio-bpmn/src → ../drawio-aws-architect/src`) created post-staging (step 5b in `src/install.mjs`). This sibling-symlink mechanism is the user's idea and is verified working.

**Also verified broken:** in-repo `../../src` symlinks inside a skill dir are **blocked** by the CLI's path-traversal protection ("Skipping broken symlink") → partial copies (e.g. `catalog/aws.json` missing → `loadCatalog()` throws). Do not retry that approach.

**Current working layout (load-bearing, do not change without re-verifying):**
```
./SKILL.md                          ← drawio-aws-architect (engine host; stages whole repo)
skills/drawio-bpmn/SKILL.md         ← BPMN skill (SKILL.md only; engine attached by installer)
```

**If the user still wants symmetry**, the only reliable path is to **relocate the engine into `skills/drawio-aws-architect/`** (move `src/ catalog/ rules/ vendor/ examples/ package.json` in, make it self-contained, drop root `SKILL.md`). Cost: every import path moves — `test/*.test.mjs`, `package.json` `bin`, `examples/*.mjs`, `AGENTS.md`/dev-guide, MCP-server path. High churn, diverges from documented "engine at root." Present this tradeoff; let the user decide. **Recommendation: keep root `SKILL.md`.**

Reproduce any of this with project-local staging in an empty temp dir (never `~/.agents/skills/`):
`npx -y skills@latest add <repo> --full-depth -y` then inspect `.agents/skills/<name>/`.

## Core engine problems / optimization backlog

Friction hit while adding BPMN. These are candidates for future engine work, **not** bugs in the BPMN feature:

1. **`edgeRounded` preset is ignored by `link()`.** `src/builder.mjs` `_emitEdge` reads `rounded` as a literal opts flag; it does **not** consult `DIAGRAM_TYPES[type].edgeCorner`. So a type preset declaring `edgeCorner:"rounded"` (pipeline, bpmn) is not honored unless the caller passes `{rounded:true}`. Pre-existing — affects AWS diagrams too. **Fix:** make `_emitEdge` default `rounded` to the preset when unset. Low risk (would also fix pipeline).
2. **`icon()` geometry is AWS-sized (min 96px wide).** Unsuitable for non-AWS shapes (BPMN events are 40px circles, gateways 50px diamonds). Worked around by emitting BPMN shapes as `box`-kind nodes with a custom-style pass-through (`emit()` line ~227). **Optimization:** generalize `icon()`/`styleForIcon` sizing so non-AWS stencil families get their catalog `w/h` without the 96px floor.
3. **`pool()` is in the generic engine but BPMN-flavored.** Lane bands, phase headers, `container=1` styling live in `layout-engine.mjs`. Acceptable (reusable for other swimlane needs) but blurs the generic/domain line. If a second swimlane domain appears, factor the band/label rendering.
4. **Style-string coupling.** BPMN `shape=mxgraph.bpmn.*` display names contain spaces + mixed case (`General Start`, `User Task`) and differ from catalog keys (`bpmn_start_none`). The validator's `RE_SHAPE` regex (`aws4`, `[a-z0-9_]+`) can't whitelist them — so BPMN shape validation is build-time-only (`bpmn.mjs` throws on unknown names), not XML-level. If XML-level BPMN shape validation is wanted, add a `RE_BPMN` + a display-name lookup (note: draw.io's full BPMN stencil >> Tier-1, so warn-only).
5. **Deferred BPMN items** (intentional, tracked in `docs/bpmn-tier2-roadmap.md`): message flow between pools (dashed), cross-pool sequence-flow validation (needs coordinate-based pool membership), sub-process "+" marker, data objects, call activities, boundary events.

## Suggested skills (invoke these)

- **`brainstorming`** — to resolve the skill-symmetry decision with the user before any file moves (it's a real architectural fork with a verified wrong answer).
- **`improve-codebase-architecture`** — for the engine optimization backlog above; it's built for exactly this (find deepening opportunities informed by domain language).
- **`ponytail`** — already active; keep it on for the optimization work (the BPMN layer deliberately used stdlib/throws-over-abstraction; carry that ethos).
- **`systematic-debugging`** — if reproducing the staging/quoting issues (e.g. the `console.log` output-capture quirk, or the partial-symlink staging).
- **`verification-before-completion`** — before claiming any optimization done; the suite is `node --test` (69 tests) + the `examples/build_bpmn.mjs` smoke test (build→validate→render).
- Repo's own: **`drawio-aws-architect`** / **`drawio-bpmn`** (`skills/drawio-bpmn/SKILL.md`) — if authoring/validating diagrams while testing engine changes.

## Key pointers

- Verified-working install flow: `src/install.mjs` `orchestrate()` steps 5 (place, `--full-depth`), 5b (sibling symlinks), 6 (npm install in canonical), 7 (MCP wire).
- Constants: `src/installer.mjs` — `CANONICAL_DIR` (engine host), `BPMN_DIR`, `SKILLS`, `ENGINE_LINKS`.
- The `skills` CLI help is the source of truth for flags: `npx -y skills@latest --help` (notably `--full-depth`, `-s/--skill`, `--copy`).
- draw.io desktop CLI for rendering: `~/Applications/draw.io.app/Contents/MacOS/draw.io` (set `DRAWIO_CLI` if the MCP `render_diagram` tool can't find it).

## Out of scope / do not touch

- Do not write generated `.drawio`/`.xml` into the repo (`AGENTS.md` hard rule). Examples write to `out/` (gitignored) only.
- Do not run staging against `~/.agents/skills/` (the user's global store) without explicit consent — use project-local staging in a temp dir for verification.
