import { test } from "node:test";
import assert from "node:assert/strict";
import { Diagram } from "../src/builder.mjs";
import { group, icon, renderTree } from "../src/layout-engine.mjs";

// 5-way fan-out (mirrors test/edges.test.mjs): several edges share the gap between hub and the
// target column, so the router must produce waypoints to route them cleanly. This is the shape
// that exercises the wpXml fork — a straight A→B link generates no waypoints in either contract.
function fanOut(contract) {
  const d = new Diagram("hubspoke", { contract });
  renderTree(d, group("r", "group_region", "R", { dir: "row", gap: 80 }, [
    icon("hub", "ec2", "Hub"),
    group("col", "group_account", "Targets", { dir: "col", gap: 40 },
      ["t1", "t2", "t3", "t4", "t5"].map((id) => icon(id, "s3", id))),
  ]));
  for (const t of ["t1", "t2", "t3", "t4", "t5"]) d.link("hub", t);
  return d.toXML();
}

// pull the edge <mxCell> chunks out of the model xml
function edgeCells(xml) {
  return xml.split("<mxCell").filter((c) => /edge="1"/.test(c));
}
const PIN_RE = /exitX=([0-9.]+);exitY=([0-9.]+);exitDx=0;exitDy=0;entryX=([0-9.]+);entryY=([0-9.]+)/;

test("scaffold (default): edges carry zero <Array as=\"points\"> waypoints", () => {
  const xml = fanOut("scaffold");
  const edges = edgeCells(xml);
  assert.ok(edges.length > 0, "fan-out must produce edges");
  for (const e of edges) {
    assert.doesNotMatch(e, /<Array as="points">/, "scaffold edges must NOT freeze waypoints");
  }
});

test("scaffold (default): every edge retains edgeStyle=orthogonalEdgeStyle", () => {
  const xml = fanOut("scaffold");
  for (const e of edgeCells(xml)) {
    assert.match(e, /edgeStyle=orthogonalEdgeStyle/, "scaffold edges keep the orthogonal style");
  }
});

test("scaffold (default): every edge retains exit/entry pin fractions", () => {
  const xml = fanOut("scaffold");
  for (const e of edgeCells(xml)) {
    assert.match(e, PIN_RE, "scaffold edges must carry exitX/exitY/entryX/entryY pins");
  }
});

test("bake: at least one edge contains <Array as=\"points\"> waypoints", () => {
  const xml = fanOut("bake");
  const edges = edgeCells(xml);
  const withWp = edges.filter((e) => /<Array as="points">/.test(e));
  assert.ok(withWp.length > 0, "bake must freeze waypoints for routed edges");
});

test("bake: pin fractions still emitted (pins survive in both contracts)", () => {
  const xml = fanOut("bake");
  for (const e of edgeCells(xml)) {
    assert.match(e, PIN_RE, "bake edges also carry the exit/entry pins");
  }
});

test("scaffold: pin-selection (face/decollide) survives — two hub edges same side carry different fractions", () => {
  // With waypoints absent, the ONLY routing info in scaffold is the pins. Distinct exit fractions
  // on the same side of the hub prove decollide() ran and its output survived into scaffold.
  const xml = fanOut("scaffold");
  const pins = edgeCells(xml).map((e) => e.match(PIN_RE)).filter(Boolean);
  // group exit fractions by side (exitX): 0 = left, 1 = right
  const bySide = {};
  for (const m of pins) {
    const side = m[1];
    (bySide[side] ||= []).push(m[2]);
  }
  const sides = Object.values(bySide);
  const distinctOnOneSide = sides.some((fracs) => new Set(fracs).size > 1);
  assert.ok(distinctOnOneSide, "at least one side of the hub must carry >1 distinct exit fraction");
});

test("contract default is scaffold when omitted", () => {
  const d = new Diagram("pipeline");
  assert.equal(d.contract, "scaffold");
});

test("contract: invalid value throws a clear error", () => {
  assert.throws(() => new Diagram("pipeline", { contract: "frozen" }), /Invalid contract/);
});
