import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

const FONT_SIZE = 13;
const LINE_HEIGHT = 19;
const ICON_SIZE = 14;

// 에러 문구 — 색은 브랜드 accent 그대로다(theme.ts 규칙상 새 색은 웹 globals.css와 함께
// 추가해야 함). 대신 경고 아이콘을 붙여 "상세보기"·"+ 새 폴더" 같은 accent 링크와 구분하고,
// 화면마다 12/13/기본으로 흩어져 있던 글자 크기를 하나로 맞춘다.
export function ErrorText({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-start", gap: 6 }, style]}>
      <Feather
        name="alert-circle"
        size={ICON_SIZE}
        color={colors.accent}
        // 여러 줄로 줄바꿈돼도 아이콘이 첫 줄 가운데에 오도록.
        style={{ marginTop: (LINE_HEIGHT - ICON_SIZE) / 2 }}
      />
      <AppText style={{ flexShrink: 1, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, color: colors.accent }}>
        {children}
      </AppText>
    </View>
  );
}
