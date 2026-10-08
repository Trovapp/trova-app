import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Alert, FlatList, RefreshControl, TextInput, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { AppText, FONT, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { ProgressBar } from "@/components/ProgressBar";
import { QueryErrorView } from "@/components/QueryErrorView";
import { StaleNotice } from "@/components/StaleNotice";
import { SkeletonRow } from "@/components/Skeleton";
import { PLATFORM_LABEL, VideoThumb } from "@/components/VideoThumb";
import { useListEntrance } from "@/hooks/useListEntrance";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { haptics } from "@/lib/haptics";
import { describeSourceUrl } from "@/lib/shareUrl";
import { toUserMessage } from "@/lib/api/client";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { deletePendingJob, getPendingJobs, getPlaces, resubmitFailedJob, type PendingJob, type Place } from "@/lib/api/places";
import type { MainTabScreenProps } from "@/navigation/types";
import { hitSlopFor } from "@/lib/touch";
import { cleanVideoTitle } from "@/lib/videoTitle";
import { formatSavedAgo } from "@/lib/date";

type Props = MainTabScreenProps<"PlacesList">;


type VideoGroup = {
  jobId: number;
  title: string | null;
  sourceUrl: string;
  sourcePlatform: Place["sourcePlatform"];
  createdAt: string;
  places: Place[];
};

// 영상이 쌓이면 원하는 영상을 찾기 어려웠다(페르소나 QA 2026-10-08, "저장만 쌓아 두는 사람") — 이만큼 넘으면 검색창을 보인다.
const SEARCH_MIN_VIDEOS = 6;

function matchesQuery(group: VideoGroup, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [group.title ?? "", ...group.places.map((p) => `${p.placeName} ${p.region ?? ""} ${p.address ?? ""}`)].join(" ").toLowerCase();
  return text.includes(q);
}

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
        createdAt: place.createdAt,
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
  onAddOther,
}: {
  job: PendingJob;
  onDelete: (jobId: number) => void;
  // 추출 단계 실패일 때만 넘어온다(일정 생성 실패는 링크 재제출 대상이 아님).
  onRetry?: (job: PendingJob) => void;
  onAddOther?: () => void;
}) {
  const isFailed = job.status === "FAILED";
  // 백엔드가 진짜로 도달한 파이프라인 단계만 반영한다 — 아직 EXTRACTING도 시작 전(PENDING)이면
  // 지어낸 퍼센트 없이 0%로 둔다.
  const percent = isFailed ? 0 : job.progressPercent ?? 0;
  const noPlaces = isFailed && job.failureReason === "NO_PLACES";
  const aiQuota = isFailed && job.failureReason === "AI_QUOTA";
  const sourceBlocked = isFailed && job.failureReason === "SOURCE_RATE_LIMITED";
  const message = noPlaces
    ? "장소를 찾지 못했어요"
    : aiQuota
      ? "AI 분석 한도 초과, 오후 4~5시 이후 다시 시도"
      : sourceBlocked
        ? "인스타그램이 잠시 막음, 조금 뒤 다시 시도"
        : isFailed
        ? "처리에 실패했어요"
        : job.stageMessage ?? "처리 대기 중이에요";

  return (
    <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.bgMuted }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted, marginBottom: space.xxxs }}>
            {PLATFORM_LABEL[job.sourcePlatform]}
          </AppText>
          <AppText weight="medium" numberOfLines={1}>
            {cleanVideoTitle(job.title) ?? job.title ?? describeSourceUrl(job.sourceUrl)}
          </AppText>
        </View>
        {isFailed && (
          <PressableScale
            onPress={() =>
              Alert.alert("이 항목을 삭제할까요?", "실패한 처리 기록을 목록에서 지워요.", [
                { text: "취소", style: "cancel" },
                { text: "삭제", style: "destructive", onPress: () => { haptics.warning(); onDelete(job.jobId); } },
              ])
            }
            hitSlop={hitSlopFor(24, 16)}
            style={{ paddingLeft: space.xs }}
          >
            <Feather name="trash-2" size={16} color={colors.inkMuted} />
          </PressableScale>
        )}
      </View>
      <View style={{ marginTop: space.xxs, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: fontSize.caption1, color: isFailed ? colors.accent : colors.inkMuted }}>{message}</AppText>
        {isFailed && !noPlaces && onRetry && (
          <PressableScale onPress={() => onRetry(job)} hitSlop={10}>
            <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.ink }}>
              다시 시도
            </AppText>
          </PressableScale>
        )}
      </View>
      {/* 장소를 못 찾았다는 말만 있고 이유도 다음 행동도 없었다(페르소나 QA "분석 실패를 겪은 사람"). 같은 영상은 다시 해도
          결과가 같을 때가 많아 "다른 영상 넣기"를 먼저, 그래도 해 보고 싶으면 확인 후 다시 분석. */}
      {noPlaces && (
        <View style={{ marginTop: space.xs, gap: space.xs }}>
          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
            장소 이름이 화면·자막·설명에 나오지 않는 영상이면 찾기 어려워요. 장소를 소개하는 다른 영상을 넣어 보세요.
          </AppText>
          <View style={{ flexDirection: "row", gap: space.md }}>
            {onAddOther && (
              <PressableScale onPress={onAddOther} hitSlop={10}>
                <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.accent }}>다른 영상 넣기</AppText>
              </PressableScale>
            )}
            {onRetry && (
              <PressableScale
                onPress={() =>
                  Alert.alert("다시 분석할까요?", "같은 영상은 다시 해도 장소를 찾지 못할 수 있어요.", [
                    { text: "취소", style: "cancel" },
                    { text: "다시 분석", onPress: () => onRetry(job) },
                  ])
                }
                hitSlop={10}
              >
                <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.ink }}>다시 분석</AppText>
              </PressableScale>
            )}
          </View>
        </View>
      )}
      {!isFailed && (
        <View style={{ marginTop: space.sm }}>
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
          gap: space.md,
          paddingVertical: space.md,
          borderTopWidth: isFirst ? 0 : 1,
          borderTopColor: colors.borderSubtle,
        }}
      >
        <VideoThumb sourceUrl={group.sourceUrl} platform={group.sourcePlatform} />
        <View style={{ flex: 1, gap: space.xxxs }}>
          <AppText weight="medium" numberOfLines={1}>
            {cleanVideoTitle(group.title) ?? group.title ?? describeSourceUrl(group.sourceUrl)}
          </AppText>
          {/* 한글 미리보기에 mono 글꼴을 쓰면 한글이 대체 글꼴로 그려져 자간이 벌어졌다(2026-10-04 QA). */}
          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
            {/* 언제 저장했는지 먼저 — 비슷한 제목의 영상이 쌓이면 날짜로 구분한다(페르소나 QA). */}
            {[formatSavedAgo(group.createdAt), placePreview(group.places)].filter(Boolean).join(" · ")}
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
  const [query, setQuery] = useState("");

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
      <View style={{ padding: space.md }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  // 조회 실패를 "영상 없음"으로 보여주지 않는다.
  // 받아 둔 목록이 있으면 오류 화면 대신 목록 위에 한 줄만 알린다(디자인 QA E1).
  if (placesQuery.isError && !placesQuery.data) {
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
  const allGroups = groupByVideo(places);
  const videoGroups = allGroups.filter((group) => matchesQuery(group, query));

  return (
    <FlatList
      ref={listRef}
      contentContainerStyle={{ padding: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      data={videoGroups}
      keyExtractor={(item) => String(item.jobId)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        placesQuery.isError || pendingJobs.length > 0 || allGroups.length >= SEARCH_MIN_VIDEOS ? (
          <View style={{ gap: space.sm, marginBottom: space.lg }}>
            {allGroups.length >= SEARCH_MIN_VIDEOS && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 40, paddingHorizontal: space.sm, borderRadius: radius.md, backgroundColor: colors.bgMuted }}>
                <Feather name="search" size={16} color={colors.inkMuted} />
                <TextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="영상 제목·장소·지역으로 찾기"
                  placeholderTextColor={colors.inkMuted}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  selectionColor={colors.accent}
                  style={{ flex: 1, paddingVertical: space.xs, fontFamily: FONT.regular, color: colors.ink }}
                />
              </View>
            )}
            {placesQuery.isError && <StaleNotice onRetry={() => placesQuery.refetch()} />}
            {pendingJobs.map((job) => (
              <PendingJobCard
                key={job.jobId}
                job={job}
                onDelete={handleDeleteJob}
                onRetry={places.some((place) => place.jobId === job.jobId) ? undefined : handleRetryJob}
                onAddOther={() => navigation.navigate("Home")}
              />
            ))}
            {deleteError && <ErrorText>{deleteError}</ErrorText>}
          </View>
        ) : null
      }
      ListEmptyComponent={
        // 처리 중인 영상이 있으면 "링크 넣으러 가기"는 어색하다 — 곧 여기에 나타난다고만 안내.
        allGroups.length > 0 ? (
          <AppText style={{ textAlign: "center", marginTop: space.md, color: colors.inkMuted }}>
            "{query.trim()}"에 맞는 영상이 없어요.
          </AppText>
        ) : pendingJobs.length > 0 ? (
          <AppText style={{ textAlign: "center", marginTop: space.md, color: colors.inkMuted }}>
            처리가 끝나면 영상이 여기에 표시돼요.
          </AppText>
        ) : (
          <View style={{ alignItems: "center", gap: space.md, marginTop: space.xxl }}>
            <AppText style={{ textAlign: "center" }}>
              아직 저장한 영상이 없어요.{"\n"}
              <AppText style={{ color: colors.inkMuted }}>여행 영상 링크를 넣으면 장소를 뽑아 정리해드려요.</AppText>
            </AppText>
            <PressableScale
              onPress={() => navigation.navigate("Home")}
              style={{
                height: 44,
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <AppText weight="medium" style={{ color: colors.accent, fontSize: fontSize.subheadline }}>
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
