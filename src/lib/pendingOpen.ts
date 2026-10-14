import type { OpenTarget } from "@/lib/pushLogic";

// 알림을 눌러 연 화면(백엔드 #185). 로그인 전·내비게이션 준비 전일 수 있어 담아 두고, 준비되면 한 번 꺼낸다(pendingShare와 같은 방식).
let pending: OpenTarget | null = null;

export function setPendingOpen(target: OpenTarget) {
  pending = target;
}

export function takePendingOpen(): OpenTarget | null {
  const target = pending;
  pending = null;
  return target;
}
