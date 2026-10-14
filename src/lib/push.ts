import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { deleteExpoPushToken, saveExpoPushToken } from "@/lib/api/push";
import { getToken } from "@/lib/tokenStorage";
import { SNOOZE_MS, shouldShowPushPrompt } from "@/lib/pushLogic";

// 안드로이드 앱 알림(Expo 푸시, 백엔드 #190, ADR 0017). 웹은 push.web.ts. 아이폰 네이티브 앱은 이번 범위가 아니라
// 아이폰에서는 아무것도 하지 않는다(아이폰 사용자는 PWA 웹 푸시). 함수 모양은 웹과 같다.
export type PushStatus = "unsupported" | "blocked" | "off" | "on";

export const PUSH_CHANNEL = "trova-default";
const TOKEN_KEY = "trova.expoPushToken";
const SNOOZE_KEY = "trova.pushPromptSnoozedUntil";
const supported = Platform.OS === "android";

if (supported) {
  // 앱을 보고 있을 때 온 알림도 배너로 보인다(안 보이면 "왜 안 오지?"가 된다).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: "일정·날씨 알림",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

async function registerToken(): Promise<void> {
  await ensureChannel();
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await saveExpoPushToken(data);
  await SecureStore.setItemAsync(TOKEN_KEY, data);
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!supported) return "unsupported";
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === "denied" && !permission.canAskAgain) return "blocked";
  if (permission.status !== "granted") return "off";
  return (await SecureStore.getItemAsync(TOKEN_KEY)) ? "on" : "off";
}

/** [알림 받기]·설정 켜기를 눌렀을 때만 — 안드로이드 13 이상은 여기서 알림 권한 창이 뜬다. */
export async function enablePush(): Promise<PushStatus> {
  if (!supported) return "unsupported";
  await ensureChannel(); // 안드로이드 13+는 채널이 하나 있어야 권한 창이 뜬다.
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return permission.canAskAgain ? "off" : "blocked";
  await registerToken();
  return "on";
}

/** 로그아웃·끄기. 서버에서 지운다(토큰 필요). 권한 자체는 설정에서만 끌 수 있다. */
export async function disablePush(): Promise<void> {
  if (!supported) return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  await deleteExpoPushToken(token).catch(() => {});
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** 앱을 열 때마다 — 토큰이 바뀌거나 서버에서 지워졌어도 되살린다. 권한이 없으면 묻지 않는다. */
export async function refreshPushSubscription(): Promise<void> {
  if (!supported) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;
  await registerToken();
}

export function snoozePushPrompt(): void {
  SecureStore.setItemAsync(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)).catch(() => {});
}

export async function isPushPromptVisible(): Promise<boolean> {
  if (!supported) return false;
  const permission = await Notifications.getPermissionsAsync();
  const status = permission.status === "granted" ? "granted" : permission.canAskAgain ? "default" : "denied";
  const snooze = await SecureStore.getItemAsync(SNOOZE_KEY);
  return shouldShowPushPrompt({
    standalone: true,
    supported: true,
    permission: status,
    hasPublicKey: true,
    loggedIn: Boolean(await getToken()),
    subscribed: Boolean(await SecureStore.getItemAsync(TOKEN_KEY)),
    snoozedUntil: snooze ? Number(snooze) : null,
    now: Date.now(),
  });
}
