// Presets are anchored to the latest reviewed day, never the viewer's clock.
export function formatDateRange(value) {
  const [start, end = start] = String(value ?? "").split("..");
  const valid = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date).toISOString().slice(0,10) === date;
  if (!valid(start) || !valid(end)) return String(value ?? "");
  const formatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  if (start === end) return formatter.format(new Date(start));
  return start <= end ? formatter.formatRange(new Date(start), new Date(end)) : String(value);
}

export function dateRangePresets(earliest, latest, { historical = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(latest ?? "") || !earliest) return [];
  const date = new Date(`${latest}T00:00:00Z`);
  if (!Number.isFinite(+date)) return [];
  const iso = date => date.toISOString().slice(0,10);
  const shift = days => iso(new Date(+date + days * 86400000));
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  return [
    ["近7天",shift(-6),latest], ["近28天",shift(-27),latest],
    [historical ? new Intl.DateTimeFormat("zh-CN", {month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1))) : "上个月",iso(new Date(Date.UTC(year,month-1,1))),iso(new Date(Date.UTC(year,month,0)))],
  ].filter(([,start,end]) => start >= earliest && end <= latest && start <= end)
    .map(([label,start,end]) => ({ label,start,end,value:`${start}..${end}` }));
}
