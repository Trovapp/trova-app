import type { ReactNode } from "react";

// 앱(iOS·안드로이드)은 바로 앱 화면 — 소개·설치 안내는 웹(PWA)에서만(WebEntryGate.web.tsx).
export function WebEntryGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
