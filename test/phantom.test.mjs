// Issue #45: phantom frame primitive — invisible layout-only wrapper, distinct from a visible
// container. Lays out like a group (same measure/place) but emits NO mxCell; its children are
// reparented to the nearest visible ancestor. link() to a phantom teaches the distinction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Diagram } from "../src/builder.mjs";
import { group, phantom, icon, renderTree } from "../src/layout-engine.mjs";

// A representative tree: a visible root group wraps a phantom that holds two icons.
// After render, the icons must be parented to "root" (nearest visible ancestor), and the
// phantom id "wrap" must NOT appear as an mxCell.
function phantomTree() {
  return group("root", "group_region", "Region", {}, [
    phantom("wrap", "", { dir: "row", gap: 40 }, [icon("a", "ec2", "A"), icon("b", "s3", "B")]),
  ]);
}

test("phantom lays out like a group: children get valid x/y/w/h geometry", () => {
  const d = new Diagram();
  renderTree(d, phantomTree(), [40, 70]);
  for (const id of ["a", "b"]) {
    const r = d.R[id];
    assert.ok(r, `child ${id} should be registered`);
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y), `${id} has x/y`);
    assert.ok(r.w > 0 && r.h > 0, `${id} has positive w/h`);
  }
});

test("phantom emits no mxCell for its own id", () => {
  const d = new Diagram();
  renderTree(d, phantomTree());
  const xml = d.toXML();
  assert.match(xml, /<mxCell id="root"/, "visible root still emits a cell");
  assert.doesNotMatch(xml, /<mxCell id="wrap"/, "phantom id must NOT appear as a cell");
});

test("phantom children carry parent=<nearest visible ancestor id>", () => {
  const d = new Diagram();
  renderTree(d, phantomTree());
  const xml = d.toXML();
  for (const id of ["a", "b"]) {
    const cell = xml.split("<mxCell").find((c) => c.includes(`id="${id}"`));
    assert.ok(cell, `cell for ${id} exists`);
    assert.match(cell, /parent="root"/, `${id} must be parented to the visible ancestor "root"`);
    assert.doesNotMatch(cell, /parent="wrap"/, `${id} must NOT be parented to the phantom "wrap"`);
  }
});

test("visible frame()/group() still emit real parent cells", () => {
  const d = new Diagram();
  renderTree(d, group("root", "group_region", "Region", { dir: "row", gap: 40 }, [
    group("inner", "group_account", "Account", { dir: "col" }, [icon("a", "ec2", "A")]),
  ]));
  const xml = d.toXML();
  assert.match(xml, /<mxCell id="root"/, "root group emits a cell");
  assert.match(xml, /<mxCell id="inner"/, "inner group emits a cell");
  const innerCell = xml.split("<mxCell").find((c) => c.includes(`id="a"`));
  assert.match(innerCell, /parent="inner"/, "icon inside a real group is parented to it");
});

test("link() to a phantom throws a teaching message", () => {
  const d = new Diagram();
  renderTree(d, phantomTree());
  // source is a phantom → teaching error
  assert.throws(() => d.link("wrap", "a"), /phantom|visible frame|leaf/i);
  // target is a phantom → teaching error
  assert.throws(() => d.link("a", "wrap"), /phantom|visible frame|leaf/i);
  // a truly unknown id → still the generic "does not exist" error (not the phantom one)
  assert.throws(() => d.link("a", "nope"), /does not exist yet/);
});
