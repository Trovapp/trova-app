import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/PressableScale";
import { colors } from "@/lib/theme";

// headerShown: false로 네이티브 헤더 자체를 끈 화면(Processing/TripReplan)에서
// 뒤로 갈 방법이 전혀 안 보이던 걸 보완한다 — 화면 자체 디자인(전체 화면 진행률
// 히어로 등)은 유지하면서 최소한의 뒤로가기 흔적만 얹는다.
const BUTTON_TOP_GAP = 8;
const BUTTON_SIZE = 36;

// 버튼이 absolute로 떠 있으므로, 아래 콘텐츠는 이만큼 위를 비워야 버튼과 겹치지 않는다.
// 예전엔 화면마다 paddingTop 64/72를 고정값으로 넣어서 다이내믹 아일랜드 기기(상단 안전영역 ~62pt)에선
// 버튼(~70~106pt)과 제목이 겹치고, 안전영역이 작은 기기(SE, 20pt)에선 위가 과하게 비었다.
export function useBackButtonClearance(): number {
  const insets = useSafeAreaInsets();
  return insets.top + BUTTON_TOP_GAP + BUTTON_SIZE + 16;
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      style={{
        position: "absolute",
        top: insets.top + BUTTON_TOP_GAP,
        left: 16,
        zIndex: 10,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
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
