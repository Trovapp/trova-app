// 웹 푸시(백엔드 #185, ADR 0016)에서 화면·브라우저와 무관한 판단만 모은다. node --test로 검사한다(scripts/push-logic.test.mjs).

export type OpenTarget = { kind: "draft"; draftId: number } | { kind: "trip"; tripId: number; tripPlaceId?: number };

// 0도 받는다 — 관리자 테스트 알림이 없는 번호(0)로 "찾을 수 없어요" 화면까지 확인한다.
const ID = /^\d{1,15}$/;

/** 서버가 알림에 실어 보낸 이동 값(draft:12, trip:45:place:678). 형식이 다르면 null — 주소에서 온 값이라 엄격하게. */
export function parseOpenTarget(open: string | null | undefined): OpenTarget | null {
  if (!open) return null;
  const parts = open.split(":");
  if (parts[0] === "draft" && parts.length === 2 && ID.test(parts[1])) {
    return { kind: "draft", draftId: Number(parts[1]) };
  }
  if (parts[0] === "trip" && ID.test(parts[1] ?? "")) {
    if (parts.length === 2) return { kind: "trip", tripId: Number(parts[1]) };
    if (parts.length === 4 && parts[2] === "place" && ID.test(parts[3])) {
      return { kind: "trip", tripId: Number(parts[1]), tripPlaceId: Number(parts[3]) };
    }
  }
  return null;
}

export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export type PromptInput = {
  standalone: boolean;
  supported: boolean;
  permission: "default" | "granted" | "denied";
  hasPublicKey: boolean;
  loggedIn: boolean;
  subscribed: boolean;
  // 마이페이지에서 직접 끈 사람 — 앱을 열 때 다시 등록하지 않고 카드도 다시 묻지 않는다(설정에서만 다시 켬).
  optedOut: boolean;
  snoozedUntil: number | null;
  now: number;
};

/** 권한 묻는 카드: 설치한 앱 + 지원 + 로그인 + 서버 키 있음 + 직접 끄지 않음 + (아직 안 물음 또는 허용했는데 구독 없음) + [나중에] 7일 지남. */
export function shouldShowPushPrompt(input: PromptInput): boolean {
  if (!input.standalone || !input.supported || !input.loggedIn || !input.hasPublicKey) return false;
  if (input.permission === "denied" || input.optedOut) return false;
  if (input.permission === "granted" && input.subscribed) return false;
  if (input.snoozedUntil !== null && input.snoozedUntil > input.now) return false;
  return true;
}

/** pushManager.subscribe의 applicationServerKey용. */
export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 구독이 만들어질 때의 서버 공개 키와 지금 서버 키가 같은지 — 다르면(키 교체) 그 구독은 계속 403이라 다시 구독한다. */
export function sameKey(subscriptionKey: ArrayBuffer | null | undefined, serverKey: Uint8Array): boolean {
  if (!subscriptionKey) return false;
  const a = new Uint8Array(subscriptionKey);
  if (a.length !== serverKey.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== serverKey[i]) return false;
  return true;
}

/** 알림으로 연 주소에서 open만 지운다 — 다른 값(유입 경로 등)은 남긴다. */
export function withoutOpenParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("open");
  const rest = params.toString();
  return rest ? `/?${rest}` : "/";
}
