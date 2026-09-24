function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeString(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseTimeToDate(hhmm: string | null): Date {
  const base = new Date();
  if (!hhmm) return base;
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return base;
  base.setHours(hours, minutes, 0, 0);
  return base;
}

function parseDateString(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

// 여행 기간 표시: "9월 8일 · 당일", "9월 9일 ~ 9월 10일 · 1박 2일".
// 올해가 아닌 날짜에만 연도를 붙인다(목록에서 "2026-09-08 ~ 2026-09-08"처럼 같은 정보가 반복되지 않게).
export function formatTripDates(startDate: string, endDate: string | null, now: Date = new Date()): string {
  const start = parseDateString(startDate);
  const end = endDate ? parseDateString(endDate) : start;
  if (!start || !end) return endDate ? `${startDate} ~ ${endDate}` : startDate;

  const label = (d: { year: number; month: number; day: number }) =>
    `${d.year !== now.getFullYear() ? `${d.year}년 ` : ""}${d.month}월 ${d.day}일`;
  const nights = Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86_400_000
  );

  if (nights <= 0) return `${label(start)} · 당일`;
  return `${label(start)} ~ ${label(end)} · ${nights}박 ${nights + 1}일`;
}
