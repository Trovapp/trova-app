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
