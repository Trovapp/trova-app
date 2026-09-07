import { apiFetch } from "@/lib/api/client";

export type Bookmark = {
  id: number;
  placeId: number;
  placeName: string;
  googlePlaceId: string;
  mood: string | null;
  space: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

export async function listBookmarks(): Promise<Bookmark[]> {
  const res = await apiFetch(`/api/bookmarks`);
  if (!res.ok) {
    throw new Error(`GET /api/bookmarks failed: ${res.status}`);
  }
  return res.json();
}

export async function addBookmark(placeId: number): Promise<Bookmark> {
  const res = await apiFetch(`/api/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/bookmarks failed: ${res.status}`);
  }
  return res.json();
}

export async function removeBookmark(id: number): Promise<void> {
  const res = await apiFetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`DELETE /api/bookmarks/${id} failed: ${res.status}`);
  }
}
