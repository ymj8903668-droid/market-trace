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
  assert.equal(summary.up.count, 46);
  assert.equal(summary.down.count, 14);
  assert.equal(summary.flat.count, 0);
  assert.ok(summary.up.averagePremium > 0.016);
  assert.ok(summary.down.averagePremium < -0.014);
});
