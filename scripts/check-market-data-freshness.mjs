import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isoDate } from "./market-data-core.mjs";
import {
  evaluateMarketDataFreshness,
  latestOpenDate,
} from "./market-data-freshness.mjs";
import { createTushareClient } from "./tushare-client.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = path.join(PROJECT_ROOT, "data", "a-share-limit-touch-ytd.json");

function shanghaiTodayCompact(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function compactDaysBefore(value, days) {
  if (!/^\d{8}$/.test(value || "")) throw new Error(`Invalid compact date: ${value}`);
  const date = new Date(Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
  ));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

const asOfDate = process.env.AS_OF_DATE || shanghaiTodayCompact();
const tushare = createTushareClient({ token: process.env.TUSHARE_TOKEN });
const calendarRows = await tushare(
  "trade_cal",
  {
    exchange: "SSE",
    start_date: compactDaysBefore(asOfDate, 45),
    end_date: asOfDate,
    is_open: "1",
  },
  "cal_date,is_open",
);
const expectedUpdatedAt = isoDate(latestOpenDate(
  calendarRows.filter((row) => String(row.is_open) === "1").map((row) => row.cal_date),
  asOfDate,
));
const { metadata } = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
const result = evaluateMarketDataFreshness({
  actualUpdatedAt: metadata.updatedAt,
  expectedUpdatedAt,
});

console.log(JSON.stringify({
  event: "market_data_freshness_check",
  checkedAt: new Date().toISOString(),
  ...result,
}, null, 2));

if (!result.fresh) {
  throw new Error(
    `Market data is stale: committed ${result.actualUpdatedAt}, expected ${result.expectedUpdatedAt}`,
  );
}
