import { indexByDate } from "./indexData.js";

export function getIndexChange(date, code) {
  return indexByDate[date]?.[code] ?? null;
}

export function getIndexDirection(change) {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

export function summarizeIndexDays(samples, code) {
  const buckets = {
    up: { count: 0, total: 0 },
    down: { count: 0, total: 0 },
    flat: { count: 0, total: 0 },
  };

  for (const sample of samples) {
    const change = getIndexChange(sample.d, code);
    if (!Number.isFinite(change) || !Number.isFinite(sample.p)) continue;
    const key = getIndexDirection(change);
    buckets[key].count += 1;
    buckets[key].total += sample.p;
  }

  return Object.fromEntries(Object.entries(buckets).map(([key, bucket]) => [
    key,
    {
      count: bucket.count,
      averagePremium: bucket.count ? bucket.total / bucket.count : null,
    },
  ]));
}
