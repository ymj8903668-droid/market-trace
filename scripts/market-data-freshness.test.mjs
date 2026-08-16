import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMarketDataFreshness,
  latestOpenDate,
} from "./market-data-freshness.mjs";

test("latestOpenDate ignores future sessions and returns the latest completed market date", () => {
  assert.equal(
    latestOpenDate(["20260814", "20260817", "20260818"], "20260817"),
    "20260817",
  );
});

test("freshness check passes on a weekday holiday when data matches the last open date", () => {
  assert.deepEqual(
    evaluateMarketDataFreshness({ actualUpdatedAt: "2026-09-30", expectedUpdatedAt: "2026-09-30" }),
    {
      fresh: true,
      actualUpdatedAt: "2026-09-30",
      expectedUpdatedAt: "2026-09-30",
      lagDays: 0,
    },
  );
});

test("freshness check fails when the committed site data is behind the latest open date", () => {
  assert.deepEqual(
    evaluateMarketDataFreshness({ actualUpdatedAt: "2026-08-14", expectedUpdatedAt: "2026-08-17" }),
    {
      fresh: false,
      actualUpdatedAt: "2026-08-14",
      expectedUpdatedAt: "2026-08-17",
      lagDays: 3,
    },
  );
});

test("freshness helpers reject missing market dates", () => {
  assert.throws(() => latestOpenDate([], "20260817"), /No completed open date/);
  assert.throws(
    () => evaluateMarketDataFreshness({ actualUpdatedAt: "", expectedUpdatedAt: "2026-08-17" }),
    /Invalid actualUpdatedAt/,
  );
});
