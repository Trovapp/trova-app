import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { dismissNotification, listNotifications } from "@/lib/api/notifications";
import { hitSlopFor } from "@/lib/touch";

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
  const [dismissError, setDismissError] = useState<string | null>(null);

  const notifications = (notificationsQuery.data ?? []).filter((n) => tripId === undefined || n.tripId === tripId);
  const target = notifications[0];
  if (!target) return null;

  async function handleDismiss() {
    try {
      await dismissNotification(target.id);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      setDismissError("닫지 못했어요. 다시 시도해주세요.");
    }
  }

  return (
    <PressableScale
      onPress={() => onOpenAlternative(target.tripId, target.tripPlaceId)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        padding: space.sm,
        borderRadius: radius.md,
        backgroundColor: colors.accentBg,
      }}
    >
      <Feather name="cloud-rain" size={18} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <AppText weight="medium" style={{ fontSize: fontSize.footnote }}>
          {target.title}
        </AppText>
        {/* 두 줄로 자르면 큰 글자에서 뒤의 "실내 대안을 확인해보세요"가 …로 사라졌다(uiflow 화면 훑기, 2026-10-07) —
            안내 문장은 길이가 정해져 있어 자르지 않는다. */}
        <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
          {target.body}
        </AppText>
        {dismissError && (
          <ErrorText>{dismissError}</ErrorText>
        )}
      </View>
      <PressableScale onPress={handleDismiss} hitSlop={hitSlopFor(16)}>
        <Feather name="x" size={16} color={colors.inkMuted} />
      </PressableScale>
    </PressableScale>
  );
}
