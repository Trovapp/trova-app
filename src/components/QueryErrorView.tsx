import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 조회 실패를 "데이터 없음"과 구분해서 보여주고, 다시 시도할 수단을 준다.
export function QueryErrorView({
  message,
  onRetry,
  fullScreen = false,
}: {
  message: string;
  onRetry: () => void;
  fullScreen?: boolean;
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
          borderWidth: 1,
          borderColor: colors.accent,
        }}
      >
        <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
          다시 시도
        </AppText>
      </PressableScale>
    </View>
  );
}
