import { apiFetch } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";

export type CurrentUser = {
  id: number;
  nickname: string | null;
  profileImageUrl: string | null;
};

export async function getMe(): Promise<CurrentUser | null> {
  const res = await apiFetch("/api/auth/me");
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`GET /api/auth/me failed: ${res.status}`);
  }
  return res.json();
}

export function oauthUrl(provider: "kakao" | "google"): string {
  return `${API_BASE_URL}/oauth2/authorization/${provider}?mobile=true`;
}
