import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIndexByDate,
  buildMonthChunks,
  denseRankByTouchTime,
  resolveSnapshotDates,
  toSiteSample,
} from "./market-data-core.mjs";

test("resolveSnapshotDates keeps only trigger days with a known next-session open", () => {
  const openDates = ["20260709", "20260710", "20260713", "20260714"];

  assert.deepEqual(resolveSnapshotDates(openDates, "20260714"), {
    dataAsOf: "20260714",
    triggerEnd: "20260713",
  });
  assert.deepEqual(resolveSnapshotDates(openDates, "20260712"), {
    dataAsOf: "20260710",
    triggerEnd: "20260709",
  });
});

test("resolveSnapshotDates rejects a calendar without two completed sessions", () => {
  assert.throws(() => resolveSnapshotDates(["20260714"], "20260714"), /two completed trading sessions/);
});

test("buildMonthChunks splits long backfills without overlapping dates", () => {
  assert.deepEqual(buildMonthChunks("20260115", "20260302"), [
    { startDate: "20260115", endDate: "20260131" },
    { startDate: "20260201", endDate: "20260228" },
    { startDate: "20260301", endDate: "20260302" },
  ]);
});

test("denseRankByTouchTime gives same-second touches the same rank", () => {
  const ranked = denseRankByTouchTime([
    { ts_code: "B", first_touch_seconds: 34200 },
    { ts_code: "A", first_touch_seconds: 34200 },
    { ts_code: "C", first_touch_seconds: 35100 },
  ]);

  assert.deepEqual(ranked.map(({ ts_code, touch_rank }) => ({ ts_code, touch_rank })), [
    { ts_code: "A", touch_rank: 1 },
    { ts_code: "B", touch_rank: 1 },
    { ts_code: "C", touch_rank: 2 },
  ]);
  assert.ok(ranked.every((row) => row.daily_candidate_count === 3));
});

test("toSiteSample emits the compact, chart-ready contract", () => {
  assert.deepEqual(toSiteSample({
    trigger_date: "2026-07-13",
    ts_code: "000001.SZ",
    name: "示例股票",
    limit_status: "涨停收盘",
    first_touch_time: "10:02:03",
    first_touch_seconds: 36123,
    touch_rank: 2,
    turnover_yi: 123.456,
    next_open_premium: 0.0123456,
  }), {
    d: "2026-07-13",
    c: "000001.SZ",
    n: "示例股票",
    s: "涨停收盘",
    t: "10:02:03",
    x: 36123,
    r: 2,
    a: 123.5,
    p: 0.012346,
  });
});

test("buildIndexByDate keeps every selected benchmark on each trigger date", () => {
  const definitions = [
    { code: "000300.SH", field: "index_hs300_pct_chg" },
    { code: "000001.SH", field: "index_sse_pct_chg" },
  ];
  const records = [{
    trigger_date: "2026-07-13",
    index_hs300_pct_chg: 0.01,
    index_sse_pct_chg: -0.02,
  }];

  assert.deepEqual(buildIndexByDate(records, definitions), {
    "2026-07-13": { "000300.SH": 0.01, "000001.SH": -0.02 },
  });
});
