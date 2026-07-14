import { useEffect, useMemo, useRef, useState } from "react";
import { defaultChartFilters, filterSamples } from "./chartFilters.js";
import { samples } from "./data.js";
import { getIndexChange, getIndexDirection } from "./marketContext.js";

const X_MIN = 33900;
const X_MAX = 53700;
const Y_MIN = -0.09;
const Y_MAX = 0.11;

const percent = (value, digits = 2) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
const rankLabel = (rank) => (rank === 1 ? "第1个" : rank === 2 ? "第2个" : `第${rank}个`);
const clock = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}`;
const describe = (row, selectedIndex) => {
  const indexChange = getIndexChange(row.d, selectedIndex.code);
  return `${row.d} ${row.n}（${row.c}），${row.s}，${row.t}${rankLabel(row.r)}触板，成交额${row.a.toFixed(1)}亿元，${selectedIndex.name}当日${percent(indexChange)}，次日开盘溢价${percent(row.p)}`;
};

function Marker({ row, x, y, size, selectedIndex, onShow, onHide }) {
  const fill = row.s === "涨停收盘" ? "var(--blue)" : "var(--orange)";
  const indexChange = getIndexChange(row.d, selectedIndex.code);
  const direction = getIndexDirection(indexChange);
  const common = { fill, className: "chart-marker" };
  const ringClass = `market-ring ${direction}`;
  const ringSize = size + 2.5;
  const shape = row.r === 1
    ? <circle cx={x} cy={y} r={size} {...common} />
    : row.r === 2
      ? <polygon points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`} {...common} />
      : <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx="1.5" {...common} />;
  const ring = row.r === 1
    ? <circle cx={x} cy={y} r={ringSize} className={ringClass} />
    : row.r === 2
      ? <polygon points={`${x},${y - ringSize} ${x + ringSize},${y} ${x},${y + ringSize} ${x - ringSize},${y}`} className={ringClass} />
      : <rect x={x - ringSize} y={y - ringSize} width={ringSize * 2} height={ringSize * 2} rx="2" className={ringClass} />;

  return (
    <a
      href="#chart-detail"
      className="chart-point"
      aria-label={describe(row, selectedIndex)}
      onMouseEnter={() => onShow(row)}
      onMouseLeave={onHide}
      onFocus={() => onShow(row)}
      onBlur={onHide}
      onClick={(event) => { event.preventDefault(); onShow(row); }}
    >
      {ring}{shape}
    </a>
  );
}

function LegendToggle({ id, checked, onChange, icon, children }) {
  return (
    <label className="legend-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <span className="legend-symbol" aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </label>
  );
}

