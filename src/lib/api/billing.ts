import { ApiError, apiFetch } from "@/lib/api/client";

// 무료·여행 패스 상태(백엔드 #130). enforced가 false면 서버가 아직 막지 않는다(결제를 열기 전) — 사용량만 보여 준다.
export type MeteredFeature = "ANALYSIS" | "DRAFT" | "ASSIST";

export type FeatureUsage = { used: number; limit: number; remaining: number; period: "MONTH" | "DAY" };

export type BillingStatus = {
  plan: "FREE" | "PASS";
  passExpiresAt: string | null;
  enforced: boolean;
  usage: Record<MeteredFeature, FeatureUsage>;
  productId: string;
  // 결제 요청에 넣는 회원별 값 — 서버가 거래 속 값과 맞춰 봐서 남의 영수증을 못 쓰게 한다.
  appAccountToken: string;
};

export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await apiFetch(`/api/billing/status`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/billing/status failed: ${res.status}`);
  }
  return res.json();
}

/** StoreKit 거래(JWS)를 서버에 보내 30일 패스를 붙인다. 같은 거래를 다시 보내도 한 장만 생긴다. */
export async function recordAppleTransaction(signedTransaction: string): Promise<BillingStatus> {
  const res = await apiFetch(`/api/billing/apple-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTransaction }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, `POST /api/billing/apple-transactions failed: ${res.status}`, body?.message);
  }
  return res.json();
}

export const FEATURE_LABELS: Record<MeteredFeature, string> = {
  ANALYSIS: "영상 분석",
  DRAFT: "AI 일정 초안",
  ASSIST: "비서·대안 찾기",
};
