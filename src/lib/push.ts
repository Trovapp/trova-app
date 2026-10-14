// 앱(iOS·안드로이드)은 이번에 푸시가 없다(Expo 푸시는 앱스토어 출시 때, 백엔드 #137). 웹은 push.web.ts.
export type PushStatus = "unsupported" | "blocked" | "off" | "on";

export async function getPushStatus(): Promise<PushStatus> {
  return "unsupported";
}

export async function enablePush(): Promise<PushStatus> {
  return "unsupported";
}

export async function disablePush(): Promise<void> {}

export async function refreshPushSubscription(): Promise<void> {}

export async function isPushPromptVisible(): Promise<boolean> {
  return false;
}

export function snoozePushPrompt(): void {}
