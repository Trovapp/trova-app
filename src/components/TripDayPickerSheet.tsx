import { useState, type RefObject } from "react";
import { ActivityIndicator, Dimensions, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { listTrips, tripDayCount, type Trip } from "@/lib/api/trips";
import { formatTripDates } from "@/lib/date";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 영상 장소를 이미 만든 여행에 담을 때 여행과 일차를 고른다(2026-10-04 사용자 관점 QA, 백엔드 #126).
// 여행을 누르면 그 아래에 일차 칩이 펼쳐진다 — 시트를 두 번 띄우지 않게 한 화면에서 고른다.
// 여는 쪽이 sheetRef.current?.present()를 버튼에서 바로 부른다. visible 값을 바꿔 효과에서 present()를 부르면
// 영상 화면에서 시트가 열리지 않았다(2026-10-04 QA — present()는 불렸지만 애니메이션이 시작되지 않음).
export function TripDayPickerSheet({
  sheetRef,
  onSelect,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  onSelect: (trip: Trip, day: number) => void;
}) {
  const ref = sheetRef;
  const [openTripId, setOpenTripId] = useState<number | null>(null);
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });

  const trips = tripsQuery.data ?? [];

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      maxDynamicContentSize={Math.round(Dimensions.get("window").height * 0.7)}
      onDismiss={() => setOpenTripId(null)}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}>
        <AppText weight="medium" style={{ fontSize: fontSize.callout, marginBottom: space.sm }}>
          어느 여행에 담을까요?
        </AppText>
        {tripsQuery.isPending && <ActivityIndicator color={colors.inkMuted} style={{ marginTop: space.lg }} />}
        {tripsQuery.isError && (
          <AppText style={{ color: colors.inkMuted }}>여행 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</AppText>
        )}
        {tripsQuery.isSuccess && trips.length === 0 && (
          <AppText style={{ color: colors.inkMuted }}>아직 여행이 없어요. 내 여행에서 먼저 만들어 주세요.</AppText>
        )}
        {trips.map((trip, index) => {
          const open = openTripId === trip.id;
          const summary = [
            trip.startDate ? formatTripDates(trip.startDate, trip.endDate) : null,
            trip.regions?.length ? trip.regions.join("·") : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <View key={trip.id} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.borderSubtle }}>
              <PressableRow
                onPress={() => setOpenTripId(open ? null : trip.id)}
                accessibilityState={{ expanded: open }}
                style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md }}
              >
                <View style={{ flex: 1, gap: space.xxxs }}>
                  <AppText weight="medium" numberOfLines={1}>
                    {trip.title}
                  </AppText>
                  {summary.length > 0 && (
                    <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
                      {summary}
                    </AppText>
                  )}
                </View>
                <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.inkMuted} />
              </PressableRow>
              {open && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingBottom: space.md }}>
                  {Array.from({ length: tripDayCount(trip) }, (_, i) => i + 1).map((day) => (
                    <PressableScale
                      key={day}
                      onPress={() => {
                        onSelect(trip, day);
                        ref.current?.dismiss();
                      }}
                      style={{
                        paddingVertical: space.sm,
                        paddingHorizontal: space.md,
                        borderRadius: radius.full,
                        backgroundColor: colors.accentBg,
                      }}
                    >
                      <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
                        {day}일차
                      </AppText>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
