// 웹(PWA)에는 보안 저장소(expo-secure-store)가 없다 — localStorage에 둔다(ADR 0013).
// 외부 스크립트를 막는 CSP(_headers)가 전제다. 아이폰 홈 화면 앱은 Safari와 저장소가 따로라 설치한 앱 안에서 다시 로그인한다.
const TOKEN_KEY = "trova_auth_token";

export async function getToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 저장소가 막힌 경우(사생활 보호 모드 등) 지울 것도 없다.
  }
}
