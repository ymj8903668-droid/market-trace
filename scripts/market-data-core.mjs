function parseCompactDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value || "");
  if (!match) throw new Error(`Invalid compact date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function compactDate(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function isoDate(value) {
  if (!/^\d{8}$/.test(value || "")) throw new Error(`Invalid compact date: ${value}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function buildMonthChunks(startDate, endDate) {
  if (startDate > endDate) throw new Error("startDate must not be after endDate");
  const chunks = [];
  let cursor = parseCompactDate(startDate);
  const finalDate = parseCompactDate(endDate);

  while (cursor <= finalDate) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const chunkEnd = monthEnd < finalDate ? monthEnd : finalDate;
    chunks.push({ startDate: compactDate(cursor), endDate: compactDate(chunkEnd) });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return chunks;
}

export function resolveSnapshotDates(openDates, asOfDate) {
  const completedDates = [...new Set(openDates)]
    .filter((date) => date <= asOfDate)
    .sort();
  if (completedDates.length < 2) {
    throw new Error("At least two completed trading sessions are required");
  }
  return {
    dataAsOf: completedDates.at(-1),
    triggerEnd: completedDates.at(-2),
  };
}

export function normalizeTouchTime(value) {
  if (value == null || value === "") return null;
  const digits = String(value).replace(/\D/g, "").padStart(6, "0").slice(-6);
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
}

export function timeSeconds(value) {
  if (!value) return null;
  const [hour, minute, second] = value.split(":").map(Number);
  return hour * 3600 + minute * 60 + second;
}

export function denseRankByTouchTime(rows) {
  const sorted = [...rows].sort((left, right) => (
    (left.first_touch_seconds ?? Number.MAX_SAFE_INTEGER) - (right.first_touch_seconds ?? Number.MAX_SAFE_INTEGER)
    || left.ts_code.localeCompare(right.ts_code)
  ));
  const distinctTimes = [...new Set(sorted.map((row) => row.first_touch_seconds).filter(Number.isFinite))].sort((a, b) => a - b);
  const rankByTime = new Map(distinctTimes.map((value, index) => [value, index + 1]));

  return sorted.map((row) => ({
    ...row,
    touch_rank: Number.isFinite(row.first_touch_seconds) ? rankByTime.get(row.first_touch_seconds) : null,
    daily_candidate_count: sorted.length,
  }));
}

const round = (value, digits) => {
  const multiplier = 10 ** digits;
  return Math.round(Number(value) * multiplier) / multiplier;
};

export function toSiteSample(record) {
  return {
    d: record.trigger_date,
    c: record.ts_code,
    n: record.name,
    s: record.limit_status,
    t: record.first_touch_time,
    x: record.first_touch_seconds,
    r: record.touch_rank,
    a: round(record.turnover_yi, 1),
    p: round(record.next_open_premium, 6),
  };
}

export function buildIndexByDate(records, definitions) {
  return Object.fromEntries(records.map((record) => [
    record.trigger_date,
    Object.fromEntries(definitions.map((definition) => [
      definition.code,
      Number(record[definition.field]),
    ])),
  ]));
}
