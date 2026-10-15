import type { ConfigContext, ExpoConfig } from "expo/config";

// 안드로이드 앱(ADR 0017). app.json을 바탕으로 빌드마다 달라지는 것만 여기서 더한다.
// - preview(에뮬레이터 확인용) 빌드만 http를 허용한다 — 로컬 서버(localhost:8080 + adb reverse)를 보려고. 운영 빌드는 https만.
// - 앱 알림(Expo 푸시)은 안드로이드에서 FCM을 쓰므로 Firebase 설정 파일을 연결한다. 레포가 공개라 파일은 올리지 않고
//   EAS 파일 변수(GOOGLE_SERVICES_JSON)로 넘긴다. 로컬에서는 같은 이름의 파일(.gitignore).
//   경로는 항상 ./google-services.json — 빌드 서버 경로가 설정에 들어가면 fingerprint가 로컬과 달라져
//   업데이트가 내려가지 않는다(#33). 빌드 서버에서는 eas-build-pre-install이 파일을 이 자리로 복사한다.
export default ({ config }: ConfigContext): ExpoConfig => {
  // production 프로필은 TROVA_ALLOW_HTTP=0을 박아 두어, EAS 변수가 잘못 들어가도 운영 빌드에 http가 열리지 않게 한다.
  const allowHttp =
    process.env.EAS_BUILD_PROFILE !== "production" &&
    (process.env.EAS_BUILD_PROFILE === "preview" || process.env.TROVA_ALLOW_HTTP === "1");
  const base = config as ExpoConfig;
  return {
    ...base,
    // 무선 업데이트(EAS Update, #33). fingerprint는 네이티브 쪽(라이브러리·권한·이 설정)이 바뀌면 값이 달라져,
    // 새 빌드가 필요한 변경이 옛 앱에 업데이트로 내려가지 않는다. 받은 업데이트는 다음 실행 때 적용된다.
    runtimeVersion: { policy: "fingerprint" },
    updates: { url: `https://u.expo.dev/${base.extra?.eas?.projectId}` },
    android: {
      ...base.android,
      googleServicesFile: "./google-services.json",
    },
    plugins: [
      ...(base.plugins ?? []),
      ["expo-notifications", { icon: "./assets/android-icon-monochrome.png", color: "#E14A2B", defaultChannel: "trova-default" }],
      ["expo-build-properties", { android: { usesCleartextTraffic: allowHttp } }],
      "./plugins/withNoEditTextUnderline",
    ],
  };
};
