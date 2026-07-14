import { indexDefinitions } from "./indexData.js";

const percent = (value) => Number.isFinite(value)
  ? `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`
  : "—";

export function MarketContextPanel({ selectedCode, summary, onChange }) {
  const selected = indexDefinitions.find((definition) => definition.code === selectedCode) || indexDefinitions[0];

  return (
    <div className="market-context" aria-labelledby="market-context-title">
      <div className="market-context-head">
        <div>
          <p className="market-context-label" id="market-context-title">触板当日指数环境</p>
          <p>选择基准后，数据点描边和悬停详情会同步更新。</p>
        </div>
        <div className="index-switch" aria-label="选择指数基准">
          {indexDefinitions.map((definition) => (
            <button
              key={definition.code}
              type="button"
              aria-pressed={selectedCode === definition.code}
              onClick={() => onChange(definition.code)}
            >
              {definition.name}
            </button>
          ))}
        </div>
      </div>

      <div className="market-comparison" aria-live="polite">
        <div>
          <span className="market-direction up">上涨日</span>
          <strong>{percent(summary.up.averagePremium)}</strong>
          <small>{selected.name}上涨 · {summary.up.count} 个样本</small>
        </div>
        <div>
          <span className="market-direction down">下跌日</span>
          <strong>{percent(summary.down.averagePremium)}</strong>
          <small>{selected.name}下跌 · {summary.down.count} 个样本</small>
        </div>
        <p>数值为对应市场环境下，触板样本的次日平均开盘溢价。</p>
      </div>
    </div>
  );
}
