import { requireOptionalNativeModule } from "expo-modules-core";

// 인앱 결제(여행 패스, 2026-10-05). expo-iap는 네이티브 모듈이라, 이 모듈이 들어가기 전 빌드에서 그냥 불러오면
// 앱이 시작하자마자 멈춘다 — 모듈이 있을 때만 불러오고, 없으면 구매 버튼을 "이 버전에서는 결제할 수 없어요"로 바꾼다.
const hasNative = requireOptionalNativeModule("ExpoIap") != null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const iap = hasNative ? (require("expo-iap") as typeof import("expo-iap")) : null;

// App Store Connect(나중)와 Xcode StoreKit 테스트 설정(ios/TrovaStoreKit.storekit)에 같은 id로 둔다. 서버 설정과도 같다.
export const TRAVEL_PASS_PRODUCT_ID = "com.trovapp.trova.travelpass30";
export const TRAVEL_PASS_FALLBACK_PRICE = "4,900원";
