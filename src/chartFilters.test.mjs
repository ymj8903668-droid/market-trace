import test from "node:test";
import assert from "node:assert/strict";

import { samples } from "./data.js";
import { defaultChartFilters, filterSamples } from "./chartFilters.js";
import { getIndexChange, getIndexDirection } from "./marketContext.js";

const INDEX_CODE = "000300.SH";

test("default chart filters keep every sample visible", () => {
  const visible = filterSamples(samples, defaultChartFilters, INDEX_CODE);

  assert.equal(visible.length, samples.length);
});

test("turning off broken samples keeps only limit-up closes", () => {
  const visible = filterSamples(
    samples,
    { ...defaultChartFilters, broken: false },
    INDEX_CODE,
  );

  assert.equal(visible.length, samples.filter((row) => row.s === "涨停收盘").length);
  assert.ok(visible.every((row) => row.s === "涨停收盘"));
});

test("rank and index-direction filters combine with AND semantics", () => {
  const visible = filterSamples(
    samples,
    {
      ...defaultChartFilters,
      rank2: false,
      rank3Plus: false,
      indexUp: false,
    },
    INDEX_CODE,
  );

  assert.ok(visible.length > 0);
  assert.ok(visible.every((row) => row.r === 1));
  assert.ok(visible.every((row) => (
    getIndexDirection(getIndexChange(row.d, INDEX_CODE)) === "down"
  )));
});

test("turning off every category returns an empty visible set", () => {
  const visible = filterSamples(
    samples,
    Object.fromEntries(Object.keys(defaultChartFilters).map((key) => [key, false])),
    INDEX_CODE,
  );

  assert.equal(visible.length, 0);
});
