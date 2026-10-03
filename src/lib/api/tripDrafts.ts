import { ApiError, apiFetch } from "@/lib/api/client";

// 일정 에이전트(백엔드 #106): 고른 영상 + 요청 문장 → 서버가 비동기로 초안을 만들고, 사용자가 승인해야 여행이 된다.
export type TripDraftStatus = "PENDING" | "PROCESSING" | "NEEDS_INPUT" | "READY" | "APPROVED" | "FAILED";

export type DraftItem = {
  placeId: number;
  name: string;
  category: string | null;
  start: string; // "10:00"
  end: string;
  latitude: number | null;
  longitude: number | null;
};

export type DraftPlan = {
  days: { day: number; date: string | null; items: DraftItem[] }[];
  excluded: { placeId: number; name: string; reason: string }[];
  lodging: string[];
  assumptions: string[];
  // 코드·AI가 고친 과정과, 끝내 남은 규칙 위반(예: "1일차 점심 시간대 식당 없음"). 이전 서버는 없을 수 있다.
  fixes?: string[];
  problems?: string[];
};

export type TripDraft = {
  id: number;
  status: TripDraftStatus;
  message: string;
  jobIds: number[];
  days: number | null;
  startDate: string | null;
  question: string | null;
  draftJson: string | null;
  errorMessage: string | null;
  answer: "SPLIT" | "ONLY" | null;
  tripId: number | null;
};

// 서버(TripPlannerService.MAX_VIDEOS)와 같은 상한.
export const PLAN_MAX_VIDEOS = 5;
export const PLAN_MESSAGE_MAX_LENGTH = 100;

export function parsePlan(draft: TripDraft): DraftPlan | null {
  if (!draft.draftJson) return null;
  try {
    return JSON.parse(draft.draftJson) as DraftPlan;
  } catch {
    return null;
  }
}

export async function createTripDraft(jobIds: number[], message: string): Promise<{ draftId: number }> {
  const res = await apiFetch(`/api/trip-drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobIds, message }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trip-drafts failed: ${res.status}`);
  }
  return res.json();
}

export async function getTripDraft(id: number): Promise<TripDraft> {
  const res = await apiFetch(`/api/trip-drafts/${id}`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/trip-drafts/${id} failed: ${res.status}`);
  }
  return res.json();
}

// SPLIT: 모든 영상으로 지역별로 날을 나눈다. ONLY: jobIds의 영상만 쓴다.
export async function answerTripDraft(id: number, choice: "SPLIT" | "ONLY", jobIds?: number[]): Promise<void> {
  const res = await apiFetch(`/api/trip-drafts/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice, jobIds }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trip-drafts/${id}/answer failed: ${res.status}`);
  }
}

// 제목을 비우면 서버가 "김해·강릉 1박 2일"처럼 짓는다. 다시 눌러도 같은 여행 id가 온다.
export async function approveTripDraft(id: number, title: string | null): Promise<{ tripId: number }> {
  const res = await apiFetch(`/api/trip-drafts/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/trip-drafts/${id}/approve failed: ${res.status}`);
  }
  return res.json();
}
