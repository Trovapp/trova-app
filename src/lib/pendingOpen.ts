import type { OpenTarget } from "@/lib/pushLogic";

// 알림을 눌러 연 화면(백엔드 #185). 로그인 전·내비게이션 준비 전일 수 있어 담아 두고, 준비되면 한 번 꺼낸다(pendingShare와 같은 방식).
// 웹 로그인은 페이지를 떠났다가 돌아오므로(카카오·구글) 메모리만으로는 로그인 뒤에 사라진다 — 탭 저장소에도 담는다.
const KEY = "trova.pendingOpen";
let pending: OpenTarget | null = null;

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function setPendingOpen(target: OpenTarget) {
  pending = target;
  try {
    storage()?.setItem(KEY, JSON.stringify(target));
  } catch {
    // 저장소가 막혀 있으면 이번 페이지 안에서만 기억한다.
  }
}

export function takePendingOpen(): OpenTarget | null {
  let target = pending;
  pending = null;
  try {
    const s = storage();
    if (!target) {
      const raw = s?.getItem(KEY);
      target = raw ? (JSON.parse(raw) as OpenTarget) : null;
    }
    s?.removeItem(KEY);
  } catch {
    // 위와 같음.
  }
  return target;
}
