import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildIndexByDate,
  buildMonthChunks,
  denseRankByTouchTime,
  isoDate,
  normalizeTouchTime,
  resolveSnapshotDates,
  timeSeconds,
  toSiteSample,
} from "./market-data-core.mjs";
import { createTushareClient } from "./tushare-client.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const GENERATED_DIR = path.join(PROJECT_ROOT, "src", "generated");
const TURNOVER_THRESHOLD_YUAN = 10_000_000_000;
const INDEX_DEFINITIONS = [
  { code: "000300.SH", name: "沪深300", field: "index_hs300_pct_chg" },
  { code: "000001.SH", name: "上证指数", field: "index_sse_pct_chg" },
  { code: "000852.SH", name: "中证1000", field: "index_csi1000_pct_chg" },
];
const LIMIT_FIELDS = [
  "trade_date", "ts_code", "industry", "name", "close", "pct_chg", "amount",
  "limit_amount", "float_mv", "total_mv", "turnover_ratio", "fd_amount",
  "first_time", "last_time", "open_times", "up_stat", "limit_times", "limit",
].join(",");
const DAILY_FIELDS = "ts_code,trade_date,open,high,low,close,pre_close,pct_chg,vol,amount";

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

function assertCompactDate(value, label) {
  if (!/^\d{8}$/.test(value || "")) throw new Error(`${label} must use YYYYMMDD`);
  return value;
}

function indexContextFromRows(rows) {
  const context = {};
  for (const row of rows) {
    const definition = INDEX_DEFINITIONS.find((candidate) => candidate.code === row.ts_code);
    const pctChange = Number(row.pct_chg);
    const close = Number(row.close);
    if (!definition || !Number.isFinite(pctChange) || !Number.isFinite(close)) {
      throw new Error(`Invalid index row ${row.ts_code}/${row.trade_date}`);
    }
    const date = isoDate(row.trade_date);
    context[date] ||= {};
    context[date][definition.code] = { name: definition.name, close, pct_chg: pctChange / 100 };
  }
  return context;
}

function attachIndexContext(records, context) {
  return records.map((record) => {
    const marketIndices = context[record.trigger_date] || {};
    for (const definition of INDEX_DEFINITIONS) {
      if (!marketIndices[definition.code]) {
        throw new Error(`Missing ${definition.code} index data on ${record.trigger_date}`);
      }
    }
    return {
      ...record,
      market_indices: marketIndices,
      ...Object.fromEntries(INDEX_DEFINITIONS.map((definition) => [
        definition.field,
        marketIndices[definition.code].pct_chg,
      ])),
    };
  });
}

function serializeModule(exports) {
  return `${Object.entries(exports).map(([name, value]) => (
    `export const ${name} = ${JSON.stringify(value, null, 2)};`
  )).join("\n\n")}\n`;
}

const asOfDate = assertCompactDate(process.env.AS_OF_DATE || shanghaiTodayCompact(), "AS_OF_DATE");
const startDate = assertCompactDate(process.env.START_DATE || `${asOfDate.slice(0, 4)}0101`, "START_DATE");
const tushare = createTushareClient({ token: process.env.TUSHARE_TOKEN });

const calendarRows = await tushare(
  "trade_cal",
  { exchange: "SSE", start_date: startDate, end_date: asOfDate, is_open: "1" },
  "cal_date,is_open,pretrade_date",
);
const openDates = calendarRows
  .filter((row) => String(row.is_open) === "1")
  .map((row) => String(row.cal_date))
  .sort();
const { dataAsOf, triggerEnd } = resolveSnapshotDates(openDates, asOfDate);
const eligibleOpenDates = openDates.filter((date) => date >= startDate && date <= dataAsOf);
const openDateSet = new Set(eligibleOpenDates);
const nextOpenDate = new Map(eligibleOpenDates.slice(0, -1).map((date, index) => [date, eligibleOpenDates[index + 1]]));

const limitRows = [];
for (const chunk of buildMonthChunks(startDate, triggerEnd)) {
  for (const limitType of ["U", "Z"]) {
    const rows = await tushare("limit_list_d", {
      start_date: chunk.startDate,
      end_date: chunk.endDate,
      limit_type: limitType,
    }, LIMIT_FIELDS);
    limitRows.push(...rows);
  }
}

const candidates = limitRows
  .filter((row) => (
    openDateSet.has(String(row.trade_date))
    && String(row.trade_date) <= triggerEnd
    && (row.limit === "U" || row.limit === "Z")
    && Number(row.amount) >= TURNOVER_THRESHOLD_YUAN
  ))
  .map((row) => {
    const firstTouchTime = normalizeTouchTime(row.first_time);
    if (!firstTouchTime) throw new Error(`Missing first touch time for ${row.ts_code}/${row.trade_date}`);
    return {
      ...row,
      trigger_date: isoDate(String(row.trade_date)),
      first_touch_time: firstTouchTime,
      first_touch_seconds: timeSeconds(firstTouchTime),
      next_trade_date_raw: nextOpenDate.get(String(row.trade_date)) || null,
      turnover_yi: Number(row.amount) / 100_000_000,
      limit_status: row.limit === "U" ? "涨停收盘" : "炸板",
    };
  });

const rankedCandidates = [];
const candidatesByDate = Map.groupBy(candidates, (row) => String(row.trade_date));
for (const rows of candidatesByDate.values()) rankedCandidates.push(...denseRankByTouchTime(rows));

