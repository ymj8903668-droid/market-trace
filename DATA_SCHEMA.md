# 数据结构说明

## 产物

- `data/a-share-limit-touch-ytd.json`：带完整审计字段的当年历史数据。
- `src/generated/marketData.js`：网页使用的紧凑样本与更新时间元数据。
- `src/generated/indexData.js`：触板日期对应的沪深300、上证指数和中证1000涨跌幅。

以上文件均由 `scripts/update-market-data.mjs` 生成，不应手工修改。生成结果是确定性的：同一数据截止日重复运行不会产生无意义变更。

## 网页样本字段

```js
{
  d: "2026-07-13",   // 触板日期
  c: "000001.SZ",    // Tushare 股票代码
  n: "示例股票",      // 股票简称
  s: "涨停收盘",      // 涨停收盘 / 炸板
  t: "10:02:03",     // 首次触板时间
  x: 36123,           // 首次触板时间换算为当日秒数
  r: 2,               // 同日百亿成交触板样本中的密集排名
  a: 123.5,           // 当日最终成交额，亿元
  p: 0.012346         // 次日开盘溢价，小数
}
```

## 时间边界

- `dataMetadata.dataStart`：当年数据起点，当前为 2026-01-01。
- `dataMetadata.triggerEnd`：最后一个已具备次日开盘数据的触板交易日。
- `dataMetadata.updatedAt`：次日行情补齐到的交易日。
- 近 1 个月按 `triggerEnd` 向前取 30 个自然日（含首尾）。
- 近 2 个月按 `triggerEnd` 向前取 60 个自然日（含首尾）。
- 今年以来从当年 1 月 1 日起算。

## 数据质量门槛

生成器会在发布前检查：

1. `limit_list_d` 与 `daily` 的当日最终成交额均不低于 100 亿元，且二者差异不超过 1,000 元。
2. 每条样本都有首次触板时间、触板顺序、次一交易日开盘价和次日前收盘价。
3. 每个触板日都有沪深300、上证指数和中证1000的日涨跌幅。
4. 任一记录不完整时整次更新失败，不覆盖上一次有效数据。

官方接口文档：

- [涨跌停列表（limit_list_d）](https://tushare.pro/document/2?doc_id=298)
- [A股日线行情（daily）](https://tushare.pro/document/2?doc_id=27)
- [交易日历（trade_cal）](https://tushare.pro/document/2?doc_id=26)
- [指数日线行情（index_daily）](https://tushare.pro/document/2?doc_id=95)
