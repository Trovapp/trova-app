import type { ConfigContext, ExpoConfig } from "expo/config";

// 안드로이드 앱(ADR 0017). app.json을 바탕으로 빌드마다 달라지는 것만 여기서 더한다.
// - preview(에뮬레이터 확인용) 빌드만 http를 허용한다 — 로컬 서버(10.0.2.2:8080)를 보려고. 운영 빌드는 https만.
// - 앱 알림(Expo 푸시)은 안드로이드에서 FCM을 쓰므로 Firebase 설정 파일을 연결한다. 레포가 공개라 파일은 올리지 않고
//   EAS 파일 변수(GOOGLE_SERVICES_JSON)로 넘긴다. 로컬에서는 같은 이름의 파일(.gitignore).
export default ({ config }: ConfigContext): ExpoConfig => {
  const allowHttp = process.env.EAS_BUILD_PROFILE === "preview" || process.env.TROVA_ALLOW_HTTP === "1";
  const base = config as ExpoConfig;
  return {
    ...base,
    android: {
      ...base.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
    plugins: [
      ...(base.plugins ?? []),
      ["expo-notifications", { color: "#E14A2B", defaultChannel: "trova-default" }],
      ["expo-build-properties", { android: { usesCleartextTraffic: allowHttp } }],
      "./plugins/withNoEditTextUnderline",
    ],
  };
};
