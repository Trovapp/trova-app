import { createElement, type ComponentType } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { radius } from "@/lib/theme";

// 파일 이름은 .web.ts — 네이티브 파일(clipboard.ts)과 확장자가 같아야 Metro가 웹 빌드에서 이 파일을 고른다(JSX 대신 createElement).
// 웹(PWA)의 "복사한 링크 붙여넣기"(ADR 0013): iOS 네이티브 붙여넣기 버튼 대신, 누를 때만 클립보드를 읽는다.
// 브라우저는 사용자 동작 없이 클립보드를 못 읽고(아이폰은 "붙여넣기" 확인이 한 번 뜬다), 몰래 읽지 않는 게 맞다.
type WebPasteButtonProps = {
  acceptedContentTypes?: string[];
  displayMode?: string;
  cornerStyle?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  style?: StyleProp<ViewStyle>;
  onPress: (data: { type: "text"; text: string }) => void;
};

function WebPasteButton({ backgroundColor, foregroundColor, style, onPress }: WebPasteButtonProps) {
  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onPress({ type: "text", text });
    } catch {
      // 사용자가 붙여넣기를 거절했거나 브라우저가 막았다 — 입력칸에 직접 붙여넣으면 된다.
    }
  }
  return createElement(
    Pressable,
    {
      accessibilityRole: "button",
      accessibilityLabel: "복사한 링크 붙여넣기",
      onPress: paste,
      style: [{ alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor }, style],
    },
    createElement(Feather, { name: "clipboard", size: 22, color: foregroundColor }),
  );
}

const hasClipboard = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

// 홈은 네이티브 버튼과 같은 모양(props)으로 쓴다. 클립보드를 못 읽는 브라우저면 숨긴다.
export const PasteButton = (hasClipboard ? WebPasteButton : null) as ComponentType<WebPasteButtonProps> | null;
