import * as SecureStore from "expo-secure-store";

// 로그인 전 온보딩은 기기마다 한 번만 보여준다. 내용이 크게 바뀌면 키 뒤 버전을 올려 다시 보여준다.
const ONBOARDING_SEEN_KEY = "trova_onboarding_seen_v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY)) === "1";
}

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, "1");
}
