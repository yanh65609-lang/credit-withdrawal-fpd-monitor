export function weekStart(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 2) % 7));
  return value.toISOString().slice(0, 10);
}

export function monthStart(date) {
  return String(date ?? "").slice(0, 7);
}

export function periodKey(date, grain) {
  if (grain === "week") return weekStart(date);
  if (grain === "month") return monthStart(date);
  return date;
}

export function displayPeriod(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
  if (/^\d{4}-\d{2}$/.test(value ?? "")) return `${value.slice(0, 4)}/${value.slice(5, 7)}`;
  return value;
}

export function isCompleteCalendarMonth(period, rows, dateField = "credit_pass_date") {
  if (!/^\d{4}-\d{2}$/.test(period ?? "")) return false;
  const lastDay = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  return rows.some(row => row[dateField] === lastDay);
}

export function alignPreviousMonthToLatest(previousRows, latestRows, dateField = "credit_pass_date") {
  const latestDays = latestRows
    .map(row => Number(String(row[dateField] ?? "").slice(8, 10)))
    .filter(Number.isFinite);
  if (!latestDays.length) return { previousRows: [], latestRows, startDay: null, endDay: null };
  const startDay = Math.min(...latestDays);
  const endDay = Math.max(...latestDays);
  return {
    previousRows: previousRows.filter(row => {
      const day = Number(String(row[dateField] ?? "").slice(8, 10));
      return Number.isFinite(day) && day >= startDay && day <= endDay;
    }),
    latestRows,
    startDay,
    endDay,
  };
}
