import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/PressableScale";
import { colors } from "@/lib/theme";

// headerShown: false로 네이티브 헤더 자체를 끈 화면(Processing/TripReplan)에서
// 뒤로 갈 방법이 전혀 안 보이던 걸 보완한다 — 화면 자체 디자인(전체 화면 진행률
// 히어로 등)은 유지하면서 최소한의 뒤로가기 흔적만 얹는다.
export function BackButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: colors.bgMuted,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Feather name="chevron-left" size={20} color={colors.ink} />
    </PressableScale>
  );
}
