import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 조회 실패를 "데이터 없음"과 구분해서 보여주고, 다시 시도할 수단을 준다.
export function QueryErrorView({
  message,
  onRetry,
  fullScreen = false,
  actionLabel = "다시 시도",
}: {
  message: string;
  onRetry: () => void;
  fullScreen?: boolean;
  // 다시 해도 같은 오류(없는 여행 등)는 "홈으로"처럼 다른 행동을 준다.
  actionLabel?: string;
}) {
  return (
    <View
      style={
        fullScreen
          ? { flex: 1, justifyContent: "center", alignItems: "center", gap: space.sm, padding: space.xl }
          : { alignItems: "center", gap: space.sm, padding: space.md }
      }
    >
      <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>{message}</AppText>
      <PressableScale
        onPress={onRetry}
        style={{
          paddingVertical: space.xs,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          // 테두리만 있는 버튼은 디자인 QA(C2)에서 옅은 채움 버튼으로 바꿨는데 여기만 남아 있었다(#35).
          backgroundColor: colors.accentBg,
        }}
      >
        <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
          {actionLabel}
        </AppText>
      </PressableScale>
    </View>
  );
}
