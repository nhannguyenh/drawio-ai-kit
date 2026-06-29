import { test } from "node:test";
import assert from "node:assert/strict";
import { Diagram } from "../src/builder.mjs";
import { group, icon, renderTree } from "../src/layout-engine.mjs";

// 5-way fan-out forces several edges to share the gap between hub and the target column → their
// trunk segments overlap unless the nudge pass separates them. Asserts the nudge invariant.
function fanOut(order) {
  const d = new Diagram("hubspoke");
  renderTree(d, group("r", "group_region", "R", { dir: "row", gap: 80 }, [
    icon("hub", "ec2", "Hub"),
    group("col", "group_account", "Targets", { dir: "col", gap: 40 },
      ["t1", "t2", "t3", "t4", "t5"].map((id) => icon(id, "s3", id))),
  ]));
  for (const t of order) d.link("hub", t);
  d.toXML(); // builds edges + runs the nudge pass
  return d;
}

test("nudge: parallel trunk segments do not overlap, no icons clipped", () => {
  const d = fanOut(["t1", "t2", "t3", "t4", "t5"]);
  assert.equal(d._overlaps, 0, "interior segments must not stack on one track");
  assert.equal(d._cross, 0, "no edge may clip an icon");
});

test("nudge: result is order-independent (deterministic global pass)", () => {
  const a = fanOut(["t1", "t2", "t3", "t4", "t5"]);
  const b = fanOut(["t5", "t4", "t3", "t2", "t1"]);
  assert.equal(a._overlaps, 0);
  assert.equal(b._overlaps, 0); // reversing link() order must not reintroduce overlaps
});

test("nudge: a straight A→B link stays straight (no spurious waypoints)", () => {
  const d = new Diagram("pipeline");
  renderTree(d, group("r", "group_region", "R", { dir: "row", gap: 80 }, [icon("a", "ec2", "A"), icon("b", "s3", "B")]));
  d.link("a", "b");
  const xml = d.toXML();
  const edge = xml.split("<mxCell").find((c) => /edge="1"/.test(c));
  assert.doesNotMatch(edge, /<mxPoint/, "an aligned straight link needs no waypoints");
  assert.equal(d._overlaps, 0);
});
