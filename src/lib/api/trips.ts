import { apiFetch } from "@/lib/api/client";

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
    throw new Error(`GET /api/trip-places/${id}/details failed: ${res.status}`);
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
    throw new Error(`POST /api/places/videos/${jobId}/confirm-trip failed: ${res.status}`);
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
    throw new Error(`POST /api/trips failed: ${res.status}`);
  }
  return res.json();
}

export async function listTrips(): Promise<Trip[]> {
  const res = await apiFetch(`/api/trips`);
  if (!res.ok) {
    throw new Error(`GET /api/trips failed: ${res.status}`);
  }
  return res.json();
}

export async function getTrip(id: number): Promise<TripDetail> {
  const res = await apiFetch(`/api/trips/${id}`);
  if (!res.ok) {
    throw new Error(`GET /api/trips/${id} failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteTrip(id: number): Promise<void> {
  const res = await apiFetch(`/api/trips/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`DELETE /api/trips/${id} failed: ${res.status}`);
  }
}

export async function addTripPlace(tripId: number, day: number, googlePlaceId: string): Promise<TripPlace> {
  const res = await apiFetch(`/api/trips/${tripId}/days/${day}/places`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googlePlaceId }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/trips/${tripId}/days/${day}/places failed: ${res.status}`);
  }
  return res.json();
}

export async function removeTripPlace(id: number): Promise<void> {
  const res = await apiFetch(`/api/trip-places/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`DELETE /api/trip-places/${id} failed: ${res.status}`);
  }
}

export async function reorderTripPlace(id: number, direction: "UP" | "DOWN"): Promise<TripPlace> {
  const res = await apiFetch(`/api/trip-places/${id}/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  if (!res.ok) {
    throw new Error(`PATCH /api/trip-places/${id}/order failed: ${res.status}`);
  }
  return res.json();
}

export async function checkWeather(tripId: number, day: number): Promise<{ notified: boolean; message: string }> {
  const res = await apiFetch(`/api/trips/${tripId}/days/${day}/weather-check`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`POST /api/trips/${tripId}/days/${day}/weather-check failed: ${res.status}`);
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
    throw new Error(`PATCH /api/trip-places/${id}/details failed: ${res.status}`);
  }
  return res.json();
}
