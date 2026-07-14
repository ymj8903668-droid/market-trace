import test from "node:test";
import assert from "node:assert/strict";

import { samples } from "./data.js";
import { getIndexChange, getIndexDirection, summarizeIndexDays } from "./marketContext.js";

test("getIndexChange returns the selected benchmark change for a sample date", () => {
  assert.equal(getIndexChange("2026-07-09", "000300.SH"), 0.025398);
  assert.equal(getIndexDirection(0.025398), "up");
  assert.equal(getIndexDirection(-0.0001), "down");
  assert.equal(getIndexDirection(0), "flat");
});

test("summarizeIndexDays groups every sample by the selected benchmark direction", () => {
  const summary = summarizeIndexDays(samples, "000300.SH");
  const expectedCounts = samples.reduce((counts, row) => {
    counts[getIndexDirection(getIndexChange(row.d, "000300.SH"))] += 1;
    return counts;
  }, { up: 0, down: 0, flat: 0 });

  assert.equal(summary.up.count, expectedCounts.up);
  assert.equal(summary.down.count, expectedCounts.down);
  assert.equal(summary.flat.count, expectedCounts.flat);
  assert.equal(summary.up.count + summary.down.count + summary.flat.count, samples.length);
  assert.ok(Number.isFinite(summary.up.averagePremium));
  assert.ok(Number.isFinite(summary.down.averagePremium));
});
