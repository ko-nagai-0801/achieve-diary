/* lib/jst.ts */
const JST = "Asia/Tokyo";

export function formatJstYmd(date: Date = new Date()): string {
  // "YYYY-MM-DD"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatJstLong(date: Date = new Date()): string {
  // 例: "2026年2月5日(木)"
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
