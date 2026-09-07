import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

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
          ? { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 }
          : { alignItems: "center", gap: 12, padding: 16 }
      }
    >
      <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>{message}</AppText>
      <Pressable
        onPress={onRetry}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.accent,
        }}
      >
        <AppText weight="medium" style={{ fontSize: 13, color: colors.accent }}>
          다시 시도
        </AppText>
      </Pressable>
    </View>
  );
}
