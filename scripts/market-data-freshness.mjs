const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_DATE = /^\d{8}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;

function dateNumber(value, label) {
  if (!ISO_DATE.test(value || "")) throw new Error(`Invalid ${label}: ${value || "missing"}`);
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${label}: ${value}`);
  return timestamp;
}

export function latestOpenDate(openDates, asOfDate) {
  if (!COMPACT_DATE.test(asOfDate || "")) throw new Error(`Invalid asOfDate: ${asOfDate || "missing"}`);
  const completedDates = openDates
    .map(String)
    .filter((value) => COMPACT_DATE.test(value) && value <= asOfDate)
    .sort();
  const latest = completedDates.at(-1);
  if (!latest) throw new Error(`No completed open date on or before ${asOfDate}`);
  return latest;
}

export function evaluateMarketDataFreshness({ actualUpdatedAt, expectedUpdatedAt }) {
  const actual = dateNumber(actualUpdatedAt, "actualUpdatedAt");
  const expected = dateNumber(expectedUpdatedAt, "expectedUpdatedAt");
  return {
    fresh: actual >= expected,
    actualUpdatedAt,
    expectedUpdatedAt,
    lagDays: Math.round((expected - actual) / DAY_MS),
  };
}
