import { useSyncExternalStore } from "react";

// 다른 앱의 공유 버튼으로 받은 링크(2026-10-04 사용자 관점 QA): 복사 → 앱 전환 → 붙여넣기 3단계를 공유 한 번으로.
// 받은 순간 홈이 아직 없을 수 있어(로그인 전·온보딩 중) 여기 담아 두고, 홈이 열리면 꺼내 분석을 시작한다.
let pending: string | null = null;
const listeners = new Set<() => void>();

export function setPendingShare(url: string) {
  pending = url;
  listeners.forEach((l) => l());
}

/** 한 번만 처리되게 꺼내면서 비운다. */
export function takePendingShare(): string | null {
  const url = pending;
  pending = null;
  if (url !== null) listeners.forEach((l) => l());
  return url;
}

export function usePendingShare(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
}
