import { Pressable, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";
import { dismissNotification, listNotifications } from "@/lib/api/notifications";

export function WeatherAlertBanner({
  tripId,
  onOpenAlternative,
}: {
  tripId?: number;
  // 홈 탭(tripId 없음)에서는 그 알림이 속한 여행으로 이동만 시키면 되고,
  // 여행 상세 화면(tripId 있음)에서는 바로 대안 찾기 시트를 열어야 해서
  // 어느 여행/어느 장소인지 둘 다 호출부에 넘겨준다.
  onOpenAlternative: (tripId: number, tripPlaceId: number) => void;
}) {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["notifications"], queryFn: listNotifications });

  const notifications = (notificationsQuery.data ?? []).filter((n) => tripId === undefined || n.tripId === tripId);
  const target = notifications[0];
  if (!target) return null;

  async function handleDismiss() {
    await dismissNotification(target.id);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Pressable
      onPress={() => onOpenAlternative(target.tripId, target.tripPlaceId)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.accentBg,
      }}
    >
      <AppText style={{ fontSize: 18 }}>☔</AppText>
      <View style={{ flex: 1 }}>
        <AppText weight="medium" style={{ fontSize: 13 }}>
          {target.title}
        </AppText>
        <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={2}>
          {target.body}
        </AppText>
      </View>
      <Pressable onPress={handleDismiss} hitSlop={10}>
        <AppText style={{ fontSize: 16, color: colors.inkMuted }}>✕</AppText>
      </Pressable>
    </Pressable>
  );
}
