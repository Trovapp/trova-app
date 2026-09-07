import { apiFetch } from "@/lib/api/client";

export type RecommendedPlace = {
  id: number;
  googlePlaceId: string;
  name: string;
  category: string | null;
  mood: string | null;
  space: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
};

export async function searchPlaces(query: string): Promise<RecommendedPlace[]> {
  const res = await apiFetch(`/api/places/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`GET /api/places/search failed: ${res.status}`);
  }
  return res.json();
}

export type PlaceReviewSummary = Omit<RecommendedPlace, "mood" | "space"> & {
  highlights: string;
  pros: string[];
  cons: string[];
  hours: string | null;
  fee: string | null;
  tips: string[];
  checklist: string[];
  reviewSnippets: string[];
};

export async function getPlaceDetails(id: number): Promise<PlaceReviewSummary> {
  const res = await apiFetch(`/api/places/${id}/details`);
  if (!res.ok) {
    throw new Error(`GET /api/places/${id}/details failed: ${res.status}`);
  }
  return res.json();
}
