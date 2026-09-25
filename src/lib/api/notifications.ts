import { ApiError, apiFetch } from "@/lib/api/client";

export type Notification = {
  id: number;
  tripId: number;
  day: number;
  title: string;
  body: string;
  precipitationProb: number;
  tripPlaceId: number;
  createdAt: string;
};

export async function listNotifications(): Promise<Notification[]> {
  const res = await apiFetch("/api/notifications");
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/notifications failed: ${res.status}`);
  }
  return res.json();
}

export async function dismissNotification(id: number): Promise<void> {
  const res = await apiFetch(`/api/notifications/${id}/dismiss`, { method: "POST" });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/notifications/${id}/dismiss failed: ${res.status}`);
  }
}
