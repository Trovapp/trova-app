import { Feather } from "@expo/vector-icons";
import type { StyleProp, ViewStyle } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import { colors } from "@/lib/theme";

// 콘텐츠가 큰 바텀시트(장소 정보·대안 찾기·비서 대화)는 바깥 탭으로 닫히지 않아 끌어내리기만 가능했다 —
// 끌어내리기를 모르는 사용자도 닫을 수 있게 모든 시트에 같은 × 버튼을 둔다.
export function SheetCloseButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <PressableScale onPress={onPress} hitSlop={10} style={style}>
      <Feather name="x" size={18} color={colors.inkMuted} />
    </PressableScale>
  );
}
