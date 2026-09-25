import { useCallback, useRef, useState, type ComponentProps } from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppText, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { InlineMap } from "@/components/InlineMap";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { QueryErrorView } from "@/components/QueryErrorView";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { WeatherAlertBanner } from "@/components/WeatherAlertBanner";
import { createShare, deletePendingJob, getPendingJobs, getPlaces, resubmitFailedJob } from "@/lib/api/places";
import { listBookmarks } from "@/lib/api/bookmarks";
import { listTrips } from "@/lib/api/trips";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatTripDates } from "@/lib/date";
import { toUserMessage } from "@/lib/api/client";
import { colors } from "@/lib/theme";
import { isSupportedShareUrl, sourceVideoKey } from "@/lib/shareUrl";
import type { MainTabScreenProps } from "@/navigation/types";

type Props = MainTabScreenProps<"Home">;

// 영상 기록/내 여행/저장 장소는 이제 하단 탭에 항상 떠 있어서(MainTabs) 홈에 따로
// 버튼을 두지 않는다 — 웹 홈 대시보드(HomeDashboard.tsx)처럼 인사말 + 링크 입력 +
// 최근 활동(찜한 장소 지도, 최근 여행) 위주로 가볍게 구성한다.
//
// 디자인(2026-09): 이 화면의 유일한 "진짜 할 일"은 링크를 붙여넣는 것 — 인사말과
// 입력을 하나의 히어로로 묶고(인사말만 bold), 최근 여행/찜한 장소는 카드+그림자
// 없이 구분선만 있는 가벼운 리스트로 낮춰서 위계를 명확히 한다. 모든 블록에
// 같은 테두리+radius+그림자를 반복하던 걸 걷어냈다.
//
// 생동감(2026-09, 토스 스타일 파일럿 — 이 화면에만 우선 적용):
// - 누르는 요소는 PressableScale로 살짝 눌리는 피드백
// - "최근 여행" 행은 로드되면 순차적으로 스프링 등장(FadeInDown, staggered)
// - 로딩 중엔 섹션이 안 보이는 대신 스켈레톤으로 자리 표시
// - useReducedMotion으로 "동작 줄이기" 켜져 있으면 등장 애니메이션 생략
export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  const queryClient = useQueryClient();
  const refetchAll = useCallback(
    () => Promise.all([bookmarksQuery.refetch(), tripsQuery.refetch()]),
    [bookmarksQuery.refetch, tripsQuery.refetch]
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll);
  // 이미 보고 있는 탭을 다시 누르면 맨 위로(iOS 기본 동작).
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const pins = (bookmarksQuery.data ?? [])
    .filter((b) => b.latitude !== null && b.longitude !== null)
    .map((b) => ({ id: String(b.id), latitude: b.latitude as number, longitude: b.longitude as number }));
  const recentTrips = (tripsQuery.data ?? []).slice(0, 3);
  // 찜도 여행도 없는 처음 사용자는 "찜한 장소"·"최근 여행" 섹션이 모두 사라져 입력창만 남는다 —
  // 이 앱이 뭘 해주는지, 링크를 어디서 가져오는지 알려준다(둘 다 불러오기에 성공했을 때만).
  const isFirstVisit =
    bookmarksQuery.isSuccess && tripsQuery.isSuccess && bookmarksQuery.data.length === 0 && tripsQuery.data.length === 0;

  async function submitNewShare(sourceUrl: string) {
    setSubmitting(true);
    setError(null);
    try {
      const { jobId } = await createShare(sourceUrl);
      navigation.navigate("Processing", { jobId });
    } catch (err) {
      setError(toUserMessage(err, "요청에 실패했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed || submitting) return;
    if (!isSupportedShareUrl(trimmed)) {
      setError("인스타그램 또는 유튜브 링크만 넣을 수 있어요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 같은 영상을 다시 넣으면 새 작업이 또 만들어져 기록이 중복되던 문제 — 제출 전에 영상 ID로 비교한다
      // (쇼츠/watch/youtu.be처럼 주소 모양이 달라도 같은 영상이면 같은 키).
      const key = sourceVideoKey(trimmed);
      const [pendingJobs, places] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ["pendingJobs"], queryFn: getPendingJobs }),
        queryClient.fetchQuery({ queryKey: ["places"], queryFn: getPlaces }),
      ]);
      const sameJob = pendingJobs.find((job) => sourceVideoKey(job.sourceUrl) === key);
      const savedPlace = places.find((place) => sourceVideoKey(place.sourceUrl) === key);

      // 1) 아직 분석 중 → 새로 만들지 않고 그 진행 화면으로.
      if (sameJob && sameJob.status !== "FAILED") {
        navigation.navigate("Processing", { jobId: sameJob.jobId });
        return;
      }
      // 2) 이미 장소가 저장된 영상 → 보러 갈지, 그래도 새로 분석할지 묻는다.
      if (savedPlace) {
        Alert.alert("이미 저장한 영상이에요", "이 영상에서 뽑은 장소가 영상 기록에 있어요.", [
          { text: "취소", style: "cancel" },
          { text: "새로 분석", onPress: () => submitNewShare(trimmed) },
          { text: "보러 가기", onPress: () => navigation.navigate("VideoGroup", { jobId: savedPlace.jobId }) },
        ]);
        return;
      }
      // 3) 추출에 실패했던 영상 → 다시 시도로 처리해 이전 실패 기록을 정리한다. 같은 영상의 실패 기록이
      //    여러 개 쌓여 있으면(이 확인이 생기기 전 중복 제출분) 나머지도 함께 지운다.
      const failedSame = pendingJobs.filter((job) => job.status === "FAILED" && sourceVideoKey(job.sourceUrl) === key);
      if (failedSame.length > 0) {
        const { jobId } = await resubmitFailedJob(failedSame[0]);
        await Promise.allSettled(failedSame.slice(1).map((job) => deletePendingJob(job.jobId)));
        navigation.navigate("Processing", { jobId });
        return;
      }
      const { jobId } = await createShare(trimmed);
      navigation.navigate("Processing", { jobId });
    } catch (err) {
      setError(toUserMessage(err, "요청에 실패했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 24, gap: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ gap: 16 }}>
          <AppText weight="bold" style={{ fontSize: 26, lineHeight: 34 }}>
            {user?.nickname ?? "여행자"}님,{"\n"}어디로 떠나볼까요?
          </AppText>

          <View style={{ gap: 10 }}>
            <TextInput
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                if (error) setError(null);
              }}
              placeholder="인스타그램 또는 유튜브 링크"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              style={{
                height: 52,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingHorizontal: 18,
                fontFamily: "NotoSansKR_400Regular",
                color: colors.ink,
              }}
            />
            <PressableScale
              onPress={handleSubmit}
              disabled={!url.trim() || submitting}
              style={{
                height: 52,
                borderRadius: 14,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: !url.trim() || submitting ? 0.6 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: colors.onAccent, fontSize: 16 }}>
                {submitting ? "추출 중..." : "장소 추출하기"}
              </AppText>
            </PressableScale>
            {error && <ErrorText>{error}</ErrorText>}
          </View>
        </View>

        <WeatherAlertBanner
          onOpenAlternative={(tripId) => navigation.navigate("TripDetail", { id: tripId })}
        />

        {isFirstVisit && <FirstVisitGuide />}

        {bookmarksQuery.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton style={{ width: 100, height: 17 }} />
            <Skeleton style={{ width: "100%", height: 160, borderRadius: 12 }} />
          </View>
        ) : bookmarksQuery.isError ? (
          <QueryErrorView message="찜한 장소를 불러오지 못했어요." onRetry={() => bookmarksQuery.refetch()} />
        ) : (
          pins.length > 0 && (
            <View style={{ gap: 10 }}>
              <PressableScale
                onPress={() => navigation.navigate("SavedPlaces")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <AppText weight="medium">찜한 장소</AppText>
                <Feather name="chevron-right" size={18} color={colors.inkMuted} />
              </PressableScale>
              <InlineMap pins={pins} height={160} showPath={false} />
            </View>
          )
        )}

        {tripsQuery.isLoading ? (
          <View>
            <Skeleton style={{ width: 80, height: 17, marginBottom: 10 }} />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : tripsQuery.isError ? (
          <QueryErrorView message="최근 여행을 불러오지 못했어요." onRetry={() => tripsQuery.refetch()} />
        ) : (
          recentTrips.length > 0 && (
            <View>
              <AppText weight="medium" style={{ marginBottom: 10 }}>
                최근 여행
              </AppText>
              {recentTrips.map((trip, i) => (
                <Animated.View
                  key={trip.id}
                  entering={reducedMotion ? undefined : FadeInDown.delay(i * 60).springify().damping(16)}
                >
                  <PressableRow
                    onPress={() => navigation.navigate("TripDetail", { id: trip.id })}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText weight="medium" numberOfLines={1}>
                        {trip.title}
                      </AppText>
                      {trip.startDate && (
                        <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                          {formatTripDates(trip.startDate, trip.endDate)}
                        </AppText>
                      )}
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.inkMuted} />
                  </PressableRow>
                </Animated.View>
              ))}
            </View>
          )
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GUIDE_STEPS: { icon: ComponentProps<typeof Feather>["name"]; title: string; body: string }[] = [
  { icon: "copy", title: "링크 복사", body: "인스타 릴스·유튜브 쇼츠에서 공유 → 링크 복사" },
  { icon: "clipboard", title: "여기에 붙여넣기", body: "위 입력창에 붙여넣고 장소 추출하기" },
  { icon: "map-pin", title: "지도에 정리", body: "영상 속 장소를 찾아 지도와 일정으로 정리해드려요" },
];

function FirstVisitGuide() {
  return (
    <View style={{ gap: 14, padding: 18, borderRadius: 14, backgroundColor: colors.bgMuted }}>
      <AppText weight="medium">이렇게 시작해보세요</AppText>
      {GUIDE_STEPS.map((step, index) => (
        <View key={step.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.accentBg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name={step.icon} size={15} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="medium" style={{ fontSize: 14 }}>
              {index + 1}. {step.title}
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.inkMuted }}>{step.body}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
