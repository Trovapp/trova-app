import { apiFetch } from "@/lib/api/client";

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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export function oauthUrl(provider: "kakao" | "google"): string {
  return `${API_BASE_URL}/oauth2/authorization/${provider}?mobile=true`;
}
