import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 이미 받아 둔 내용이 있는데 다시 불러오기만 실패했을 때 쓰는 한 줄 안내(디자인 QA E1).
// 예전엔 이런 경우에도 화면 전체가 오류 안내로 바뀌어, 보고 있던 목록·지도가 사라졌다(홈 찜 지도에서 확인).
// 받아 둔 내용이 없을 때는 지금처럼 QueryErrorView(전체 오류 화면)를 쓴다.
export function StaleNotice({ onRetry, floating = false }: { onRetry: () => void; floating?: boolean }) {
  return (
    <View
      style={{
        // 지도가 화면을 채우는 곳(영상 속 장소·찜·여행 상세)은 맨 위에 띄운다.
        ...(floating ? { position: "absolute" as const, top: space.xs, left: space.md, right: space.md, zIndex: 10, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)" } : null),
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingVertical: space.xs,
        paddingHorizontal: space.sm,
        borderRadius: radius.md,
        backgroundColor: colors.bgMuted,
      }}
    >
      <Feather name="wifi-off" size={14} color={colors.inkMuted} />
      <AppText style={{ flex: 1, fontSize: fontSize.footnote, color: colors.inkMuted }}>최신 정보를 불러오지 못했어요.</AppText>
      <PressableScale onPress={onRetry} hitSlop={12} accessibilityRole="button">
        <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
          다시 시도
        </AppText>
      </PressableScale>
    </View>
  );
}
