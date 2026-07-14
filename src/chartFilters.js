import { getIndexChange, getIndexDirection } from "./marketContext.js";

export const defaultChartFilters = Object.freeze({
  closed: true,
  broken: true,
  rank1: true,
  rank2: true,
  rank3Plus: true,
  indexUp: true,
  indexDown: true,
});

function matchesStatus(row, filters) {
  return row.s === "涨停收盘" ? filters.closed : filters.broken;
}

function matchesRank(row, filters) {
  if (row.r === 1) return filters.rank1;
  if (row.r === 2) return filters.rank2;
  return filters.rank3Plus;
}

function matchesIndexDirection(row, filters, selectedIndexCode) {
  const direction = getIndexDirection(getIndexChange(row.d, selectedIndexCode));
  if (direction === "up") return filters.indexUp;
  if (direction === "down") return filters.indexDown;
  return filters.indexUp && filters.indexDown;
}

export function filterSamples(rows, filters, selectedIndexCode) {
  return rows.filter((row) => (
    matchesStatus(row, filters)
    && matchesRank(row, filters)
    && matchesIndexDirection(row, filters, selectedIndexCode)
  ));
}
