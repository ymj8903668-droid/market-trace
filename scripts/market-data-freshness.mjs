const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_DATE = /^\d{8}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;

function isValidIsoDate(value) {
  if (!ISO_DATE.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

function isValidCompactDate(value) {
  return COMPACT_DATE.test(value || "")
    && isValidIsoDate(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
}

function dateNumber(value, label) {
  if (!isValidIsoDate(value)) throw new Error(`Invalid ${label}: ${value || "missing"}`);
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return timestamp;
}

export function latestOpenDate(openDates, asOfDate) {
  if (!isValidCompactDate(asOfDate)) throw new Error(`Invalid asOfDate: ${asOfDate || "missing"}`);
  const completedDates = openDates
    .map(String)
    .filter((value) => isValidCompactDate(value) && value <= asOfDate)
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
