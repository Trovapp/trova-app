import { apiFetch } from "@/lib/api/client";
import type { AlternativeCandidate } from "@/lib/api/trips";

export type ConversationMessageRequest = {
  message: string;
  tripId: number;
  tripPlaceId?: number;
  day?: number;
  gapBeforePlaceId?: number;
};

export type ConversationMessageResponse = {
  reply: string;
  candidates: AlternativeCandidate[] | null;
  turnCount: number;
  turnLimitReached: boolean;
};

export async function sendConversationMessage(
  sessionId: string,
  request: ConversationMessageRequest
): Promise<ConversationMessageResponse> {
  const res = await apiFetch(`/api/conversations/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`POST /api/conversations/${sessionId}/messages failed: ${res.status}`);
  }
  return res.json();
}

// 시트를 닫을 때 best-effort로 호출한다 — 실패해도 무시(서버가 30분 TTL로도 정리함).
export async function endConversationSession(sessionId: string): Promise<void> {
  try {
    await apiFetch(`/api/conversations/${sessionId}`, { method: "DELETE" });
  } catch {
    // 무시 — 세션 종료 실패가 사용자 흐름을 막으면 안 된다.
  }
}
