import { useMemo, useState } from "react";

import xuanjiMark from "./assets/xuanji-mark.png";
import xuanjiMiniProgram from "./assets/xuanji-mini-program.jpg";
import xuanjiWordmark from "./assets/xuanji-wordmark.png";
import { MarketContextPanel } from "./MarketContextPanel.jsx";
import { ScatterChart } from "./ScatterChart.jsx";
import { dataMetadata, samples } from "./data.js";
import { indexDefinitions } from "./indexData.js";
import { summarizeIndexDays } from "./marketContext.js";
import {
  DEFAULT_TIME_WINDOW,
  filterSamplesByWindow,
  getTimeWindow,
  summarizeSamples,
  timeWindowDefinitions,
} from "./timeWindows.js";

const percent = (value, digits = 2) => Number.isFinite(value)
  ? `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`
  : "—";
const turnover = (value) => Number.isFinite(value) ? `${value.toFixed(1)} 亿` : "—";

function Stat({ value, label, note }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </div>
  );
}

export function App() {
  const [selectedIndexCode, setSelectedIndexCode] = useState(indexDefinitions[0].code);
  const [selectedWindowKey, setSelectedWindowKey] = useState(DEFAULT_TIME_WINDOW);
  const selectedIndex = indexDefinitions.find((definition) => definition.code === selectedIndexCode) || indexDefinitions[0];
  const selectedWindow = useMemo(
    () => getTimeWindow(selectedWindowKey, dataMetadata.triggerEnd),
    [selectedWindowKey],
  );
  const windowSamples = useMemo(
    () => filterSamplesByWindow(samples, selectedWindow),
    [selectedWindow],
  );
  const report = useMemo(() => summarizeSamples(windowSamples), [windowSamples]);
  const indexSummary = useMemo(
    () => summarizeIndexDays(windowSamples, selectedIndexCode),
    [windowSamples, selectedIndexCode],
  );
  const windowLabel = `${selectedWindow.startDate} — ${selectedWindow.endDate}`;

  return (
    <div className="site-shell">
      <header className="masthead">
        <div className="page nav-row" aria-label="网站信息">
          <a className="wordmark" href="#top" aria-label="玄玑 Market Trace，返回顶部">
            <img className="wordmark-logo" src={xuanjiWordmark} alt="玄玑" />
            <span className="wordmark-copy">
              <strong>MARKET TRACE</strong>
              <small>市场样本观察</small>
            </span>
          </a>
          <span className="updated">数据更新 · {dataMetadata.updatedAt.replaceAll("-", ".")}</span>
        </div>

        <div id="top" className="page hero">
          <p className="eyebrow">A股高成交触板样本</p>
          <h1><span>百亿成交触板之后，</span><span>次日开盘表现如何？</span></h1>
          <p className="hero-copy">
            追踪所选时间窗口内，当日最终成交额不低于 100 亿元、盘中曾触及涨停价的 A 股样本，观察首次触板时间、同日触板顺序与次日开盘溢价。
          </p>
          <div className="scope-line" aria-label="统计口径概览">
            <span>{windowLabel}</span>
            <span>最终成交额 ≥ 100 亿元</span>
            <span>含涨停收盘与炸板</span>
            <span>指数环境：沪深300 / 上证 / 中证1000</span>
          </div>
        </div>
      </header>

      <main>
        <section className="page overview" aria-labelledby="overview-title">
          <div className="overview-toolbar">
            <div className="section-kicker" id="overview-title">样本概览</div>
            <div className="time-window-control">
              <span>观察窗口</span>
              <div className="time-window-switch" aria-label="选择样本时间范围">
                {timeWindowDefinitions.map((definition) => (
                  <button
                    key={definition.key}
                    type="button"
                    aria-pressed={selectedWindowKey === definition.key}
                    onClick={() => setSelectedWindowKey(definition.key)}
                  >
                    {definition.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="stats-row">
            <Stat value={report.records} label="个触板样本" note={`覆盖 ${report.tradeDays} 个交易日`} />
            <Stat value={percent(report.averagePremium)} label="次日平均开盘溢价" note={`正溢价占比 ${Number.isFinite(report.positiveRate) ? `${(report.positiveRate * 100).toFixed(0)}%` : "—"}`} />
            <Stat value={turnover(report.averageTurnover)} label="样本平均成交额" note="均通过百亿门槛复核" />
          </div>

          <div className="status-contrast" aria-label="涨停收盘与炸板样本对比">
            <div>
              <span className="status-dot blue" />
              <small>涨停收盘 · {report.closed.count} 只次</small>
              <strong>{percent(report.closed.averagePremium)}</strong>
              <p>次日正溢价占比 {percent(report.closed.positiveRate, 2).replace("+", "")}</p>
            </div>
            <div className="contrast-divider" aria-hidden="true" />
            <div>
              <span className="status-dot orange" />
              <small>炸板 · {report.broken.count} 只次</small>
              <strong>{percent(report.broken.averagePremium)}</strong>
              <p>次日正溢价占比 {percent(report.broken.positiveRate, 2).replace("+", "")}</p>
            </div>
          </div>
        </section>

        <section className="page chart-section" aria-labelledby="chart-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">逐笔样本</p>
              <h2 id="chart-heading">触板时间 × 次日开盘溢价</h2>
            </div>
            <p>颜色看封板结果，形状看触板顺序，气泡看成交额，外圈看触板当日指数涨跌。</p>
          </div>
          <div className="chart-shell">
            <MarketContextPanel selectedCode={selectedIndexCode} summary={indexSummary} onChange={setSelectedIndexCode} />
            <ScatterChart samples={windowSamples} selectedIndex={selectedIndex} />
          </div>
        </section>

        <section className="page findings" aria-labelledby="findings-title">
          <div className="findings-heading">
            <p className="section-kicker">关键观察</p>
            <h2 id="findings-title">从封板结果、市场环境与触板顺序观察</h2>
          </div>
          <div className="finding-list">
            <article>
              <span>01</span>
              <h3>封板结果差异明显</h3>
              <p>涨停收盘样本次日平均表现 {percent(report.closed.averagePremium)}，炸板样本为 {percent(report.broken.averagePremium)}。</p>
            </article>
            <article>
              <span>02</span>
              <h3>{selectedIndex.name}环境差异</h3>
              <p>指数上涨日样本次日平均溢价 {percent(indexSummary.up.averagePremium)}，指数下跌日为 {percent(indexSummary.down.averagePremium)}。</p>
            </article>
            <article>
              <span>03</span>
              <h3>首二触板表现对比</h3>
              <p>同日第 1 个触板样本次日平均溢价 {percent(report.ranks[0].averagePremium)}，第 2 个为 {percent(report.ranks[1].averagePremium)}。</p>
            </article>
            <article>
              <span>04</span>
              <h3>分布离散，需结合个股</h3>
              <p>当前窗口样本极值从 {percent(report.minimumPremium)} 到 {percent(report.maximumPremium)}，单一触板时间不能替代题材、情绪与封单质量判断。</p>
            </article>
          </div>
        </section>

        <section className="method-section" aria-labelledby="method-title">
          <div className="page method-grid">
            <div>
              <p className="section-kicker">统计口径</p>
              <h2 id="method-title">数据如何筛选与排序</h2>
            </div>
            <div className="method-copy">
              <p><strong>样本筛选：</strong>A 股；Tushare 涨停/炸板明细中的 U（涨停收盘）与 Z（炸板）；当日最终成交额不低于 100 亿元；接口范围内不含 ST 股票。</p>
              <p><strong>触板顺序：</strong>只在“同日满足百亿成交额且曾触板”的样本内，按首次触板时间升序进行密集排名；同秒并列。</p>
              <p><strong>次日溢价：</strong>次一交易日开盘价 ÷ 次日前收盘价 − 1。当前窗口为 {windowLabel}，完整历史从 {dataMetadata.dataStart} 开始，次日行情补至 {dataMetadata.updatedAt}。</p>
              <p><strong>指数环境：</strong>取触板当日沪深300、上证指数和中证1000的收盘涨跌幅；网页默认显示沪深300，可切换基准。指数上涨/下跌样本按股票只次统计，不按交易日等权。</p>
              <div className="source-links" aria-label="数据来源">
                <span>数据来源</span>
                <a href="https://tushare.pro/document/2?doc_id=298" target="_blank" rel="noreferrer">涨停/炸板明细</a>
                <a href="https://tushare.pro/document/2?doc_id=27" target="_blank" rel="noreferrer">日线行情</a>
                <a href="https://tushare.pro/document/2?doc_id=26" target="_blank" rel="noreferrer">交易日历</a>
                <a href="https://tushare.pro/document/2?doc_id=95" target="_blank" rel="noreferrer">指数日线</a>
              </div>

              <aside className="xuanji-entry" aria-labelledby="xuanji-entry-title">
                <div className="xuanji-entry-copy">
                  <img src={xuanjiWordmark} alt="玄玑" />
                  <h3 id="xuanji-entry-title">把市场样本观察带在身边</h3>
                  <p>微信扫码进入玄玑小程序，查看更多市场研究与跟踪内容。</p>
                  <span>微信小程序</span>
                </div>
                <img className="xuanji-qr" src={xuanjiMiniProgram} alt="玄玑微信小程序码" />
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className="page footer">
        <p>本页面仅用于历史样本研究与数据展示，不构成任何投资建议。</p>
        <div className="footer-brand">
          <img src={xuanjiMark} alt="" />
          <span>玄玑 · MARKET TRACE · {dataMetadata.updatedAt.slice(0, 4)}</span>
        </div>
      </footer>
    </div>
  );
}
