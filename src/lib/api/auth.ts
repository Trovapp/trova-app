import { Platform } from "react-native";
import { ApiError, apiFetch } from "@/lib/api/client";
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
    throw new ApiError(res.status, `GET /api/auth/me failed: ${res.status}`);
  }
  return res.json();
}

// 앱은 딥링크(trova://auth?token=)로, 웹(PWA)은 1회용 코드(/auth/callback/?code=)로 돌아온다(ADR 0013).
export function oauthUrl(provider: "kakao" | "google"): string {
  const client = Platform.OS === "web" ? "client=web" : "mobile=true";
  return `${API_BASE_URL}/oauth2/authorization/${provider}?${client}`;
}

/** 웹(PWA) 로그인의 1회용 코드(60초·1회)를 앱 토큰으로 바꾼다. */
export async function exchangeWebLoginCode(code: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/web-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/auth/web-exchange failed: ${res.status}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

export async function withdraw(): Promise<void> {
  const res = await apiFetch("/api/users/me", { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/users/me failed: ${res.status}`);
  }
}
