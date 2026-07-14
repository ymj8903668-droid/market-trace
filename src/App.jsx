import { useMemo, useState } from "react";

import { MarketContextPanel } from "./MarketContextPanel.jsx";
import { ScatterChart } from "./ScatterChart.jsx";
import { report, samples } from "./data.js";
import { indexDefinitions } from "./indexData.js";
import { summarizeIndexDays } from "./marketContext.js";

const percent = (value, digits = 2) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;

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
  const selectedIndex = indexDefinitions.find((definition) => definition.code === selectedIndexCode) || indexDefinitions[0];
  const indexSummary = useMemo(() => summarizeIndexDays(samples, selectedIndexCode), [selectedIndexCode]);

  return (
    <div className="site-shell">
      <header className="masthead">
        <div className="page nav-row" aria-label="网站信息">
          <a className="wordmark" href="#top" aria-label="返回顶部">
            <span>MARKET TRACE</span>
            <small>市场样本观察</small>
          </a>
          <span className="updated">数据更新 · {report.updatedAt.replaceAll("-", ".")}</span>
        </div>

        <div id="top" className="page hero">
          <p className="eyebrow">A股高成交触板样本</p>
          <h1><span>百亿成交触板之后，</span><span>次日开盘表现如何？</span></h1>
          <p className="hero-copy">
            追踪最近一个月内，当日最终成交额不低于 100 亿元、盘中曾触及涨停价的 A 股样本，观察首次触板时间、同日触板顺序与次日开盘溢价。
          </p>
          <div className="scope-line" aria-label="统计口径概览">
            <span>{report.window}</span>
            <span>最终成交额 ≥ 100 亿元</span>
            <span>含涨停收盘与炸板</span>
            <span>指数环境：沪深300 / 上证 / 中证1000</span>
          </div>
        </div>
      </header>

      <main>
        <section className="page overview" aria-labelledby="overview-title">
          <div className="section-kicker" id="overview-title">样本概览</div>
          <div className="stats-row">
            <Stat value={report.records} label="个触板样本" note={`覆盖 ${report.tradeDays} 个交易日`} />
            <Stat value={percent(report.averagePremium)} label="次日平均开盘溢价" note={`正溢价占比 ${(report.positiveRate * 100).toFixed(0)}%`} />
            <Stat value={`${report.averageTurnover.toFixed(1)} 亿`} label="样本平均成交额" note="均通过百亿门槛复核" />
          </div>

          <div className="status-contrast" aria-label="涨停收盘与炸板样本对比">
            <div>
              <span className="status-dot blue" />
              <small>涨停收盘 · {report.closed.count} 只次</small>
              <strong>{percent(report.closed.averagePremium)}</strong>
              <p>次日正溢价占比 {(report.closed.positiveRate * 100).toFixed(2)}%</p>
            </div>
            <div className="contrast-divider" aria-hidden="true" />
            <div>
              <span className="status-dot orange" />
              <small>炸板 · {report.broken.count} 只次</small>
              <strong>{percent(report.broken.averagePremium)}</strong>
              <p>次日正溢价占比 {(report.broken.positiveRate * 100).toFixed(2)}%</p>
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
            <ScatterChart selectedIndex={selectedIndex} />
          </div>
        </section>

        <section className="page findings" aria-labelledby="findings-title">
          <div className="findings-heading">
            <p className="section-kicker">关键观察</p>
            <h2 id="findings-title">封住涨停，比触板早晚更有区分度</h2>
          </div>
          <div className="finding-list">
            <article>
              <span>01</span>
              <h3>封板结果差异明显</h3>
              <p>涨停收盘样本次日平均高开 {percent(report.closed.averagePremium)}，炸板样本则平均低开 {Math.abs(report.broken.averagePremium * 100).toFixed(2)}%。</p>
            </article>
            <article>
              <span>02</span>
              <h3>{selectedIndex.name}环境差异</h3>
              <p>指数上涨日样本次日平均溢价 {percent(indexSummary.up.averagePremium)}，指数下跌日为 {percent(indexSummary.down.averagePremium)}。</p>
            </article>
            <article>
              <span>03</span>
              <h3>首个触板略占优势</h3>
              <p>同日第 1 个触板样本次日平均溢价 {percent(report.ranks[0].averagePremium)}，第 2 个为 {percent(report.ranks[1].averagePremium)}。</p>
            </article>
            <article>
              <span>04</span>
              <h3>分布离散，需结合个股</h3>
              <p>样本极值从 −7.73% 到 +9.99%，单一触板时间不能替代题材、情绪与封单质量判断。</p>
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
              <p><strong>次日溢价：</strong>次一交易日开盘价 ÷ 次日前收盘价 − 1。数据窗口为 {report.window}，次日行情补至 {report.updatedAt}。</p>
              <p><strong>指数环境：</strong>取触板当日沪深300、上证指数和中证1000的收盘涨跌幅；网页默认显示沪深300，可切换基准。指数上涨/下跌样本按股票只次统计，不按交易日等权。</p>
              <div className="source-links" aria-label="数据来源">
                <span>数据来源</span>
                <a href="https://tushare.pro/document/2?doc_id=298" target="_blank" rel="noreferrer">涨停/炸板明细</a>
                <a href="https://tushare.pro/document/2?doc_id=27" target="_blank" rel="noreferrer">日线行情</a>
                <a href="https://tushare.pro/document/2?doc_id=26" target="_blank" rel="noreferrer">交易日历</a>
                <a href="https://tushare.pro/document/2?doc_id=95" target="_blank" rel="noreferrer">指数日线</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="page footer">
        <p>本页面仅用于历史样本研究与数据展示，不构成任何投资建议。</p>
        <p>MARKET TRACE · {report.updatedAt.slice(0, 4)}</p>
      </footer>
    </div>
  );
}
