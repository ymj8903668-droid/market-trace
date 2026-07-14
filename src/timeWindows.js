export const DEFAULT_TIME_WINDOW = "1m";

export const timeWindowDefinitions = Object.freeze([
  { key: "1m", label: "近1个月", calendarDays: 30 },
  { key: "2m", label: "近2个月", calendarDays: 60 },
  { key: "ytd", label: "今年以来", calendarDays: null },
]);

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function subtractCalendarDays(value, days) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() - days);
  return formatIsoDate(date);
}

export function getTimeWindow(key, endDate) {
  const definition = timeWindowDefinitions.find((candidate) => candidate.key === key);
  if (!definition) throw new Error(`Unknown time window: ${key}`);

  const startDate = definition.calendarDays == null
    ? `${endDate.slice(0, 4)}-01-01`
    : subtractCalendarDays(endDate, definition.calendarDays - 1);

  return {
    key: definition.key,
    label: definition.label,
    startDate,
    endDate,
  };
}

export function filterSamplesByWindow(rows, window) {
  return rows.filter((row) => row.d >= window.startDate && row.d <= window.endDate);
}

const round = (value) => Math.round(value * 1e12) / 1e12;

function summarizeGroup(rows) {
  if (!rows.length) return { count: 0, averagePremium: null, positiveRate: null };
  return {
    count: rows.length,
    averagePremium: round(rows.reduce((total, row) => total + row.p, 0) / rows.length),
    positiveRate: round(rows.filter((row) => row.p > 0).length / rows.length),
  };
}

export function summarizeSamples(rows) {
  const ranks = [
    { label: "第1个触板", rows: rows.filter((row) => row.r === 1) },
    { label: "第2个触板", rows: rows.filter((row) => row.r === 2) },
    { label: "第3个及以后", rows: rows.filter((row) => row.r >= 3) },
  ].map(({ label, rows: rankRows }) => ({ label, ...summarizeGroup(rankRows) }));

  return {
    records: rows.length,
    tradeDays: new Set(rows.map((row) => row.d)).size,
    averagePremium: rows.length ? round(rows.reduce((total, row) => total + row.p, 0) / rows.length) : null,
    positiveRate: rows.length ? round(rows.filter((row) => row.p > 0).length / rows.length) : null,
    averageTurnover: rows.length ? round(rows.reduce((total, row) => total + row.a, 0) / rows.length) : null,
    closed: summarizeGroup(rows.filter((row) => row.s === "涨停收盘")),
    broken: summarizeGroup(rows.filter((row) => row.s === "炸板")),
    ranks,
  };
}
