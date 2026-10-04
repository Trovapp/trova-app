import { requireOptionalNativeModule } from "expo-modules-core";
import type { ComponentType } from "react";
import type { ClipboardPasteButtonProps } from "expo-clipboard";

// 홈의 "붙여넣기"(2026-10-04 사용자 관점 QA): 링크를 복사해 와도 입력창을 길게 눌러 붙여넣어야 했다.
// iOS 기본 붙여넣기 버튼(UIPasteControl)은 "붙여넣기 허용" 확인창 없이 바로 붙여 넣는다.
// expo-clipboard는 네이티브 모듈이라, 이 모듈이 들어가기 전 빌드에서 그냥 import하면 앱이 시작하자마자 멈춘다 —
// 모듈이 있을 때만 불러오고, 없으면 버튼을 숨긴다.
const hasNative = requireOptionalNativeModule("ExpoClipboard") != null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const clipboard = hasNative ? (require("expo-clipboard") as typeof import("expo-clipboard")) : null;

export const PasteButton: ComponentType<ClipboardPasteButtonProps> | null =
  clipboard && clipboard.isPasteButtonAvailable ? clipboard.ClipboardPasteButton : null;
