import { Feather } from "@expo/vector-icons";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

export function RecommendationReason({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
      <Feather name="zap" size={12} color={colors.accent} style={{ marginTop: 2 }} />
      <AppText style={{ fontSize: 12, color: colors.accent, flex: 1 }}>{text}</AppText>
    </View>
  );
}
