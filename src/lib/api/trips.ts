import { ApiError, apiFetch } from "@/lib/api/client";

export type Trip = { id: number; title: string; startDate: string | null; endDate: string | null };

export type TripPlace = {
  id: number;
  placeName: string;
  region: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  address: string | null;
  visitOrder: number;
  source: "VIDEO" | "NORMAL";
  googlePlaceId: string | null;
  visitStartTime: string | null;
  visitEndTime: string | null;
  arrivalTransportMode: "WALK" | "TRANSIT" | "CAR" | null;
  memo: string | null;
};

export type TripDay = { id: number; day: number; date: string | null; places: TripPlace[] };
export type TripDetail = Trip & { days: TripDay[] };

export type TripPlaceReviewSummary = {
  id: number;
  googlePlaceId: string | null;
  name: string;
  category: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  highlights: string;
  pros: string[];
  cons: string[];
  hours: string | null;
  fee: string | null;
  tips: string[];
  checklist: string[];
  reviewSnippets: string[];
};

export async function getTripPlaceDetails(id: number): Promise<TripPlaceReviewSummary> {
  const res = await apiFetch(`/api/trip-places/${id}/details`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trip-places/${id}/details failed: ${res.status}`);
  }
  return res.json();
}

// 백엔드 trips.title은 길이 지정 없는 @Column(ddl-auto) → varchar(255). 목록에선 한 줄로
// 잘려 보이므로 UI 기준으로 훨씬 짧게 제한해 저장 실패와 읽기 힘든 긴 이름을 함께 막는다.
export const TRIP_TITLE_MAX_LENGTH = 50;

// 이 영상으로 이미 만든 여행(같은 영상을 다시 추출한 기록 포함). 없으면 null.
export async function getVideoTrip(jobId: number): Promise<Trip | null> {
  const res = await apiFetch(`/api/places/videos/${jobId}/trip`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/places/videos/${jobId}/trip failed: ${res.status}`);
  }
  return res.json();
}

export async function confirmTrip(jobId: number, title: string, startDate: string | null): Promise<Trip> {
  const res = await apiFetch(`/api/places/videos/${jobId}/confirm-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, startDate }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/places/videos/${jobId}/confirm-trip failed: ${res.status}`);
  }
  return res.json();
}

export async function createTrip(title: string, startDate: string, endDate: string): Promise<Trip> {
  const res = await apiFetch(`/api/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, startDate, endDate }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trips failed: ${res.status}`);
  }
  return res.json();
}

export async function listTrips(): Promise<Trip[]> {
  const res = await apiFetch(`/api/trips`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trips failed: ${res.status}`);
  }
  return res.json();
}

export async function getTrip(id: number): Promise<TripDetail> {
  const res = await apiFetch(`/api/trips/${id}`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trips/${id} failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteTrip(id: number): Promise<void> {
  const res = await apiFetch(`/api/trips/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/trips/${id} failed: ${res.status}`);
  }
}

export async function addTripPlace(tripId: number, day: number, googlePlaceId: string): Promise<TripPlace> {
  const res = await apiFetch(`/api/trips/${tripId}/days/${day}/places`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googlePlaceId }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trips/${tripId}/days/${day}/places failed: ${res.status}`);
  }
  return res.json();
}

export async function removeTripPlace(id: number): Promise<void> {
  const res = await apiFetch(`/api/trip-places/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/trip-places/${id} failed: ${res.status}`);
  }
}

export async function reorderTripPlace(id: number, direction: "UP" | "DOWN"): Promise<TripPlace> {
  const res = await apiFetch(`/api/trip-places/${id}/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `PATCH /api/trip-places/${id}/order failed: ${res.status}`);
  }
  return res.json();
}

export async function optimizeTripRoute(tripId: number, day: number): Promise<TripPlace[]> {
  const res = await apiFetch(`/api/trips/${tripId}/days/${day}/optimize-route`, { method: "POST" });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trips/${tripId}/days/${day}/optimize-route failed: ${res.status}`);
  }
  return res.json();
}

