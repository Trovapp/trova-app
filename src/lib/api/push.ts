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

// 로그아웃 때 부른다 — 서버가 느리거나 응답이 없어도 로그아웃이 오래 걸리지 않게 짧게 기다린다(#25).
const UNSUBSCRIBE_TIMEOUT_MS = 5_000;

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const res = await apiFetch("/api/push/subscriptions", {
    timeoutMs: UNSUBSCRIBE_TIMEOUT_MS,
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new ApiError(res.status, `DELETE /api/push/subscriptions failed: ${res.status}`);
}

// 안드로이드 앱(Expo) 알림 토큰(백엔드 #190, ADR 0017).
export async function saveExpoPushToken(token: string): Promise<void> {
  const res = await apiFetch("/api/push/expo-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new ApiError(res.status, `POST /api/push/expo-tokens failed: ${res.status}`);
}

export async function deleteExpoPushToken(token: string): Promise<void> {
  const res = await apiFetch("/api/push/expo-tokens", {
    timeoutMs: UNSUBSCRIBE_TIMEOUT_MS,
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new ApiError(res.status, `DELETE /api/push/expo-tokens failed: ${res.status}`);
}
