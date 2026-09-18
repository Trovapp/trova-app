import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Emoji } from "@/components/Emoji";
import { colors } from "@/lib/theme";

export function RatingBadge({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <Emoji symbol="⭐" size={size} />
      <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{rating.toFixed(1)}</AppText>
    </View>
  );
}
