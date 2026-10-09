/** 本地日曆日期 YYYY-MM-DD；`toISOString()` 為 UTC，在 UTC+8 午夜後數小時會少一天。 */
export function localIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
