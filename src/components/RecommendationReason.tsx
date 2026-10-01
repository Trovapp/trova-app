import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Emoji } from "@/components/Emoji";
import { colors, fontSize, space } from "@/lib/theme";

export function RecommendationReason({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.xxs }}>
      <Emoji symbol="✨" size={13} style={{ marginTop: 1 /* 토큰 예외: 이모지를 글자 기준선에 맞추는 1px 보정 */ }} />
      <AppText style={{ fontSize: fontSize.caption1, color: colors.accent, flex: 1 }}>{text}</AppText>
    </View>
  );
}