export function ScatterChart({ selectedIndex }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(900);
  const [active, setActive] = useState(null);
  const [filters, setFilters] = useState(defaultChartFilters);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const update = () => setWidth(Math.max(300, element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActive(null);
  }, [filters, selectedIndex.code]);

  const visibleSamples = useMemo(
    () => filterSamples(samples, filters, selectedIndex.code),
    [filters, selectedIndex.code],
  );
  const allFiltersSelected = Object.values(filters).every(Boolean);
  const currentAverage = useMemo(() => {
    if (!visibleSamples.length) return null;
    return visibleSamples.reduce((total, row) => total + row.p, 0) / visibleSamples.length;
  }, [visibleSamples]);

  const compact = width <= 560;
  const height = compact ? 390 : 470;
  const margin = { top: 22, right: compact ? 14 : 22, bottom: 58, left: compact ? 48 : 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const sx = (value) => margin.left + ((value - X_MIN) / (X_MAX - X_MIN)) * plotWidth;
  const sy = (value) => margin.top + ((Y_MAX - value) / (Y_MAX - Y_MIN)) * plotHeight;
  const radius = (amount) => 4 + Math.sqrt(Math.max(0, (amount - 100) / (446 - 100))) * (compact ? 5.5 : 7);
  const xTicks = compact ? [33900, 39600, 46800, 50400, 53700] : [33900, 36000, 39600, 46800, 50400, 53700];
  const yTicks = [-0.08, -0.04, 0, 0.04, 0.08];
  const highLow = useMemo(() => {
    if (!visibleSamples.length) return [];
    const high = visibleSamples.reduce((best, row) => (row.p > best.p ? row : best));
    const low = visibleSamples.reduce((best, row) => (row.p < best.p ? row : best));
    return high === low ? [high] : [high, low];
  }, [visibleSamples]);
  const toggleFilter = (key) => (event) => {
    const { checked } = event.currentTarget;
    setFilters((current) => ({ ...current, [key]: checked }));
  };

  return (
    <div className="chart-component" ref={containerRef}>
      <div className="chart-filter-head">
        <span>勾选显示</span>
        <span className="chart-filter-count" aria-live="polite">当前显示 {visibleSamples.length} / {samples.length}</span>
      </div>
      <fieldset className="chart-legend">
        <legend className="sr-only">图表显示筛选</legend>
        <LegendToggle id="filter-closed" checked={filters.closed} onChange={toggleFilter("closed")} icon={<i className="legend-color blue" />}>涨停收盘</LegendToggle>
        <LegendToggle id="filter-broken" checked={filters.broken} onChange={toggleFilter("broken")} icon={<i className="legend-color orange" />}>炸板</LegendToggle>
        <LegendToggle id="filter-rank-1" checked={filters.rank1} onChange={toggleFilter("rank1")} icon={<i className="legend-shape circle" />}>第1个触板</LegendToggle>
        <LegendToggle id="filter-rank-2" checked={filters.rank2} onChange={toggleFilter("rank2")} icon={<i className="legend-shape diamond" />}>第2个触板</LegendToggle>
        <LegendToggle id="filter-rank-3-plus" checked={filters.rank3Plus} onChange={toggleFilter("rank3Plus")} icon={<i className="legend-shape square" />}>第3个及以后</LegendToggle>
        <LegendToggle id="filter-index-up" checked={filters.indexUp} onChange={toggleFilter("indexUp")} icon={<i className="legend-ring up" />}>指数上涨日</LegendToggle>
        <LegendToggle id="filter-index-down" checked={filters.indexDown} onChange={toggleFilter("indexDown")} icon={<i className="legend-ring down" />}>指数下跌日</LegendToggle>
        <span className="legend-static"><i className="legend-bubble small" /><i className="legend-bubble large" />气泡大小＝成交额</span>
      </fieldset>

      <div className="chart-stage">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-description">
          <title id="chart-title">首次触板时间与次日开盘溢价</title>
          <desc id="chart-description">当前显示 {visibleSamples.length} 个样本。横轴为首次触板时间，纵轴为次日开盘溢价；颜色区分涨停收盘与炸板，形状区分同日触板顺序，气泡大小代表当日成交额，外圈代表所选指数在触板当日上涨或下跌。</desc>

          <rect className="lunch-band" x={sx(41400)} y={margin.top} width={Math.max(0, sx(46800) - sx(41400))} height={plotHeight} />
          <text className="chart-note" x={(sx(41400) + sx(46800)) / 2} y={margin.top + 15} textAnchor="middle">午休</text>

          {yTicks.map((value) => (
            <g key={value}>
              <line className={value === 0 ? "zero-line" : "grid-line"} x1={margin.left} x2={width - margin.right} y1={sy(value)} y2={sy(value)} />
              <text className="axis-tick" x={margin.left - 8} y={sy(value) + 4} textAnchor="end">{(value * 100).toFixed(0)}%</text>
            </g>
          ))}

          {xTicks.map((value) => (
            <g key={value}>
              <line className="grid-line" x1={sx(value)} x2={sx(value)} y1={margin.top} y2={height - margin.bottom} />
              <text className="axis-tick" x={sx(value)} y={height - margin.bottom + 22} textAnchor="middle">{clock(value)}</text>
            </g>
          ))}

          {currentAverage !== null && (
            <>
              <line className="average-line" x1={margin.left} x2={width - margin.right} y1={sy(currentAverage)} y2={sy(currentAverage)} />
              <text className="chart-note average-label" x={width - margin.right} y={sy(currentAverage) - 7} textAnchor="end">
                {allFiltersSelected ? "总体均值" : "筛选均值"} {percent(currentAverage)}
              </text>
            </>
          )}
          <text className="axis-label" x={margin.left + plotWidth / 2} y={height - 8} textAnchor="middle">首次触板时间</text>
          <text className="axis-label" x="14" y={margin.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 14 ${margin.top + plotHeight / 2})`}>次日开盘溢价</text>

          {visibleSamples.map((row) => (
            <Marker key={`${row.d}-${row.c}`} row={row} x={sx(row.x)} y={sy(row.p)} size={radius(row.a)} selectedIndex={selectedIndex} onShow={setActive} onHide={() => setActive(null)} />
          ))}

          {highLow.map((row) => {
            const x = sx(row.x);
            const y = sy(row.p);
            const anchor = x > width * 0.68 ? "end" : "start";
            return (
              <text key={`label-${row.c}-${row.d}`} className="point-label" x={x + (anchor === "end" ? -10 : 10)} y={y + (row.p > 0 ? -10 : 19)} textAnchor={anchor}>
                {row.n} {percent(row.p)}
              </text>
            );
          })}
        </svg>

        {active && (
          <div className="chart-tooltip" role="status">
            <strong>{active.n} · {active.c}</strong>
            <span>{active.d}｜{active.t}｜{rankLabel(active.r)}触板</span>
            <span>{active.s}｜成交额 {active.a.toFixed(1)} 亿元</span>
            <span>{selectedIndex.name}当日 {percent(getIndexChange(active.d, selectedIndex.code))}</span>
            <span>次日开盘溢价 {percent(active.p)}</span>
          </div>
        )}
        {!visibleSamples.length && (
          <div className="chart-empty" role="status">当前筛选没有显示样本，请至少勾选一个条件。</div>
        )}
      </div>

      <p id="chart-detail" className="chart-detail" aria-live="polite">
        {active
          ? describe(active, selectedIndex)
          : visibleSamples.length
            ? `悬停、点选或用键盘聚焦数据点，查看股票、日期、触板顺序、成交额、${selectedIndex.name}当日涨跌与次日开盘溢价。`
            : "调整上方勾选项以恢复样本显示。"}
      </p>
    </div>
  );
}
