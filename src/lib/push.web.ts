import { deletePushSubscription, getPushPublicKey, savePushSubscription } from "@/lib/api/push";
import { getToken } from "@/lib/tokenStorage";
import { SNOOZE_MS, base64UrlToBytes, shouldShowPushPrompt } from "@/lib/pushLogic";

// PWA 웹 푸시(백엔드 #185, ADR 0016). 아이폰은 홈 화면에 설치한 앱(iOS 16.4+)에서만 되고, 권한은 사용자가 버튼을 눌렀을 때만 묻는다.
export type PushStatus = "unsupported" | "blocked" | "off" | "on";

const SNOOZE_KEY = "trova.pushPromptSnoozedUntil";

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

/** 지금 구독이 있으면 그대로, 없으면 서버 공개 키로 새로 만든다. 서버에 키가 없으면 null. */
function ensureSubscription(): Promise<PushSubscription | null> {
  subscribing ??= (async () => {
    const publicKey = await getPushPublicKey();
    if (!publicKey) return null;
    const registration = await navigator.serviceWorker.ready;
    return (
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey) as BufferSource,
      }))
    );
  })().finally(() => {
    subscribing = null;
  });
  return subscribing;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isSupported() || !isStandalone()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
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
  return "on";
}

/** 로그아웃·끄기. 서버에서 먼저 지우고(토큰 필요) 브라우저 구독을 끊는다. */
export async function disablePush(): Promise<void> {
  if (!isSupported()) return;
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await deletePushSubscription(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => false);
}

/** 앱을 열 때마다 — 구독이 바뀌거나 서버에서 지워졌어도 되살린다. 권한이 없으면 아무것도 묻지 않는다. */
export async function refreshPushSubscription(): Promise<void> {
  if (!isSupported() || !isStandalone() || Notification.permission !== "granted") return;
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
  const hasPublicKey = loggedIn ? Boolean(await getPushPublicKey().catch(() => null)) : false;
  const subscribed = permission === "granted" ? Boolean(await currentSubscription().catch(() => null)) : false;
  return shouldShowPushPrompt({
    standalone,
    supported,
    permission,
    hasPublicKey,
    loggedIn,
    subscribed,
    snoozedUntil: readSnooze(),
    now: Date.now(),
  });
}
