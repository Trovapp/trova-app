import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

type PlaceRowItem = {
  id: number;
  placeName: string;
  address: string | null;
};

type PlaceRowProps = {
  place: PlaceRowItem;
  index: number;
  isLast: boolean;
  distanceKm: number | null;
  editable?: boolean;
  disabled?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onOpenDayPicker?: () => void;
  color?: string;
  children?: ReactNode;
};

export function PlaceRow({
  place,
  index,
  isLast,
  distanceKm,
  editable = false,
  disabled = false,
  onMoveUp,
  onMoveDown,
  onOpenDayPicker,
  color = colors.accent,
  children,
}: PlaceRowProps) {
  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: color,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: "#fff", fontSize: 12 }}>
            {index + 1}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View>
            <AppText weight="medium" numberOfLines={1}>
              {place.placeName}
            </AppText>
            {place.address && (
              <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                {place.address}
              </AppText>
            )}
          </View>
          {editable && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {(onMoveUp || onMoveDown) && (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    onPress={onMoveUp}
                    disabled={disabled || index === 0 || !onMoveUp}
                    style={{ opacity: disabled || index === 0 ? 0.3 : 1 }}
                  >
                    <AppText style={{ fontSize: 13, color: colors.inkMuted }}>↑</AppText>
                  </Pressable>
                  <Pressable
                    onPress={onMoveDown}
                    disabled={disabled || isLast || !onMoveDown}
                    style={{ opacity: disabled || isLast ? 0.3 : 1 }}
                  >
                    <AppText style={{ fontSize: 13, color: colors.inkMuted }}>↓</AppText>
                  </Pressable>
                </View>
              )}
              {onOpenDayPicker && (
                <Pressable onPress={onOpenDayPicker} disabled={disabled}>
                  <AppText style={{ fontSize: 13, color: colors.inkMuted }}>다른 날로 이동</AppText>
                </Pressable>
              )}
            </View>
          )}
          {children}
        </View>
      </View>
      {!isLast && distanceKm !== null && (
        <AppText style={{ fontSize: 11, color: colors.inkMuted, marginLeft: 38 }}>
          다음 장소까지 {distanceKm.toFixed(1)}km
        </AppText>
      )}
    </View>
  );
}
