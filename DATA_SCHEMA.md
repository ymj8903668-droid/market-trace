# 数据结构说明

数据产物：

- `../output/a-share-limit-touch/a-share-limit-touch-over-10b.json`
- `../output/a-share-limit-touch/a-share-limit-touch-over-10b.csv`

当前兼容版本保持 `a-share-limit-touch-over-10b-v1`，修订号为 `1.1.0`。本次只增加字段，不修改或删除既有字段。

## 新增指数维度

每条 JSON 记录新增 `market_indices`：

```json
{
  "market_indices": {
    "000300.SH": { "name": "沪深300", "close": 4876.3125, "pct_chg": 0.025398 },
    "000001.SH": { "name": "上证指数", "close": 4036.5879, "pct_chg": 0.016548 },
    "000852.SH": { "name": "中证1000", "close": 8300.077, "pct_chg": 0.022446 }
  }
}
```

`pct_chg` 使用小数存储：`0.025398` 表示 `+2.5398%`。

CSV 和 JSON 同时提供三个扁平字段，方便表格分析：

- `index_hs300_pct_chg`
- `index_sse_pct_chg`
- `index_csi1000_pct_chg`

指数数据来自 Tushare `index_daily`，并按 `trigger_date` 与触板样本联结。生成脚本会拒绝字段缺失、非数字或日期不完整的指数记录，也会在任一触板日缺少任一基准时中止输出。
