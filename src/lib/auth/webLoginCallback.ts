// 앱(iOS·안드로이드)은 딥링크로 로그인 결과를 받는다 — 웹 콜백은 없다. 웹은 webLoginCallback.web.ts.
export type WebLoginCallback = { code: string } | { error: string } | null;

export function takeWebLoginCallback(): WebLoginCallback {
  return null;
}
