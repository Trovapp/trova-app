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

// 웹(trova-frontend/src/lib/itinerary.ts)의 DAY_COLORS를 그대로 이식한 값.
// #FF6B4A는 "옛 accent 값"이 아니라 웹이 지금도 지도 핀 기본색으로 쓰는
// 현역 색이다(KakaoMap.tsx, PlaceMapSection.tsx) — colors.accent(버튼 강조색)로
// 바꾸지 말 것, 웹과 다른 주황이 된다.
const DAY_COLORS = ["#FF6B4A", "#4A90D9", "#4AC98F", "#D9A94A", "#9B6BD9", "#D94A8C"];

export function getDayColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}
