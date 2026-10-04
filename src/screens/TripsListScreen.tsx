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
import { StaleNotice } from "@/components/StaleNotice";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { useListEntrance } from "@/hooks/useListEntrance";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { listTrips, type Trip } from "@/lib/api/trips";
import { formatTripDates, toDateString } from "@/lib/date";
import { groupTripsByDate } from "@/lib/tripSections";
import { colors, fontSize, radius, space } from "@/lib/theme";
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
      <View style={{ padding: space.md }}>
        <Skeleton style={{ height: 48, borderRadius: radius.md, marginBottom: space.lg }} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  // 조회 실패를 빈 목록("아직 만든 여행이 없어요")으로 보여주지 않는다.
  // 받아 둔 목록이 있으면 오류 화면 대신 목록 위에 한 줄만 알린다(디자인 QA E1).
  if (tripsQuery.isError && !tripsQuery.data) {
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
      contentContainerStyle={{ padding: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      sections={sections}
      renderSectionHeader={({ section }) => (
        <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.inkMuted, marginTop: space.xs, marginBottom: space.xxs }}>
          {section.title}
        </AppText>
      )}
      renderSectionFooter={() => <View style={{ height: 16 }} />}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={{ marginBottom: space.lg, gap: space.xs }}>
        {tripsQuery.isError && <StaleNotice onRetry={() => tripsQuery.refetch()} />}
        <PressableScale
          onPress={() => navigation.navigate("PlanTrip")}
          style={{
            height: 48,
            borderRadius: radius.md,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: colors.onAccent }}>
            영상으로 일정 짜기
          </AppText>
        </PressableScale>
        {/* 빈 여행을 직접 만드는 길은 남겨두되, 영상으로 짜는 쪽을 주 버튼으로 둔다(#106). */}
        <PressableScale
          onPress={() => navigation.navigate("NewTrip")}
          style={{
            height: 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium">빈 여행 만들기</AppText>
        </PressableScale>
        </View>
      }
      ListEmptyComponent={
        // 바로 위에 "새 여행 만들기" 버튼이 있으니 버튼을 또 두지 않고, 다른 경로(영상 기록)만 알려준다.
        <AppText style={{ textAlign: "center", marginTop: space.xxl }}>
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
              paddingVertical: space.md,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.borderSubtle,
            }}
          >
            <View style={{ flex: 1, gap: space.xxxs }}>
              <AppText weight="medium" numberOfLines={1}>
                {item.title}
              </AppText>
              {item.startDate && (
                <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                  {formatTripDates(item.startDate, item.endDate)}
                </AppText>
              )}
              {/* 이름이 같은 여행을 구분할 수 없었다(사용자 관점 QA, #123) — 지역과 장소 수를 함께 보여준다. */}
              {item.placeCount !== undefined && (
                <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
                  {item.placeCount === 0
                    ? "아직 담은 장소가 없어요"
                    : [item.regions?.join("·"), `${item.placeCount}곳`].filter(Boolean).join(" · ")}
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
