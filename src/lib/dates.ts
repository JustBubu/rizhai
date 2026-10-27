const OFFSET = /^([+-])(\d{2}):(\d{2})$/;

export function offsetMinutes(timezone: string): number {
  const match = OFFSET.exec(timezone.trim());
  if (!match) return 8 * 60;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function isTimezone(value: string): boolean {
  return OFFSET.test(value.trim());
}

/** 日历日，按给定时区计算，格式 YYYY-MM-DD。 */
export function calendarDate(timezone: string, now = Date.now()): string {
  const shifted = new Date(now + offsetMinutes(timezone) * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function formatLongDate(date: string, locale: "zh" | "en" = "zh"): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (locale === "en") {
    return utc.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  const weeks = ["日", "一", "二", "三", "四", "五", "六"];
  return `${year}年${month}月${day}日 周${weeks[utc.getUTCDay()]}`;
}

export function dateInTimezone(iso: string, timezone: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const shifted = new Date(ms + offsetMinutes(timezone) * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function formatClock(iso: string, timezone: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const shifted = new Date(ms + offsetMinutes(timezone) * 60_000);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * SVN 的日期范围会落到「该时刻之前最近的一次修订」，
 * 所以开头可能带上前一天的最后一次提交。调用方必须再按日历日过滤。
 */
export function svnRevisionRange(date: string, timezone: string): string {
  const start = `${date}T00:00:00${timezone}`;
  const end = `${date}T23:59:59${timezone}`;
  return `{${start}}:{${end}}`;
}
