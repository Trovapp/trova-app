import { useEffect, useRef } from "react";
import { FlatList, Platform, Pressable, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { ProgressBar } from "@/components/ProgressBar";
import { colors } from "@/lib/theme";
import { getPendingJobs, getPlaces, type PendingJob, type Place } from "@/lib/api/places";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PlacesList">;

const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  android: { elevation: 2 },
});

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

function PendingJobCard({ job }: { job: PendingJob }) {
  const isFailed = job.status === "FAILED";
  // 백엔드가 진짜로 도달한 파이프라인 단계만 반영한다 — 아직 EXTRACTING도 시작 전(PENDING)이면
  // 지어낸 퍼센트 없이 0%로 둔다.
  const percent = isFailed ? 0 : job.progressPercent ?? 0;
  const message = isFailed ? "처리에 실패했어요" : job.stageMessage ?? "처리 대기 중이에요";

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        ...CARD_SHADOW,
      }}
    >
      <AppText style={{ fontSize: 11, color: colors.inkMuted, marginBottom: 2 }}>
        {PLATFORM_LABEL[job.sourcePlatform]}
      </AppText>
      <AppText weight="medium" numberOfLines={1}>
        {job.title ?? job.sourceUrl}
      </AppText>
      <AppText style={{ marginTop: 4, fontSize: 12, color: isFailed ? colors.accent : colors.inkMuted }}>
        {message}
      </AppText>
      {!isFailed && (
        <View style={{ marginTop: 10 }}>
          <ProgressBar percent={percent} />
        </View>
      )}
    </View>
  );
}

function VideoGroupCard({ group, onPress }: { group: VideoGroup; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        ...CARD_SHADOW,
      }}
    >
      <AppText style={{ fontSize: 11, color: colors.inkMuted, marginBottom: 2 }}>
        {PLATFORM_LABEL[group.sourcePlatform]}
      </AppText>
      <AppText weight="medium" numberOfLines={1}>
        {group.title ?? group.sourceUrl}
      </AppText>
      <AppText mono style={{ marginTop: 4, fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
        {placePreview(group.places)}
      </AppText>
    </Pressable>
  );
}

export function PlacesListScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 5000 : false),
  });

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  const places = placesQuery.data ?? [];
  const pendingJobs = pendingQuery.data ?? [];
  const videoGroups = groupByVideo(places);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={videoGroups}
      keyExtractor={(item) => String(item.jobId)}
      ListHeaderComponent={
        pendingJobs.length > 0 ? (
          <View style={{ gap: 12, marginBottom: 12 }}>
            {pendingJobs.map((job) => (
              <PendingJobCard key={job.jobId} job={job} />
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={<AppText style={{ textAlign: "center", marginTop: 32 }}>아직 저장한 영상이 없어요.</AppText>}
      renderItem={({ item }) => (
        <VideoGroupCard group={item} onPress={() => navigation.navigate("VideoGroup", { jobId: item.jobId })} />
      )}
    />
  );
}
