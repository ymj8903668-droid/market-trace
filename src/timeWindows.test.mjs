import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIME_WINDOW,
  filterSamplesByWindow,
  getTimeWindow,
  summarizeSamples,
  timeWindowDefinitions,
} from "./timeWindows.js";

const rows = [
  { d: "2026-01-01", s: "涨停收盘", r: 1, a: 100, p: 0.02 },
  { d: "2026-05-14", s: "炸板", r: 2, a: 120, p: -0.01 },
  { d: "2026-05-15", s: "炸板", r: 3, a: 140, p: 0 },
  { d: "2026-06-13", s: "涨停收盘", r: 1, a: 160, p: 0.01 },
  { d: "2026-06-14", s: "涨停收盘", r: 2, a: 180, p: 0.03 },
  { d: "2026-07-13", s: "炸板", r: 4, a: 200, p: -0.02 },
];

test("time-window options default to the latest 30 calendar days", () => {
  assert.equal(DEFAULT_TIME_WINDOW, "1m");
  assert.deepEqual(timeWindowDefinitions.map(({ key, label }) => ({ key, label })), [
    { key: "1m", label: "近1个月" },
    { key: "2m", label: "近2个月" },
    { key: "ytd", label: "今年以来" },
  ]);
  assert.deepEqual(getTimeWindow("1m", "2026-07-13"), {
    key: "1m",
    label: "近1个月",
    startDate: "2026-06-14",
    endDate: "2026-07-13",
  });
});

test("two-month and year-to-date windows use inclusive calendar boundaries", () => {
  assert.equal(getTimeWindow("2m", "2026-07-13").startDate, "2026-05-15");
  assert.equal(getTimeWindow("ytd", "2026-07-13").startDate, "2026-01-01");
  assert.throws(() => getTimeWindow("unknown", "2026-07-13"), /Unknown time window/);
});

test("filterSamplesByWindow includes both start and end dates", () => {
  assert.deepEqual(
    filterSamplesByWindow(rows, getTimeWindow("1m", "2026-07-13")).map((row) => row.d),
    ["2026-06-14", "2026-07-13"],
  );
  assert.deepEqual(
    filterSamplesByWindow(rows, getTimeWindow("2m", "2026-07-13")).map((row) => row.d),
    ["2026-05-15", "2026-06-13", "2026-06-14", "2026-07-13"],
  );
});

test("summarizeSamples recomputes every metric for the selected window", () => {
  const summary = summarizeSamples(filterSamplesByWindow(rows, getTimeWindow("1m", "2026-07-13")));

  assert.equal(summary.records, 2);
  assert.equal(summary.tradeDays, 2);
  assert.equal(summary.averagePremium, 0.005);
  assert.equal(summary.positiveRate, 0.5);
  assert.equal(summary.averageTurnover, 190);
  assert.equal(summary.minimumPremium, -0.02);
  assert.equal(summary.maximumPremium, 0.03);
  assert.deepEqual(summary.closed, { count: 1, averagePremium: 0.03, positiveRate: 1 });
  assert.deepEqual(summary.broken, { count: 1, averagePremium: -0.02, positiveRate: 0 });
  assert.deepEqual(summary.ranks.map(({ label, count }) => ({ label, count })), [
    { label: "第1个触板", count: 0 },
    { label: "第2个触板", count: 1 },
    { label: "第3个及以后", count: 1 },
  ]);
});

test("summarizeSamples returns null averages instead of NaN for an empty window", () => {
  const summary = summarizeSamples([]);

  assert.equal(summary.records, 0);
  assert.equal(summary.averagePremium, null);
  assert.equal(summary.averageTurnover, null);
  assert.equal(summary.minimumPremium, null);
  assert.equal(summary.maximumPremium, null);
  assert.equal(summary.closed.averagePremium, null);
  assert.equal(summary.ranks[0].averagePremium, null);
});
