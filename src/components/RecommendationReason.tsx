import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Emoji } from "@/components/Emoji";
import { colors } from "@/lib/theme";

export function RecommendationReason({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
      <Emoji symbol="✨" size={13} style={{ marginTop: 1 }} />
      <AppText style={{ fontSize: 12, color: colors.accent, flex: 1 }}>{text}</AppText>
    </View>
  );
}
