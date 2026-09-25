import { clearToken, getToken } from "@/lib/tokenStorage";
import { API_BASE_URL } from "@/lib/api/config";

// AuthProvider가 등록해두는 콜백 — 401을 받으면 토큰만 지우는 게 아니라
// 인증 상태(user)도 즉시 null로 바꿔서 네비게이터가 로그인 화면으로
// 전환되게 한다. 모듈 스코프 변수로 두는 이유는 apiFetch가 훅이 아니라
// 어디서든 호출되는 평범한 함수라 React context를 직접 구독할 수 없기
// 때문.
// 오류 타입/판단 함수는 네이티브 모듈 의존이 없는 errors.ts에 두고(단위 테스트 가능) 여기서 다시 내보낸다.
export { ApiError, shouldRetryQuery, toUserMessage } from "@/lib/api/errors";

// hadToken: 토큰을 보냈는데 401이면 "세션 만료", 토큰 없이 401이면 원래 비로그인(첫 실행 등)이다.
let unauthorizedHandler: ((info: { hadToken: boolean }) => void) | null = null;

export function setUnauthorizedHandler(handler: (info: { hadToken: boolean }) => void): void {
  unauthorizedHandler = handler;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    await clearToken();
    unauthorizedHandler?.({ hadToken: Boolean(token) });
  }
  return res;
}
