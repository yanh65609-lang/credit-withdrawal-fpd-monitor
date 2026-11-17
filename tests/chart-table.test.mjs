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

test("long charts retain the selected group and denominator", () => {
  const model = chartTableModel([
    { label: "2026/11\u2060", segment: "Android", "segmentRate (%)": 52.345, numerator: 523, den: 999 },
  ], { type: "line", x: "label", y: "segmentRate (%)", series: "segment", yLabel: "T0提现申请率" });
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "分组", "T0提现申请率", "分子", "分母"]);
  assert.equal(model.displayRows[0]["segmentRate (%)"], "52.34%");
});

test("small percentage values stay in 0–100 chart units", () => {
  const model = chartTableModel([
    { label: "2026/11\u2060", "fpd0Rate (%)": 0.5 },
  ], { type: "line", x: "label", y: "fpd0Rate (%)", yLabel: "FPD0订单逾期率" });
  assert.equal(model.displayRows[0]["fpd0Rate (%)"], "0.50%");
});

test("100 percent composition tables keep every visible series and copy as TSV", () => {
  const model = chartTableModel([
    { label: "2026/11\u2060", Facebook: 33.4, Organic: 66.6, total: 9478, __compositionDetails: {} },
  ], { type: "stackedBar100", x: "label", y: "Facebook", fields: ["Facebook", "Organic"], yLabel: "授信通过人数占比" });
  assert.deepEqual(model.columns.map(column => column.label), ["统计周期", "Facebook", "Organic", "合计"]);
  assert.match(chartTableTsv(model), /^统计周期\tFacebook\tOrganic\t合计\n2026\/11\t33\.40%\t66\.60%\t9478$/u);
});