const dailyDates = [...new Set(rankedCandidates.flatMap((row) => [
  String(row.trade_date),
  row.next_trade_date_raw,
]).filter(Boolean))].sort();
const dailyByDateCode = new Map();
for (const tradeDate of dailyDates) {
  const rows = await tushare("daily", { trade_date: tradeDate }, DAILY_FIELDS);
  dailyByDateCode.set(tradeDate, new Map(rows.map((row) => [row.ts_code, row])));
}

const baseRecords = rankedCandidates.map((row) => {
  const triggerDaily = dailyByDateCode.get(String(row.trade_date))?.get(row.ts_code) || null;
  const nextDaily = dailyByDateCode.get(row.next_trade_date_raw)?.get(row.ts_code) || null;
  const dailyTurnoverYuan = triggerDaily?.amount == null ? null : Number(triggerDaily.amount) * 1_000;
  const nextOpenPremium = nextDaily?.open != null && nextDaily?.pre_close
    ? Number(nextDaily.open) / Number(nextDaily.pre_close) - 1
    : null;
  return {
    trigger_date: row.trigger_date,
    ts_code: row.ts_code,
    name: row.name,
    industry: row.industry,
    limit_status: row.limit_status,
    first_touch_time: row.first_touch_time,
    first_touch_seconds: row.first_touch_seconds,
    touch_rank: row.touch_rank,
    touch_rank_label: `第${row.touch_rank}个`,
    daily_candidate_count: row.daily_candidate_count,
    turnover_yuan: Number(row.amount),
    turnover_yi: row.turnover_yi,
    daily_turnover_yuan: dailyTurnoverYuan,
    turnover_source_delta_yuan: dailyTurnoverYuan == null ? null : Number(row.amount) - dailyTurnoverYuan,
    turnover_check_pass: dailyTurnoverYuan != null
      && dailyTurnoverYuan >= TURNOVER_THRESHOLD_YUAN
      && Math.abs(Number(row.amount) - dailyTurnoverYuan) <= 1_000,
    trigger_close: Number(row.close),
    trigger_pct_chg: Number(row.pct_chg),
    turnover_ratio: row.turnover_ratio == null ? null : Number(row.turnover_ratio),
    last_touch_time: normalizeTouchTime(row.last_time),
    open_times: row.open_times == null ? null : Number(row.open_times),
    up_stat: row.up_stat,
    limit_times: row.limit_times == null ? null : Number(row.limit_times),
    next_trade_date: row.next_trade_date_raw ? isoDate(row.next_trade_date_raw) : null,
    next_open: nextDaily?.open == null ? null : Number(nextDaily.open),
    next_pre_close: nextDaily?.pre_close == null ? null : Number(nextDaily.pre_close),
    next_open_premium: nextOpenPremium,
    source_limit_ref: `tushare:limit_list_d#${row.ts_code}/${row.trade_date}`,
    source_trigger_daily_ref: `tushare:daily#${row.ts_code}/${row.trade_date}`,
    source_next_daily_ref: row.next_trade_date_raw ? `tushare:daily#${row.ts_code}/${row.next_trade_date_raw}` : null,
  };
});

const indexRows = [];
for (const definition of INDEX_DEFINITIONS) {
  indexRows.push(...await tushare(
    "index_daily",
    { ts_code: definition.code, start_date: startDate, end_date: triggerEnd },
    "ts_code,trade_date,close,pre_close,pct_chg",
  ));
}
const records = attachIndexContext(baseRecords, indexContextFromRows(indexRows))
  .sort((left, right) => (
    left.trigger_date.localeCompare(right.trigger_date)
    || left.touch_rank - right.touch_rank
    || left.ts_code.localeCompare(right.ts_code)
  ));

const incompleteRows = records.filter((row) => (
  !row.turnover_check_pass
  || !Number.isFinite(row.next_open_premium)
  || !Number.isFinite(row.touch_rank)
));
if (incompleteRows.length) {
  throw new Error(`Refusing to publish ${incompleteRows.length} incomplete or unverified rows`);
}

const metadata = {
  schema: "market-trace-v2",
  timezone: "Asia/Shanghai",
  dataStart: isoDate(startDate),
  triggerEnd: isoDate(triggerEnd),
  updatedAt: isoDate(dataAsOf),
  recordCount: records.length,
  tradeDayCount: new Set(records.map((row) => row.trigger_date)).size,
  thresholdYuan: TURNOVER_THRESHOLD_YUAN,
  premiumDefinition: "次日开盘价 / 次日前收盘价 - 1",
  rankDefinition: "同日合格样本按首次触板时间升序做密集排名，同秒并列",
  sources: [
    "https://tushare.pro/document/2?doc_id=298",
    "https://tushare.pro/document/2?doc_id=27",
    "https://tushare.pro/document/2?doc_id=26",
    "https://tushare.pro/document/2?doc_id=95",
  ],
};
const samples = records.map(toSiteSample);
const indexByDate = buildIndexByDate(records, INDEX_DEFINITIONS);

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(GENERATED_DIR, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(DATA_DIR, "a-share-limit-touch-ytd.json"), `${JSON.stringify({ metadata, records }, null, 2)}\n`),
  fs.writeFile(path.join(GENERATED_DIR, "marketData.js"), serializeModule({ dataMetadata: metadata, samples })),
  fs.writeFile(path.join(GENERATED_DIR, "indexData.js"), serializeModule({
    indexDefinitions: INDEX_DEFINITIONS.map(({ code, name }) => ({ code, name })),
    indexByDate,
  })),
]);

console.log(JSON.stringify({
  dataStart: metadata.dataStart,
  triggerEnd: metadata.triggerEnd,
  updatedAt: metadata.updatedAt,
  records: metadata.recordCount,
  tradeDays: metadata.tradeDayCount,
}, null, 2));
