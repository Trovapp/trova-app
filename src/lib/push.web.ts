import { deletePushSubscription, getPushPublicKey, savePushSubscription } from "@/lib/api/push";
import { getToken } from "@/lib/tokenStorage";
import { SNOOZE_MS, base64UrlToBytes, sameKey, shouldShowPushPrompt } from "@/lib/pushLogic";

// PWA 웹 푸시(백엔드 #185, ADR 0016). 아이폰은 홈 화면에 설치한 앱(iOS 16.4+)에서만 되고, 권한은 사용자가 버튼을 눌렀을 때만 묻는다.
export type PushStatus = "unsupported" | "blocked" | "off" | "on";

const SNOOZE_KEY = "trova.pushPromptSnoozedUntil";
// 마이페이지에서 직접 끈 표시 — 권한은 그대로라 앱을 열 때 다시 등록되던 문제(2026-10-14 최종 리뷰).
const OPT_OUT_KEY = "trova.pushOptedOut";

function readOptOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOptOut(on: boolean): void {
  try {
    if (on) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // 저장소가 막혀 있으면 이번 페이지에서만.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function toBody(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } };
}

// 앱을 열 때의 재등록과 [알림 받기]가 동시에 불리면 구독이 두 개 생겨 같은 알림이 두 번 갔다(2026-10-14 로컬 확인) —
// 진행 중인 구독 만들기를 함께 기다린다.
let subscribing: Promise<PushSubscription | null> | null = null;
// 서버 공개 키는 바뀔 일이 드물다 — 화면마다 다시 묻지 않게 이 페이지 안에서 기억한다(#25).
let cachedPublicKey: string | null = null;

async function publicKey(): Promise<string | null> {
  if (cachedPublicKey) return cachedPublicKey;
  cachedPublicKey = await getPushPublicKey();
  return cachedPublicKey;
}

/** 지금 구독이 있으면 그대로, 없으면 서버 공개 키로 새로 만든다. 서버에 키가 없으면 null. */
function ensureSubscription(): Promise<PushSubscription | null> {
  subscribing ??= (async () => {
    const key = await publicKey();
    if (!key) return null;
    const serverKey = base64UrlToBytes(key);
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    // 서버 키가 바뀌면 예전 구독은 푸시 서버가 계속 거절한다(403) — 끊고 새 키로 다시 만든다(#25).
    if (existing && sameKey(existing.options.applicationServerKey, serverKey)) return existing;
    if (existing) await existing.unsubscribe().catch(() => false);
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey as BufferSource });
  })().finally(() => {
    subscribing = null;
  });
  return subscribing;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isSupported() || !isStandalone()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted" || readOptOut()) return "off";
  return (await currentSubscription()) ? "on" : "off";
}

/** [알림 받기]·설정 켜기를 눌렀을 때만 — 아이폰은 사용자 동작 안에서만 권한을 물을 수 있다. */
export async function enablePush(): Promise<PushStatus> {
  if (!isSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  const subscription = await ensureSubscription();
  if (!subscription) return "off";
  await savePushSubscription(toBody(subscription));
  writeOptOut(false);
  return "on";
}

/**
 * 로그아웃·끄기. 서버에서 먼저 지우고(토큰 필요) 브라우저 구독을 끊는다.
 * optOut: 마이페이지에서 직접 끈 경우 — 앱을 열 때 다시 등록하지 않는다. 로그아웃은 다음 사람을 위해 표시를 지운다.
 */
export async function disablePush(options: { optOut?: boolean } = {}): Promise<void> {
  writeOptOut(options.optOut === true);
  if (!isSupported()) return;
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await deletePushSubscription(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => false);
}

/** 앱을 열 때마다 — 구독이 바뀌거나 서버에서 지워졌어도 되살린다. 권한이 없으면 아무것도 묻지 않는다. */
export async function refreshPushSubscription(): Promise<void> {
  if (!isSupported() || !isStandalone() || Notification.permission !== "granted" || readOptOut()) return;
  const subscription = await ensureSubscription();
  if (subscription) await savePushSubscription(toBody(subscription));
}

function readSnooze(): number | null {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function snoozePushPrompt(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    // 저장소가 막힌 브라우저(사생활 보호 모드)면 이번 화면에서만 숨긴다.
  }
}

export async function isPushPromptVisible(): Promise<boolean> {
  const supported = isSupported();
  const standalone = isStandalone();
  if (!supported || !standalone) return false;
  const loggedIn = Boolean(await getToken());
  const permission = Notification.permission as "default" | "granted" | "denied";
  const hasPublicKey = loggedIn ? Boolean(await publicKey().catch(() => null)) : false;
  const subscribed = permission === "granted" ? Boolean(await currentSubscription().catch(() => null)) : false;
  return shouldShowPushPrompt({
    standalone,
    supported,
    permission,
    hasPublicKey,
    loggedIn,
    subscribed,
    optedOut: readOptOut(),
    snoozedUntil: readSnooze(),
    now: Date.now(),
  });
}
