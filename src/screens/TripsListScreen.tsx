import { useRef } from "react";
import { RefreshControl, SectionList, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { QueryErrorView } from "@/components/QueryErrorView";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { useListEntrance } from "@/hooks/useListEntrance";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { listTrips, type Trip } from "@/lib/api/trips";
import { formatTripDates, toDateString } from "@/lib/date";
import { groupTripsByDate } from "@/lib/tripSections";
import { colors } from "@/lib/theme";
import type { MainTabScreenProps } from "@/navigation/types";

type Props = MainTabScreenProps<"TripsList">;

// 디자인(2026-09): 예전엔 테두리+그림자 카드로 반복하던 걸, 홈 화면 "최근 여행"과
// 같은 구분선 리스트로 통일했다 — 같은 데이터(여행)가 화면마다 다르게 보이던
// 불일치를 없앤다. "새 여행 만들기"만 강한 accent 버튼으로 남기고 나머지는 낮춘다.
export function TripsListScreen({ navigation }: Props) {
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  const entranceFor = useListEntrance();
  const { refreshing, onRefresh } = usePullToRefresh(tripsQuery.refetch);
  // 이미 보고 있는 탭을 다시 누르면 맨 위로(iOS 기본 동작).
  const listRef = useRef<SectionList<Trip>>(null);
  useScrollToTop(listRef);

  if (tripsQuery.isLoading) {
    return (
      <View style={{ padding: 16 }}>
        <Skeleton style={{ height: 48, borderRadius: 12, marginBottom: 20 }} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  // 조회 실패를 빈 목록("아직 만든 여행이 없어요")으로 보여주지 않는다.
  if (tripsQuery.isError) {
    return (
      <QueryErrorView
        fullScreen
        message="여행 목록을 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
        onRetry={() => tripsQuery.refetch()}
      />
    );
  }

  const trips = tripsQuery.data ?? [];
  const sections = groupTripsByDate(trips, toDateString(new Date()));

  return (
    <SectionList
      ref={listRef}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      sections={sections}
      renderSectionHeader={({ section }) => (
        <AppText weight="medium" style={{ fontSize: 13, color: colors.inkMuted, marginTop: 8, marginBottom: 4 }}>
          {section.title}
        </AppText>
      )}
      renderSectionFooter={() => <View style={{ height: 16 }} />}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <PressableScale
          onPress={() => navigation.navigate("NewTrip")}
          style={{
            marginBottom: 20,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: colors.onAccent }}>
            새 여행 만들기
          </AppText>
        </PressableScale>
      }
      ListEmptyComponent={
        // 바로 위에 "새 여행 만들기" 버튼이 있으니 버튼을 또 두지 않고, 다른 경로(영상 기록)만 알려준다.
        <AppText style={{ textAlign: "center", marginTop: 32 }}>
          아직 만든 여행이 없어요.{"\n"}
          <AppText style={{ color: colors.inkMuted }}>영상 기록에서 영상 속 장소로 바로 여행을 만들 수도 있어요.</AppText>
        </AppText>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={entranceFor(item.id, index)}>
          <PressableRow
            onPress={() => navigation.navigate("TripDetail", { id: item.id })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.borderSubtle,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="medium" numberOfLines={1}>
                {item.title}
              </AppText>
              {item.startDate && (
                <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                  {formatTripDates(item.startDate, item.endDate)}
                </AppText>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </PressableRow>
        </Animated.View>
      )}
    />
  );
}
