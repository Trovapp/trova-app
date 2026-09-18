import { Feather } from "@expo/vector-icons";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

export function RatingBadge({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <Feather name="star" size={size} color={colors.inkMuted} />
      <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{rating.toFixed(1)}</AppText>
    </View>
  );
}
