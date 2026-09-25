import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { ProgressBar } from "@/components/ProgressBar";
import { QueryErrorView } from "@/components/QueryErrorView";
import { SkeletonRow } from "@/components/Skeleton";
import { useListEntrance } from "@/hooks/useListEntrance";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { haptics } from "@/lib/haptics";
import { describeSourceUrl } from "@/lib/shareUrl";
import { toUserMessage } from "@/lib/api/client";
import { colors } from "@/lib/theme";
import { deletePendingJob, getPendingJobs, getPlaces, resubmitFailedJob, type PendingJob, type Place } from "@/lib/api/places";
import type { MainTabScreenProps } from "@/navigation/types";

type Props = MainTabScreenProps<"PlacesList">;

const PLATFORM_LABEL: Record<Place["sourcePlatform"], string> = {
  INSTAGRAM: "인스타그램",
  YOUTUBE: "유튜브",
};

type VideoGroup = {
  jobId: number;
  title: string | null;
  sourceUrl: string;
  sourcePlatform: Place["sourcePlatform"];
  places: Place[];
};

// 장소 하나하나가 아니라 "영상 하나"를 목록의 기본 단위로 삼는다 — 영상 한 편에서
// 장소가 여러 곳 나오면 예전엔 그 개수만큼 똑같은 목적지(VideoGroup 화면)로 가는
// 행이 늘어섰다. getPlaces()가 최신순으로 내려주므로 Map 삽입 순서를 그대로 쓰면
// 영상별 그룹도 최신순을 유지한다.
function groupByVideo(places: Place[]): VideoGroup[] {
  const groups = new Map<number, VideoGroup>();
  for (const place of places) {
    const existing = groups.get(place.jobId);
    if (existing) {
      existing.places.push(place);
    } else {
      groups.set(place.jobId, {
        jobId: place.jobId,
        title: place.title,
        sourceUrl: place.sourceUrl,
        sourcePlatform: place.sourcePlatform,
        places: [place],
      });
    }
  }
  return Array.from(groups.values());
}

function placePreview(places: Place[]): string {
  const names = places.slice(0, 2).map((p) => p.placeName);
  const rest = places.length - names.length;
  return rest > 0 ? `${names.join(", ")} 외 ${rest}곳` : names.join(", ");
}

// 진행 중인 작업은 완료된 영상들과 시각적으로 구분되게(진행률 바가 있는
// 살아있는 상태라) 옅은 배경 블록으로 남겨두고, 완료된 목록만 구분선 리스트로
// 낮춘다(2026-09 디자인 — TripsListScreen과 동일한 원칙).
function PendingJobCard({
  job,
  onDelete,
  onRetry,
}: {
  job: PendingJob;
  onDelete: (jobId: number) => void;
  // 추출 단계 실패일 때만 넘어온다(일정 생성 실패는 링크 재제출 대상이 아님).
  onRetry?: (job: PendingJob) => void;
}) {
  const isFailed = job.status === "FAILED";
  // 백엔드가 진짜로 도달한 파이프라인 단계만 반영한다 — 아직 EXTRACTING도 시작 전(PENDING)이면
  // 지어낸 퍼센트 없이 0%로 둔다.
  const percent = isFailed ? 0 : job.progressPercent ?? 0;
  const message = isFailed ? "처리에 실패했어요" : job.stageMessage ?? "처리 대기 중이에요";

  return (
    <View style={{ padding: 16, borderRadius: 12, backgroundColor: colors.bgMuted }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 11, color: colors.inkMuted, marginBottom: 2 }}>
            {PLATFORM_LABEL[job.sourcePlatform]}
          </AppText>
          <AppText weight="medium" numberOfLines={1}>
            {job.title ?? describeSourceUrl(job.sourceUrl)}
          </AppText>
        </View>
        {isFailed && (
          <PressableScale
            onPress={() =>
              Alert.alert("이 항목을 삭제할까요?", "실패한 처리 기록을 목록에서 지웁니다.", [
                { text: "취소", style: "cancel" },
                { text: "삭제", style: "destructive", onPress: () => onDelete(job.jobId) },
              ])
            }
            hitSlop={10}
            style={{ paddingLeft: 8 }}
          >
            <Feather name="trash-2" size={16} color={colors.inkMuted} />
          </PressableScale>
        )}
      </View>
      <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: 12, color: isFailed ? colors.accent : colors.inkMuted }}>{message}</AppText>
        {isFailed && onRetry && (
          <PressableScale onPress={() => onRetry(job)} hitSlop={10}>
            <AppText weight="medium" style={{ fontSize: 12, color: colors.ink }}>
              다시 시도
            </AppText>
          </PressableScale>
        )}
      </View>
      {!isFailed && (
        <View style={{ marginTop: 10 }}>
          <ProgressBar percent={percent} />
        </View>
      )}
    </View>
  );
}

