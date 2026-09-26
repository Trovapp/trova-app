import type { Trip } from "@/lib/api/trips";

export type TripSection = { title: string; data: Trip[] };

// "내 여행" 목록 구역. 백엔드는 만든 순서(createdAt desc)로 주므로 날짜가 뒤섞여 보였다 —
// 다가오는 여행(가까운 순) → 지난 여행(최근 순) → 날짜 미정(받은 순서 유지)으로 나눈다.
// 오늘 끝나는 여행까지는 다가오는 여행으로 본다. 날짜는 "YYYY-MM-DD" 문자열이라 문자열 비교로 충분하다.
export function groupTripsByDate(trips: Trip[], today: string): TripSection[] {
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  const undated: Trip[] = [];
  for (const trip of trips) {
    if (!trip.startDate) {
      undated.push(trip);
    } else if ((trip.endDate ?? trip.startDate) >= today) {
      upcoming.push(trip);
    } else {
      past.push(trip);
    }
  }
  upcoming.sort((a, b) => (a.startDate as string).localeCompare(b.startDate as string));
  past.sort((a, b) => (b.startDate as string).localeCompare(a.startDate as string));
  return [
    { title: "다가오는 여행", data: upcoming },
    { title: "지난 여행", data: past },
    { title: "날짜 미정", data: undated },
  ].filter((section) => section.data.length > 0);
}
