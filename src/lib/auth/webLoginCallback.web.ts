// 웹(PWA) 로그인에서 백엔드가 돌려보낸 /auth/callback/?code= 또는 ?error= 를 한 번만 꺼낸다(ADR 0013).
// 코드는 1회용(60초)이라 읽자마자 주소창·방문 기록에서 지운다.
export type WebLoginCallback = { code: string } | { error: string } | null;

export function takeWebLoginCallback(): WebLoginCallback {
  const { pathname, search } = window.location;
  if (!pathname.startsWith("/auth/callback")) return null;
  const params = new URLSearchParams(search);
  window.history.replaceState(null, "", "/");
  const code = params.get("code");
  if (code) return { code };
  return { error: params.get("error") ?? "oauth_failed" };
}