function VideoGroupCard({
  group,
  onPress,
  isFirst,
  entering,
}: {
  group: VideoGroup;
  onPress: () => void;
  isFirst: boolean;
  entering: ComponentProps<typeof Animated.View>["entering"];
}) {
  return (
    <Animated.View entering={entering}>
      <PressableRow
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 14,
          borderTopWidth: isFirst ? 0 : 1,
          borderTopColor: colors.borderSubtle,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontSize: 11, color: colors.inkMuted }}>{PLATFORM_LABEL[group.sourcePlatform]}</AppText>
          <AppText weight="medium" numberOfLines={1}>
            {group.title ?? describeSourceUrl(group.sourceUrl)}
          </AppText>
          <AppText mono style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
            {placePreview(group.places)}
          </AppText>
        </View>
        <Feather name="chevron-right" size={18} color={colors.inkMuted} />
      </PressableRow>
    </Animated.View>
  );
}

export function PlacesListScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const entranceFor = useListEntrance();
  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 5000 : false),
  });
  const refetchAll = useCallback(
    () => Promise.all([placesQuery.refetch(), pendingQuery.refetch()]),
    [placesQuery.refetch, pendingQuery.refetch]
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll);
  // 이미 보고 있는 탭을 다시 누르면 맨 위로(iOS 기본 동작).
  const listRef = useRef<FlatList<VideoGroup>>(null);
  useScrollToTop(listRef);

  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteJob(jobId: number) {
    if (deletingJobId !== null) return;
    haptics.warning();
    setDeletingJobId(jobId);
    setDeleteError(null);
    try {
      await deletePendingJob(jobId);
      await queryClient.invalidateQueries({ queryKey: ["pendingJobs"] });
    } catch {
      setDeleteError("삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      setDeletingJobId(null);
    }
  }

  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  async function handleRetryJob(job: PendingJob) {
    if (retryingJobId !== null) return;
    setRetryingJobId(job.jobId);
    setDeleteError(null);
    try {
      const { jobId: newJobId } = await resubmitFailedJob(job);
      await queryClient.invalidateQueries({ queryKey: ["pendingJobs"] });
      navigation.navigate("Processing", { jobId: newJobId });
    } catch (err) {
      setDeleteError(toUserMessage(err, "다시 시도하지 못했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      setRetryingJobId(null);
    }
  }

  const previousPendingCountRef = useRef<number | null>(null);
  useEffect(() => {
    const currentCount = pendingQuery.data?.length ?? 0;
    const previousCount = previousPendingCountRef.current;
    if (previousCount !== null && previousCount > 0 && currentCount === 0) {
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
    previousPendingCountRef.current = currentCount;
  }, [pendingQuery.data, queryClient]);

  if (placesQuery.isLoading || pendingQuery.isLoading) {
    return (
      <View style={{ padding: 16 }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  // 조회 실패를 "영상 없음"으로 보여주지 않는다.
  if (placesQuery.isError) {
    return (
      <QueryErrorView
        fullScreen
        message="영상 기록을 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
        onRetry={() => placesQuery.refetch()}
      />
    );
  }

  const places = placesQuery.data ?? [];
  const pendingJobs = pendingQuery.data ?? [];
  const videoGroups = groupByVideo(places);

  return (
    <FlatList
      ref={listRef}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      data={videoGroups}
      keyExtractor={(item) => String(item.jobId)}
      ListHeaderComponent={
        pendingJobs.length > 0 ? (
          <View style={{ gap: 12, marginBottom: 20 }}>
            {pendingJobs.map((job) => (
              <PendingJobCard
                key={job.jobId}
                job={job}
                onDelete={handleDeleteJob}
                onRetry={places.some((place) => place.jobId === job.jobId) ? undefined : handleRetryJob}
              />
            ))}
            {deleteError && <ErrorText>{deleteError}</ErrorText>}
          </View>
        ) : null
      }
      ListEmptyComponent={
        // 처리 중인 영상이 있으면 "링크 넣으러 가기"는 어색하다 — 곧 여기에 나타난다고만 안내.
        pendingJobs.length > 0 ? (
          <AppText style={{ textAlign: "center", marginTop: 16, color: colors.inkMuted }}>
            처리가 끝나면 영상이 여기에 표시돼요.
          </AppText>
        ) : (
          <View style={{ alignItems: "center", gap: 16, marginTop: 32 }}>
            <AppText style={{ textAlign: "center" }}>
              아직 저장한 영상이 없어요.{"\n"}
              <AppText style={{ color: colors.inkMuted }}>여행 영상 링크를 넣으면 장소를 뽑아 정리해드려요.</AppText>
            </AppText>
            <PressableScale
              onPress={() => navigation.navigate("Home")}
              style={{
                height: 44,
                paddingHorizontal: 20,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <AppText weight="medium" style={{ color: colors.accent, fontSize: 14 }}>
                링크 넣으러 가기
              </AppText>
            </PressableScale>
          </View>
        )
      }
      renderItem={({ item, index }) => (
        <VideoGroupCard
          group={item}
          isFirst={index === 0}
          entering={entranceFor(item.jobId, index)}
          onPress={() => navigation.navigate("VideoGroup", { jobId: item.jobId })}
        />
      )}
    />
  );
}
