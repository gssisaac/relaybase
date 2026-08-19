import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findQueryOffsets,
  locateFlatOffset,
  wrapFindIndex,
} from "./email-body-find.ts";

describe("findQueryOffsets", () => {
  it("returns nothing for an empty query", () => {
    assert.deepEqual(findQueryOffsets("Hello world", ""), []);
    assert.deepEqual(findQueryOffsets("Hello world", "   "), []);
  });

  it("finds case-insensitive non-overlapping matches", () => {
    assert.deepEqual(findQueryOffsets("Banana bandana", "an"), [
      { start: 1, end: 3 },
      { start: 3, end: 5 },
      { start: 8, end: 10 },
      { start: 10, end: 12 },
    ]);
  });

  it("matches the full query length, not the lowered needle only", () => {
    assert.deepEqual(findQueryOffsets("OK ok OK", "ok"), [
      { start: 0, end: 2 },
      { start: 3, end: 5 },
      { start: 6, end: 8 },
    ]);
  });
});

describe("wrapFindIndex", () => {
  it("wraps forward and backward", () => {
    assert.equal(wrapFindIndex(2, 3, 1), 0);
    assert.equal(wrapFindIndex(0, 3, -1), 2);
    assert.equal(wrapFindIndex(1, 3, 1), 2);
  });

  it("returns 0 when there are no matches", () => {
    assert.equal(wrapFindIndex(4, 0, 1), 0);
  });
});

describe("locateFlatOffset", () => {
  const pieces = [
    { start: 0, length: 5 },
    { start: 5, length: 3 },
  ];

  it("maps start offsets onto the owning piece", () => {
    assert.deepEqual(locateFlatOffset(pieces, 0, "start"), {
      index: 0,
      local: 0,
    });
    assert.deepEqual(locateFlatOffset(pieces, 4, "start"), {
      index: 0,
      local: 4,
    });
    assert.deepEqual(locateFlatOffset(pieces, 5, "start"), {
      index: 1,
      local: 0,
    });
  });

  it("maps exclusive end offsets, including the flattened tail", () => {
    assert.deepEqual(locateFlatOffset(pieces, 5, "end"), {
      index: 0,
      local: 5,
    });
    assert.deepEqual(locateFlatOffset(pieces, 6, "end"), {
      index: 1,
      local: 1,
    });
    assert.deepEqual(locateFlatOffset(pieces, 8, "end"), {
      index: 1,
      local: 3,
    });
  });

  it("rejects offsets outside the flattened string", () => {
    assert.equal(locateFlatOffset(pieces, -1, "start"), null);
    assert.equal(locateFlatOffset(pieces, 8, "start"), null);
    assert.equal(locateFlatOffset(pieces, 9, "end"), null);
    assert.equal(locateFlatOffset([], 0, "start"), null);
  });
});
