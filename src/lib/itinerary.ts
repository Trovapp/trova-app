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

const DAY_COLORS = ["#FF6B4A", "#4A90D9", "#4AC98F", "#D9A94A", "#9B6BD9", "#D94A8C"];

export function getDayColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}
