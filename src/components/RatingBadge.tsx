import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Emoji } from "@/components/Emoji";
import { colors, fontSize, space } from "@/lib/theme";

export function RatingBadge({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxxs }}>
      <Emoji symbol="⭐" size={size} />
      <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{rating.toFixed(1)}</AppText>
    </View>
  );
}
