import { ApiError, apiFetch } from "@/lib/api/client";

// iOS 단축어용 공유 전용 키(백엔드 #165, ADR 0013). 이 키로는 공유 저장(POST /api/shares)만 된다.
export type ShareKeyStatus = { exists: boolean; createdAt: string | null; lastUsedAt: string | null };

export async function getShareKeyStatus(): Promise<ShareKeyStatus> {
  const res = await apiFetch("/api/share-key");
  if (!res.ok) throw new ApiError(res.status, `GET /api/share-key failed: ${res.status}`);
  return res.json();
}

/** 새로 받거나 바꾼다. 원문 키는 이 응답에서만 볼 수 있다(서버에는 해시만 남는다). */
export async function issueShareKey(): Promise<string> {
  const res = await apiFetch("/api/share-key", { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, `POST /api/share-key failed: ${res.status}`);
  const body = (await res.json()) as { key: string };
  return body.key;
}

export async function revokeShareKey(): Promise<void> {
  const res = await apiFetch("/api/share-key", { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, `DELETE /api/share-key failed: ${res.status}`);
}
