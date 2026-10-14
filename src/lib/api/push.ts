import { ApiError, apiFetch } from "@/lib/api/client";

// 웹 푸시 구독(백엔드 #185, ADR 0016).

/** 서버에 키가 없으면(로컬·꺼짐) null. */
export async function getPushPublicKey(): Promise<string | null> {
  const res = await apiFetch("/api/push/public-key");
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, `GET /api/push/public-key failed: ${res.status}`);
  return ((await res.json()) as { publicKey: string }).publicKey;
}

export async function savePushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  const res = await apiFetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new ApiError(res.status, `POST /api/push/subscriptions failed: ${res.status}`);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const res = await apiFetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new ApiError(res.status, `DELETE /api/push/subscriptions failed: ${res.status}`);
}
