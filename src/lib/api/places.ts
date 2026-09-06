import { apiFetch } from "@/lib/api/client";

export type Place = {
  id: number;
  jobId: number;
  placeName: string;
  region: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string;
  title: string | null;
  sourcePlatform: "INSTAGRAM" | "YOUTUBE";
  createdAt: string;
  address: string | null;
};

export type PendingJob = {
  jobId: number;
  sourceUrl: string;
  title: string | null;
  sourcePlatform: "INSTAGRAM" | "YOUTUBE";
  status: "PENDING" | "PROCESSING" | "FAILED";
  createdAt: string;
};

export async function createShare(url: string): Promise<{ jobId: number }> {
  const res = await apiFetch("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (res.status === 401) {
    throw new Error("로그인이 필요해요.");
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "지원하지 않는 URL입니다.");
  }
  if (!res.ok) {
    throw new Error(`POST /api/shares failed: ${res.status}`);
  }
  return res.json();
}

export async function getPendingJobs(): Promise<PendingJob[]> {
  const res = await apiFetch("/api/places/pending");
  if (!res.ok) {
    throw new Error(`GET /api/places/pending failed: ${res.status}`);
  }
  return res.json();
}

export async function getPlaces(): Promise<Place[]> {
  const res = await apiFetch("/api/places");
  if (!res.ok) {
    throw new Error(`GET /api/places failed: ${res.status}`);
  }
  return res.json();
}

export async function getPlace(id: number): Promise<Place | null> {
  const res = await apiFetch(`/api/places/${id}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`GET /api/places/${id} failed: ${res.status}`);
  }
  return res.json();
}
