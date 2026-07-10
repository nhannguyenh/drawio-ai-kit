---
status: accepted
---

# ADR 0004: Graphviz as an optional detected bake-router

## Context

Bake-route quality (collision-free, aesthetic) is better with a dedicated
router than the kit's in-process A* + nudge. Graphviz (`dot`) is a
battle-tested external router. The kit must stay zero-dependency (ADR-0002).

## Decision

Detect `dot` at runtime via a probe (`command -v dot`, reusing the existing
`findDrawioCli` pattern). When `dot` is present **and** the bake contract is
selected, shell out to Graphviz to compute edge routes over the kit's *fixed*
node positions — Graphviz owns routing only; the kit owns node placement
(positions are inputs to `dot`, not outputs). When `dot` is absent, fall back
to the kit's existing A*/nudge router unchanged.

Graphviz is **never** consulted in scaffold mode: drag-time routing is always
draw.io-native, so a bake-router cannot help scaffold.

## Consequences

- Bake quality improves automatically when `dot` is installed; nothing is asked
  of the user beyond having the binary on `PATH`.
- Zero-dep identity preserved — ADR-0002 is *reinforced*: nothing is added to
  `package.json` `dependencies`.
- The kit router is retained, not replaced — it remains the bake fallback and
  the source of pin selection in scaffold.

## Alternatives considered

- **Depend on a `graphviz` npm package.** Rejected: breaks ADR-0002's
  zero-dep identity.
- **Make Graphviz a required install.** Rejected: a universal install
  requirement breaks the "works everywhere" promise of a zero-dep global
  package.
