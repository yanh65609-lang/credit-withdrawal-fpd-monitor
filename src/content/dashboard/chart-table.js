const FIELD_LABELS = {
  label: "统计周期",
  period: "统计周期",
  segment: "分组",
  risk: "风险等级",
  bucket: "分桶",
  version: "App版本",
  numerator: "分子",
  denominator: "分母",
  den: "分母",
  count: "数量",
  total: "合计",
  t0_withdraw_numerator: "T0提现申请客户数",
  t0_withdraw_denominator: "T0授信通过客户数",
  t7_withdraw_numerator: "T7提现申请客户数",
  t7_withdraw_denominator: "T7授信通过客户数",
  fpd0_numerator: "FPD0逾期订单数",
  fpd0_denominator: "FPD0到期订单数",
  fpd10_numerator: "FPD10逾期订单数",
  fpd10_denominator: "FPD10到期订单数",
  fpd0_amt_numerator: "FPD0逾期金额",
  fpd0_amt_denominator: "FPD0到期金额",
  fpd10_amt_numerator: "FPD10逾期金额",
  fpd10_amt_denominator: "FPD10到期金额",
  credit_pass_customer_cnt: "授信通过客户数",
  credit_pass_limit_amt_sum: "授信额度合计",
  un: "T0申请金额",
  ud: "T0授信额度",
  t0LoanAmt: "T0放款金额",
  t0LoanCustomers: "T0放款客户数",
};

const unique = values => [...new Set(values.filter(Boolean))];
const cleanText = value => String(value ?? "").replace(/\u2060/g, "");

function relatedSupplementFields(measures, rows, series) {
  const available = new Set(rows.flatMap(row => Object.keys(row)));
  const text = measures.join(" ").toLowerCase();
  const candidates = [];
  if (series) candidates.push("numerator", "den", "denominator");
  if (text.includes("fpd0amountrate")) candidates.push("fpd0_amt_numerator", "fpd0_amt_denominator");
  else if (text.includes("fpd0")) candidates.push("fpd0_numerator", "fpd0_denominator");
  if (text.includes("fpd10amountrate")) candidates.push("fpd10_amt_numerator", "fpd10_amt_denominator");
  else if (text.includes("fpd10")) candidates.push("fpd10_numerator", "fpd10_denominator");
  if (text.includes("t0") && !text.includes("fpd0")) candidates.push("t0_withdraw_numerator", "t0_withdraw_denominator");
  if (text.includes("t7")) candidates.push("t7_withdraw_numerator", "t7_withdraw_denominator");
  if (text.includes("avgcreditlimit")) candidates.push("credit_pass_limit_amt_sum", "credit_pass_customer_cnt");
  if (text.includes("avgt0creditlimit")) candidates.push("ud", "t0_withdraw_numerator");
  if (text.includes("avgt0loanamount")) candidates.push("t0LoanAmt", "t0LoanCustomers");
  if (/(^|\s)util(?:izationrate)?(?:\s|$)/i.test(text)) candidates.push("un", "ud");
  if (!series && rows.some(row => row.__compositionDetails)) candidates.push("total");
  return unique(candidates).filter(field => available.has(field) && !measures.includes(field));
}

function fieldLabel(field, spec, measures) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const legendLabel = spec?.legend?.labels?.[field];
  if (legendLabel) return legendLabel;
  if (measures.length === 1 && field === measures[0] && spec?.yLabel) return spec.yLabel;
  return cleanText(field).replace(/\s*\(%\)$/u, "");
}

function isPercentField(field, spec, measures) {
  return /\(%\)$/u.test(field)
    || spec?.type === "stackedBar100" && measures.includes(field)
    || (measures.includes(field) && /率|占比/u.test(spec?.yLabel ?? ""));
}

function percentValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  // EvidenceChart passes table-ready percentage fields in 0–100 units. Do not
  // infer from magnitude: a legitimate 0.5% must stay 0.5%, not become 50%.
  return number;
}

function formatMetricValue(value, percent = false) {
  if (value == null || value === "") return "--";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return cleanText(value);
  if (!percent) return numeric;
  const percentage = percentValue(numeric);
  return percentage == null ? "--" : `${percentage.toFixed(2)}%`;
}

