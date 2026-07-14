import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMonthChunks,
  denseRankByTouchTime,
  resolveSnapshotDates,
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
