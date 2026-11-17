import test from "node:test";
import assert from "node:assert/strict";

import { chartTableModel, chartTableTsv } from "../src/content/dashboard/chart-table.js";

test("wide rate charts expose period, measures, and additive numerators", () => {
  const rows = [{
    label: "11/13–11/16\u2060",
    "T0 (%)": 50.94,
    "T7 (%)": 66.8,
    t0_withdraw_numerator: 1188,
    t0_withdraw_denominator: 2332,
    t7_withdraw_numerator: 1558,
    t7_withdraw_denominator: 2332,
  }];
  const spec = { type: "line", x: "label", y: "T0 (%)", fields: ["T0 (%)", "T7 (%)"], yLabel: "提现申请率", legend: { labels: { "T0 (%)": "T0提现申请率", "T7 (%)": "T7提现申请率" } } };
  const model = chartTableModel(rows, spec);
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "T0提现申请率", "T7提现申请率", "T0提现申请客户数", "T0授信通过客户数", "T7提现申请客户数", "T7授信通过客户数"]);
  assert.equal(model.displayRows[0]["T0 (%)"], "50.94%");
  assert.equal(model.displayRows[0].label, "11/13–11/16");
});

test("long charts pivot the selected group into columns", () => {
  const model = chartTableModel([
    { label: "2026/11\u2060", segment: "Android", "segmentRate (%)": 52.345, numerator: 523, den: 999 },
    { label: "2026/11\u2060", segment: "iOS", "segmentRate (%)": 49.1, numerator: 491, den: 999 },
  ], { type: "line", x: "label", y: "segmentRate (%)", series: "segment", yLabel: "T0提现申请率" });
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "Android", "iOS"]);
  assert.equal(model.displayRows[0].__series_0, "52.34%");
  assert.equal(model.displayRows[0].__series_1, "49.10%");
  assert.equal(model.pivot, true);
});

test("small percentage values stay in 0–100 chart units", () => {
  const model = chartTableModel([
    { label: "2026/11\u2060", "fpd0Rate (%)": 0.5 },
  ], { type: "line", x: "label", y: "fpd0Rate (%)", yLabel: "FPD0订单逾期率" });
  assert.equal(model.displayRows[0]["fpd0Rate (%)"], "0.50%");
});

test("pivot tables put newest periods first and respect the requested column order", () => {
  const model = chartTableModel([
    { label: "10/30\u2060", segment: "Android", "segmentRate (%)": 51 },
    { label: "10/30\u2060", segment: "iOS", "segmentRate (%)": 49 },
    { label: "11/06\u2060", segment: "Android", "segmentRate (%)": 52 },
    { label: "11/06\u2060", segment: "iOS", "segmentRate (%)": 50 },
  ], { type: "line", x: "label", y: "segmentRate (%)", series: "segment", yLabel: "提现申请率", tooltipOrder: ["iOS", "Android"] });
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "iOS", "Android"]);
  assert.deepEqual(model.displayRows.map(row => row.label), ["11/06", "10/30"]);
  assert.deepEqual(model.displayRows.map(row => [row.__series_0, row.__series_1]), [
    ["50.00%", "52.00%"], ["49.00%", "51.00%"],
  ]);
});

test("pivot tables support numeric distributions without percent formatting", () => {
  const model = chartTableModel([
    { label: "11/06\u2060", risk: "A", count: 123 },
    { label: "11/06\u2060", risk: "B", count: 456 },
  ], { type: "bar", x: "label", y: "count", series: "risk", yLabel: "客户人数" });
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "A", "B"]);
  assert.deepEqual([model.displayRows[0].__series_0, model.displayRows[0].__series_1], [123, 456]);
  assert.equal(model.heatMax, 456);
});

test("100 percent composition tables keep every visible series and copy as TSV", () => {
  const model = chartTableModel([
    { label: "2026/11\u2060", Facebook: 33.4, Organic: 66.6, total: 9478, __compositionDetails: {} },
  ], { type: "stackedBar100", x: "label", y: "Facebook", fields: ["Facebook", "Organic"], yLabel: "授信通过人数占比" });
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "Facebook", "Organic", "合计"]);
  assert.match(chartTableTsv(model), /^统计周期\tFacebook\tOrganic\t合计\n2026\/11\t33\.40%\t66\.60%\t9478$/u);
});