function orderedSeriesValues(rows, series, tooltipOrder = []) {
  const values = unique(rows.map(row => cleanText(row[series])));
  const firstSeen = new Map(values.map((value, index) => [value, index]));
  const preferred = new Map(tooltipOrder.map((value, index) => [cleanText(value), index]));
  return values.sort((left, right) =>
    (preferred.get(left) ?? Number.MAX_SAFE_INTEGER) - (preferred.get(right) ?? Number.MAX_SAFE_INTEGER)
    || (firstSeen.get(left) ?? 0) - (firstSeen.get(right) ?? 0));
}

function pivotChartTableModel(rows, spec, x, series, measure) {
  const seriesValues = orderedSeriesValues(rows, series, spec.tooltipOrder ?? []);
  const periodValues = unique(rows.map(row => cleanText(row[x]))).reverse();
  const percent = isPercentField(measure, spec, [measure]);
  const categoryFields = new Map(seriesValues.map((value, index) => [value, `__series_${index}`]));
  const valuesByPeriod = new Map(periodValues.map(period => [period, new Map()]));
  const heatValues = [];

  for (const row of rows) {
    const period = cleanText(row[x]);
    const category = cleanText(row[series]);
    if (!valuesByPeriod.has(period) || !categoryFields.has(category)) continue;
    const numeric = Number(row[measure]);
    const raw = Number.isFinite(numeric) ? numeric : null;
    valuesByPeriod.get(period).set(category, row[measure]);
    if (raw != null) heatValues.push(raw);
  }

  const columns = [
    { field: x, label: fieldLabel(x, spec, [measure]), percent: false },
    ...seriesValues.map(value => ({
      field: categoryFields.get(value),
      label: spec?.legend?.labels?.[value] ?? value,
      percent,
      highlight: true,
    })),
  ];
  const displayRows = periodValues.map(period => {
    const periodValuesMap = valuesByPeriod.get(period);
    const rawValues = {};
    const entries = seriesValues.map(category => {
      const field = categoryFields.get(category);
      const raw = periodValuesMap.get(category);
      const numeric = Number(raw);
      rawValues[field] = Number.isFinite(numeric) ? numeric : null;
      return [field, formatMetricValue(raw, percent)];
    });
    return Object.fromEntries([
      ["__rowKey", period],
      ["__rawValues", rawValues],
      [x, period || "--"],
      ...entries,
    ]);
  });

  return {
    columns,
    displayRows,
    pivot: true,
    valueMin: heatValues.length ? Math.min(...heatValues) : null,
    valueMax: heatValues.length ? Math.max(...heatValues) : null,
  };
}

export function chartTableModel(rows = [], spec = {}) {
  const x = spec.x ?? "label";
  const series = spec.series;
  const measures = unique(spec.fields?.length ? spec.fields : [spec.y]);
  if (series && measures.length) return pivotChartTableModel(rows, spec, x, series, measures[0]);
  const supplements = relatedSupplementFields(measures, rows, series);
  const fields = unique([x, series, ...measures, ...supplements]);
  const periodOrder = unique(rows.map(row => cleanText(row[x])));
  const periodRank = new Map(periodOrder.map((period, index) => [period, index]));
  const orderedRows = [...rows].sort((left, right) =>
    (periodRank.get(cleanText(right[x])) ?? 0) - (periodRank.get(cleanText(left[x])) ?? 0));
  const columns = fields.map(field => ({
    field,
    label: fieldLabel(field, spec, measures),
    percent: isPercentField(field, spec, measures),
  }));
  const displayRows = orderedRows.map((row, index) => Object.fromEntries([
    ["__rowKey", `${index}-${cleanText(row[x])}-${cleanText(series ? row[series] : "")}`],
    ...columns.map(column => {
      const value = row[column.field];
      if (column.field === x || column.field === series) return [column.field, cleanText(value) || "--"];
      return [column.field, formatMetricValue(value, column.percent)];
    }),
  ]));
  return { columns, displayRows };
}

function tsvValue(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return cleanText(value).replace(/[\t\r\n]+/gu, " ");
}

export function chartTableTsv(model) {
  const { columns = [], displayRows = [] } = model ?? {};
  return [
    columns.map(column => tsvValue(column.label)).join("\t"),
    ...displayRows.map(row => columns.map(column => tsvValue(row[column.field])).join("\t")),
  ].join("\n");
}
