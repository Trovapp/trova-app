import { colors } from "@/lib/theme";

type DayAssignable = {
  dayNumber: number | null;
  orderInDay: number | null;
};

export function isItineraryGroup(places: DayAssignable[]): boolean {
  return places.some((place) => place.dayNumber !== null);
}

export function groupByDay<T extends DayAssignable>(places: T[]): Map<number, T[]> {
  const days = new Map<number, T[]>();
  for (const place of places) {
    if (place.dayNumber === null) continue;
    const existing = days.get(place.dayNumber) ?? [];
    existing.push(place);
    days.set(place.dayNumber, existing);
  }
  for (const dayPlaces of days.values()) {
    dayPlaces.sort((a, b) => (a.orderInDay ?? 0) - (b.orderInDay ?? 0));
  }
  return days;
}

// 1일차는 앱 강조색을 그대로 쓴다 — 웹에서 옮겨올 때의 구 accent 값(#FF6B4A)을
// 그대로 두면 같은 화면의 일자 탭(colors.accent)과 미묘하게 다른 주황이 함께 보인다.
const DAY_COLORS = [colors.accent, "#4A90D9", "#4AC98F", "#D9A94A", "#9B6BD9", "#D94A8C"];

export function getDayColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}