export async function checkWeather(tripId: number, day: number): Promise<{ notified: boolean; message: string }> {
  const res = await apiFetch(`/api/trips/${tripId}/days/${day}/weather-check`, { method: "POST" });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trips/${tripId}/days/${day}/weather-check failed: ${res.status}`);
  }
  return res.json();
}

export async function updateTripPlaceDetails(
  id: number,
  patch: {
    visitStartTime?: string;
    visitEndTime?: string;
    arrivalTransportMode?: "WALK" | "TRANSIT" | "CAR";
    memo?: string;
  }
): Promise<TripPlace> {
  const res = await apiFetch(`/api/trip-places/${id}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `PATCH /api/trip-places/${id}/details failed: ${res.status}`);
  }
  return res.json();
}

export type AlternativeFilter = {
  category?: string;
  indoor?: boolean;
  maxDistanceKm?: number;
  maxTravelMinutes?: number;
  transportMode?: "WALK" | "TRANSIT" | "CAR";
};

export type AlternativeCandidate = {
  placeId: number;
  googlePlaceId: string;
  name: string;
  category: string | null;
  rating: number | null;
  userRatingCount: number | null;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceToNextKm: number | null;
  estimatedTravelMinutes: number | null;
  isCongestionAvailable: boolean;
  congestionLevel: string | null;
  recommendationReason: string | null;
};

export type Gap = {
  beforePlaceId: number;
  afterPlaceId: number;
  gapMinutes: number;
  recommendations: AlternativeCandidate[];
};

export async function getAlternatives(tripPlaceId: number, filter: AlternativeFilter): Promise<AlternativeCandidate[]> {
  const params = new URLSearchParams();
  if (filter.category) params.set("category", filter.category);
  if (filter.indoor !== undefined) params.set("indoor", String(filter.indoor));
  if (filter.maxDistanceKm !== undefined) params.set("maxDistanceKm", String(filter.maxDistanceKm));
  if (filter.maxTravelMinutes !== undefined) params.set("maxTravelMinutes", String(filter.maxTravelMinutes));
  if (filter.transportMode) params.set("transportMode", filter.transportMode);

  const res = await apiFetch(`/api/trip-places/${tripPlaceId}/alternatives?${params.toString()}`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trip-places/${tripPlaceId}/alternatives failed: ${res.status}`);
  }
  return res.json();
}

export async function replacePlace(tripPlaceId: number, googlePlaceId: string): Promise<TripPlace> {
  const res = await apiFetch(`/api/trip-places/${tripPlaceId}/replace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googlePlaceId }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trip-places/${tripPlaceId}/replace failed: ${res.status}`);
  }
  return res.json();
}

export async function getGapRecommendations(tripId: number, day: number): Promise<Gap[]> {
  const res = await apiFetch(`/api/trips/${tripId}/days/${day}/gap-recommendations`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trips/${tripId}/days/${day}/gap-recommendations failed: ${res.status}`);
  }
  return res.json();
}

export async function insertPlaceAfter(afterTripPlaceId: number, googlePlaceId: string): Promise<TripPlace> {
  const res = await apiFetch(`/api/trip-places/insert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ afterTripPlaceId, googlePlaceId }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trip-places/insert failed: ${res.status}`);
  }
  return res.json();
}

export type TripReplanResult = {
  replaced: { tripPlaceId: number; originalName: string; candidate: AlternativeCandidate }[];
  failedTripPlaceIds: number[];
};

export type TripReplanJob = {
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  completedTargets: number;
  totalTargets: number | null;
  result: TripReplanResult | null;
  errorMessage: string | null;
};

// 기본은 allPlaces=true — 여행에 있는 모든 장소를 대상으로 카테고리 매칭 +
// 개인화 기반 대안을 추천한다(indoorOnly는 날씨 등으로 "실내 위주로만" 좁히고
// 싶을 때 별도로 켤 수 있는 독립적인 필터).
export async function startTripReplan(tripId: number, indoorOnly = false): Promise<{ jobId: number }> {
  const res = await apiFetch(`/api/trips/${tripId}/replan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allPlaces: true, indoorOnly }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trips/${tripId}/replan failed: ${res.status}`);
  }
  return res.json();
}

export async function getTripReplanJob(tripId: number, jobId: number): Promise<TripReplanJob> {
  const res = await apiFetch(`/api/trips/${tripId}/replan/${jobId}`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trips/${tripId}/replan/${jobId} failed: ${res.status}`);
  }
  return res.json();
}
