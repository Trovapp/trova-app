import { ApiError, apiFetch } from "@/lib/api/client";

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
  dayNumber: number | null;
  orderInDay: number | null;
  phone: string | null;
  roadAddress: string | null;
  kakaoCategoryName: string | null;
  kakaoPlaceUrl: string | null;
};

export type PendingJob = {
  jobId: number;
  sourceUrl: string;
  title: string | null;
  sourcePlatform: "INSTAGRAM" | "YOUTUBE";
  status: "PENDING" | "PROCESSING" | "FAILED";
  createdAt: string;
  currentStage: "EXTRACTING" | "GEOCODING" | "SELECTING" | "VERIFYING" | "SAVING" | null;
  progressPercent: number | null;
  stageMessage: string | null;
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
    // HomeScreen이 이 메시지를 그대로 화면에 띄우므로 사용자용 문구로 던진다.
    throw new Error("링크를 처리하지 못했어요. 잠시 후 다시 시도해주세요.");
  }
  return res.json();
}

export async function getPendingJobs(): Promise<PendingJob[]> {
  const res = await apiFetch("/api/places/pending");
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/places/pending failed: ${res.status}`);
  }
  return res.json();
}

export async function deletePendingJob(jobId: number): Promise<void> {
  const res = await apiFetch(`/api/places/pending/${jobId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/places/pending/${jobId} failed: ${res.status}`);
  }
}

// 추출 단계에서 실패한 작업을 같은 링크로 다시 제출한다(백엔드에 재시도 API가 없어 새 작업을 만든다).
// 새 작업이 만들어진 뒤에만 이전 실패 기록을 지우고, 그 정리가 실패해도 재시도 자체는 성공으로 본다.
// 일정 생성 단계에서 실패한 작업(이미 장소가 저장된 작업)에는 쓰면 안 된다 — 영상을 처음부터 다시 추출하게 된다.
export async function resubmitFailedJob(job: PendingJob): Promise<{ jobId: number }> {
  const created = await createShare(job.sourceUrl);
  await deletePendingJob(job.jobId).catch(() => {});
  return created;
}

export async function deletePlace(id: number): Promise<void> {
  const res = await apiFetch(`/api/places/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/places/${id} failed: ${res.status}`);
  }
}

// 완료된 영상 기록 삭제 — 백엔드엔 장소 단건 삭제만 있어서 이 영상에서 뽑은 장소를 모두 지운다.
// 이 영상으로 만든 여행의 장소(TripPlace)는 saved_place_id를 FK가 아닌 추적용 값으로만 들고 있어 영향이 없다.
// 반환값은 삭제에 실패한 개수.
export async function deleteVideoPlaces(placeIds: number[]): Promise<number> {
  const results = await Promise.allSettled(placeIds.map((id) => deletePlace(id)));
  return results.filter((r) => r.status === "rejected").length;
}

export async function getPlaces(): Promise<Place[]> {
  const res = await apiFetch("/api/places");
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/places failed: ${res.status}`);
  }
  return res.json();
}

export async function getPlace(id: number): Promise<Place | null> {
  const res = await apiFetch(`/api/places/${id}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/places/${id} failed: ${res.status}`);
  }
  return res.json();
}

export async function generateItinerary(jobId: number): Promise<void> {
  const res = await apiFetch(`/api/places/videos/${jobId}/itinerary`, { method: "POST" });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/places/videos/${jobId}/itinerary failed: ${res.status}`);
  }
}

export async function moveToDay(placeId: number, dayNumber: number): Promise<Place> {
  const res = await apiFetch(`/api/places/${placeId}/day`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dayNumber }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `PATCH /api/places/${placeId}/day failed: ${res.status}`);
  }
  return res.json();
}

export async function reorderPlace(placeId: number, direction: "UP" | "DOWN"): Promise<Place> {
  const res = await apiFetch(`/api/places/${placeId}/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `PATCH /api/places/${placeId}/order failed: ${res.status}`);
  }
  return res.json();
}

export async function optimizeRoute(jobId: number, day: number): Promise<Place[]> {
  const res = await apiFetch(`/api/places/videos/${jobId}/days/${day}/optimize-route`, { method: "POST" });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/places/videos/${jobId}/days/${day}/optimize-route failed: ${res.status}`);
  }
  return res.json();
}
