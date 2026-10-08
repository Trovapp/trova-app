import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppText, FONT, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { InlineMap } from "@/components/InlineMap";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { QueryErrorView } from "@/components/QueryErrorView";
import { StaleNotice } from "@/components/StaleNotice";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { WeatherAlertBanner } from "@/components/WeatherAlertBanner";
import { createShare, deletePendingJob, getPendingJobs, getPlaces, resubmitFailedJob, type PendingJob } from "@/lib/api/places";
import { listBookmarks } from "@/lib/api/bookmarks";
import { listTrips } from "@/lib/api/trips";
import { dismissTripDraft, listAutoDrafts } from "@/lib/api/tripDrafts";
import { ReadyDraftCard } from "@/components/ReadyDraftCard";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatSavedAgo, formatTripDates, toDateString } from "@/lib/date";
import { cleanVideoTitle } from "@/lib/videoTitle";
import { groupTripsByDate } from "@/lib/tripSections";
import { toUserMessage } from "@/lib/api/client";
import { colors, fontSize, radius, space, motion } from "@/lib/theme";
import { extractFirstUrl, isSupportedShareUrl, sourceVideoKey, UNSUPPORTED_SHARE_URL_MESSAGE } from "@/lib/shareUrl";
import { PasteButton } from "@/lib/clipboard";
import { takePendingShare, usePendingShare } from "@/lib/pendingShare";
import type { MainTabScreenProps } from "@/navigation/types";

type Props = MainTabScreenProps<"Home">;

// 붙여넣기 버튼 기본 크기(입력칸 높이와 같음)와 큰 글자에서 키울 수 있는 최대 크기.
const PASTE_BUTTON_SIZE = 52;
const PASTE_BUTTON_MAX = 80;

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
  const [urlFocused, setUrlFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 화면 상태(submitting)는 다음 렌더에야 바뀌어서, 그 사이 빠른 두 번 누르기나 키보드 "이동" 키와 버튼이 함께 눌리면
  // 제출이 두 번 나갔다(#97, 서버도 같은 영상 동시 제출을 막지만 쓸데없는 요청 자체를 줄인다). ref는 즉시 바뀐다.
  const submittingRef = useRef(false);
  function beginSubmit(): boolean {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    return true;
  }
  function endSubmit() {
    submittingRef.current = false;
    setSubmitting(false);
  }
  const [error, setError] = useState<string | null>(null);
  // 다른 앱에서 Trova로 공유한 링크 — 공유 자체가 "분석해 달라"는 뜻이라 입력창에 채우고 바로 시작한다
  // (이미 분석한 영상이면 지금처럼 보러 갈지 묻는다).
  const pendingShare = usePendingShare();
  useEffect(() => {
    if (!pendingShare) return;
    const shared = takePendingShare();
    if (!shared) return;
    setUrl(shared);
    setError(null);
    handleSubmit(shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShare]);
  const reducedMotion = useReducedMotion();
  // iOS 기본 붙여넣기 버튼(UIPasteControl)은 아이콘을 글자 크기에 맞춰 키우는데, 버튼이 52로 고정이면 접근성 큰 글자에서
  // 아이콘이 들어가지 않아 빈 하늘색 사각형으로 보였다(디자인 QA 2026-10-07, 시뮬레이터에서 단계별 확인).
  const { fontScale } = useWindowDimensions();
  const pasteButtonSize = Math.max(PASTE_BUTTON_SIZE, Math.min(PASTE_BUTTON_MAX, Math.round(fontScale * 26)));

  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  // 영상 분석이 끝나면 서버가 알아서 일정 초안을 만들어 둔다 — 아직 짜는 중(PENDING/PROCESSING)인 게 있으면
  // 5초마다 다시 물어서 "준비됐어요"로 바뀌는 걸 바로 보여준다. 다 준비됐으면(모두 READY) 조용히 멈춘다.
  const autoDraftsQuery = useQuery({
    queryKey: ["autoDrafts"],
    queryFn: listAutoDrafts,
    refetchInterval: (query) => (query.state.data?.some((d) => d.status !== "READY") ? 5000 : false),
  });
  // 쌓인 영상으로 가는 길이 탭 이동뿐이었고, 분석 실패는 영상 기록 탭에서만 보였다(페르소나 QA 2026-10-08) —
  // 홈에 최근 저장한 영상과 실패 안내를 둔다. 둘 다 영상 기록 탭과 같은 캐시를 쓴다.
  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const pendingQuery = useQuery({ queryKey: ["pendingJobs"], queryFn: getPendingJobs });
  const queryClient = useQueryClient();
  const refetchAll = useCallback(
    () => Promise.all([bookmarksQuery.refetch(), tripsQuery.refetch(), autoDraftsQuery.refetch(), placesQuery.refetch(), pendingQuery.refetch()]),
    [bookmarksQuery.refetch, tripsQuery.refetch, autoDraftsQuery.refetch, placesQuery.refetch, pendingQuery.refetch]
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll);
  const [draftDismissError, setDraftDismissError] = useState<string | null>(null);

  async function dismissDraft(draftId: number) {
    setDraftDismissError(null);
    try {
      await dismissTripDraft(draftId);
      await autoDraftsQuery.refetch();
    } catch (err) {
      setDraftDismissError(toUserMessage(err, "닫지 못했어요. 다시 시도해주세요."));
      // 이미 없어졌거나(404) 이미 승인된(409) 초안이면 실패해도 목록은 다시 받아와야 한다 —
      // 안 그러면 더 이상 아무것도 할 수 없는 카드가 화면에 계속 남는다(폴링이 이미 멈춰 있을 수도 있음).
      await autoDraftsQuery.refetch();
    }
  }
  // 이미 보고 있는 탭을 다시 누르면 맨 위로(iOS 기본 동작).
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const pins = (bookmarksQuery.data ?? [])
    .filter((b) => b.latitude !== null && b.longitude !== null)
    .map((b) => ({ id: String(b.id), latitude: b.latitude as number, longitude: b.longitude as number }));
  // 백엔드 목록은 만든 순서라, 내 여행 탭과 같은 기준으로 나눠서 다가오는 여행이 있으면 그걸(가까운 순),
  // 없으면 지난 여행(최근 날짜순)을 보여준다. 두 종류를 한 제목 아래 섞지 않는다.
  const tripSections = groupTripsByDate(tripsQuery.data ?? [], toDateString(new Date()));
  const homeTripSection = tripSections.find((s) => s.title === "다가오는 여행") ?? tripSections.find((s) => s.title === "지난 여행");
  const recentTrips = (homeTripSection?.data ?? []).slice(0, 3);
  const failedJobs = (pendingQuery.data ?? []).filter((job) => job.status === "FAILED");
  const recentVideos = (() => {
    const seen = new Map<number, { jobId: number; title: string; createdAt: string; count: number }>();
    for (const place of placesQuery.data ?? []) {
      const v = seen.get(place.jobId);
      if (v) v.count += 1;
      else seen.set(place.jobId, { jobId: place.jobId, title: cleanVideoTitle(place.title) ?? place.title ?? "제목 없음", createdAt: place.createdAt, count: 1 });
    }
    return Array.from(seen.values());
  })();
  const recentTripsTitle = homeTripSection?.title === "다가오는 여행" ? "다가오는 여행" : "최근 여행";
  // 찜도 여행도 없는 처음 사용자는 "찜한 장소"·"최근 여행" 섹션이 모두 사라져 입력창만 남는다 —
  // 이 앱이 뭘 해주는지, 링크를 어디서 가져오는지 알려준다(둘 다 불러오기에 성공했을 때만).
  const isFirstVisit =
    bookmarksQuery.isSuccess && tripsQuery.isSuccess && bookmarksQuery.data.length === 0 && tripsQuery.data.length === 0;

  // 같은 영상의 실패 기록을 다시 시도로 처리하고, 여러 개 쌓여 있으면 나머지는 지운다.
  async function retryFailedJobs(failedSame: PendingJob[]) {
    const { jobId } = await resubmitFailedJob(failedSame[0]);
    await Promise.allSettled(failedSame.slice(1).map((job) => deletePendingJob(job.jobId)));
    setUrl("");
    navigation.navigate("Processing", { jobId });
  }

  // 서버가 이미 분석한 영상이라고 알려주면(앱의 확인이 놓친 경우) 분석 화면을 거치지 않고 결과로 바로 간다.
  function openShareResult(jobId: number, alreadyAnalyzed?: boolean) {
    // 제출한 링크가 홈 입력칸에 그대로 남아 다음 링크를 넣을 때 지워야 했다(디자인 QA 2026-10-07).
    setUrl("");
    if (alreadyAnalyzed) {
      navigation.navigate("VideoGroup", { jobId });
      return;
    }
    navigation.navigate("Processing", { jobId });
  }

  // 확인창에서 "다시 분석"을 눌렀을 때 — 제출 흐름(handleSubmit)이 이미 끝난 뒤라 진행 상태를 따로 관리한다.
  async function retryFailedShare(failedSame: PendingJob[]) {
    if (!beginSubmit()) return;
    try {
      await retryFailedJobs(failedSame);
    } catch (err) {
      setError(toUserMessage(err, "요청에 실패했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      endSubmit();
    }
  }

  // reanalyze: "이미 저장한 영상이에요"에서 "새로 분석"을 고른 경우. 서버는 이 표시가 없으면 이미 있는 결과를 돌려준다.
  async function submitNewShare(sourceUrl: string, reanalyze = false) {
    if (!beginSubmit()) return;
    try {
      const { jobId, alreadyAnalyzed } = await createShare(sourceUrl, { reanalyze });
      openShareResult(jobId, alreadyAnalyzed);
    } catch (err) {
      setError(toUserMessage(err, "요청에 실패했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      endSubmit();
    }
  }

  async function handleSubmit(value?: string) {
    const trimmed = (value ?? url).trim();
    if (!trimmed || submittingRef.current) return;
    if (!isSupportedShareUrl(trimmed)) {
      setError(UNSUPPORTED_SHARE_URL_MESSAGE);
      return;
    }
    if (!beginSubmit()) return;
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
        setUrl("");
        navigation.navigate("Processing", { jobId: sameJob.jobId });
        return;
      }
      // 2) 이미 장소가 저장된 영상 → 보러 갈지, 그래도 새로 분석할지 묻는다.
      if (savedPlace) {
        Alert.alert("이미 저장한 영상이에요", "이 영상에서 뽑은 장소가 영상 기록에 있어요.", [
          { text: "취소", style: "cancel" },
          { text: "새로 분석", onPress: () => submitNewShare(trimmed, true) },
          { text: "보러 가기", onPress: () => navigation.navigate("VideoGroup", { jobId: savedPlace.jobId }) },
        ]);
        return;
      }
      // 3) 추출에 실패했던 영상 → 다시 시도로 처리해 이전 실패 기록을 정리한다. 같은 영상의 실패 기록이
      //    여러 개 쌓여 있으면(이 확인이 생기기 전 중복 제출분) 나머지도 함께 지운다.
      const failedSame = pendingJobs.filter((job) => job.status === "FAILED" && sourceVideoKey(job.sourceUrl) === key);
      if (failedSame.length > 0) {
        // 장소를 못 찾았던 영상은 다시 분석해도 결과가 같을 가능성이 높다 — 조용히 다시 돌리지 말고 먼저 묻는다.
        if (failedSame.some((job) => job.failureReason === "NO_PLACES")) {
          Alert.alert("이전에 장소를 찾지 못한 영상이에요", "다시 분석해도 장소를 찾지 못할 수 있어요.", [
            { text: "취소", style: "cancel" },
            { text: "다시 분석", onPress: () => retryFailedShare(failedSame) },
          ]);
          return;
        }
        await retryFailedJobs(failedSame);
        return;
      }
      const { jobId, alreadyAnalyzed } = await createShare(trimmed);
      openShareResult(jobId, alreadyAnalyzed);
    } catch (err) {
      setError(toUserMessage(err, "요청에 실패했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      endSubmit();
    }
  }

  const weatherBanner = (
    <WeatherAlertBanner
      onOpenAlternative={(tripId, tripPlaceId) =>
        navigation.navigate("TripDetail", { id: tripId, weatherAlertTripPlaceId: tripPlaceId })
      }
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: space.xl, gap: space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ gap: space.md }}>
          <AppText weight="bold" style={{ fontSize: fontSize.title1, lineHeight: 36 }}>
            {user?.nickname ?? "여행자"}님,{"\n"}어디로 떠나볼까요?
          </AppText>

          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <TextInput
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                // 눌러도 테두리가 그대로라 입력 중인지 알기 어려웠다(2026-10 QA) — 입력 중엔 강조색 테두리.
                onFocus={() => setUrlFocused(true)}
                onBlur={() => setUrlFocused(false)}
                selectionColor={colors.accent}
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
                onSubmitEditing={() => handleSubmit()}
                style={{
                  height: 52,
                  borderWidth: 1,
                  borderColor: urlFocused ? colors.accent : colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: space.lg,
                  fontFamily: FONT.regular,
                  color: colors.ink,
                  flex: 1,
                }}
              />
              {/* 복사한 링크를 길게 눌러 붙여넣지 않아도 되게 — iOS 기본 붙여넣기 버튼이라 "허용" 확인창이 뜨지 않는다. */}
              {PasteButton && (
                <PasteButton
                  acceptedContentTypes={["plain-text", "url"]}
                  displayMode="iconOnly"
                  cornerStyle="medium"
                  backgroundColor={colors.accentBg}
                  foregroundColor={colors.accent}
                  style={{ width: pasteButtonSize, height: pasteButtonSize }}
                  onPress={(data) => {
                    if (data.type !== "text") return;
                    const pasted = extractFirstUrl(data.text);
                    setUrl(pasted);
                    setError(isSupportedShareUrl(pasted) ? null : UNSUPPORTED_SHARE_URL_MESSAGE);
                  }}
                />
              )}
            </View>
            <PressableScale
              onPress={() => handleSubmit()}
              disabled={!url.trim() || submitting}
              style={{
                height: 52,
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: !url.trim() || submitting ? 0.6 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: colors.onAccent, fontSize: fontSize.callout }}>
                {submitting ? "추출 중..." : "장소 추출하기"}
              </AppText>
            </PressableScale>
            {error && <ErrorText>{error}</ErrorText>}
          </View>
        </View>

        {/* 자동 초안 카드와 날씨 배너는 둘 다 "알려줄 게 있어요" 성격의 배너라 한 묶음으로 본다 — 섹션
            자체의 gap(sm)과 ScrollView의 블록 사이 gap(xxl)이 겹쳐 둘 사이만 유독 넓어 보였다(QA 발견).
            자동 초안이 있을 때만 날씨 배너를 이 묶음 안으로 넣어 같은 sm 간격을 쓰게 한다. */}
        {(autoDraftsQuery.data ?? []).length > 0 ? (
          <View style={{ gap: space.sm }}>
            {(autoDraftsQuery.data ?? []).map((draft) => (
              <ReadyDraftCard
                key={draft.draftId}
                draft={draft}
                onPress={() => navigation.navigate("PlanTrip", { draftId: draft.draftId })}
                onDismiss={() => dismissDraft(draft.draftId)}
              />
            ))}
            {draftDismissError && <ErrorText>{draftDismissError}</ErrorText>}
            {weatherBanner}
          </View>
        ) : (
          weatherBanner
        )}

        {failedJobs.length > 0 && (
          <PressableScale
            onPress={() => navigation.navigate("PlacesList")}
            accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.bgMuted }}
          >
            <Feather name="alert-circle" size={18} color={colors.accent} />
            <View style={{ flex: 1, gap: space.xxxs }}>
              <AppText weight="medium" style={{ fontSize: fontSize.footnote }}>
                분석하지 못한 영상이 {failedJobs.length}개 있어요
              </AppText>
              <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
                {cleanVideoTitle(failedJobs[0].title) ?? failedJobs[0].title ?? "영상"} — 이유와 다음 방법 보기
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </PressableScale>
        )}

        {isFirstVisit && <FirstVisitGuide />}

        {/* 받아 둔 찜·여행이 있는데 다시 불러오기만 실패했으면 화면은 그대로 두고 한 줄만 알린다(디자인 QA E1). */}
        {((bookmarksQuery.isError && bookmarksQuery.data) || (tripsQuery.isError && tripsQuery.data)) && (
          <StaleNotice
            onRetry={() => {
              bookmarksQuery.refetch();
              tripsQuery.refetch();
            }}
          />
        )}

        {bookmarksQuery.isLoading ? (
          <View style={{ gap: space.sm }}>
            <Skeleton style={{ width: 68, height: 68 }} />
            <Skeleton style={{ width: "100%", height: 160, borderRadius: radius.md }} />
          </View>
        ) : bookmarksQuery.isError && !bookmarksQuery.data ? (
          <QueryErrorView message="찜한 장소를 불러오지 못했어요." onRetry={() => bookmarksQuery.refetch()} />
        ) : (
          pins.length > 0 && (
            <View style={{ gap: space.sm }}>
              <PressableScale
                onPress={() => navigation.navigate("SavedPlaces")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <AppText weight="medium">찜한 장소</AppText>
                <Feather name="chevron-right" size={18} color={colors.inkMuted} />
              </PressableScale>
              {/* 찜한 장소 미리보기 — 순서가 없어 찜한 장소 탭 전체 보기처럼 번호 대신 색 점(2026-10 QA) */}
              <InlineMap pins={pins} height={160} showPath={false} numbered={false} />
            </View>
          )
        )}

        {recentVideos.length > 0 && (
          <View>
            <PressableScale
              onPress={() => navigation.navigate("PlacesList")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs }}
            >
              <AppText weight="medium">최근 저장한 영상 {recentVideos.length}개</AppText>
              <Feather name="chevron-right" size={18} color={colors.inkMuted} />
            </PressableScale>
            {recentVideos.slice(0, 2).map((video, i) => (
              <PressableRow
                key={video.jobId}
                onPress={() => navigation.navigate("VideoGroup", { jobId: video.jobId })}
                style={{ paddingVertical: space.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSubtle, gap: space.xxxs }}
              >
                <AppText numberOfLines={1}>{video.title}</AppText>
                <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                  {formatSavedAgo(video.createdAt)} · 장소 {video.count}곳
                </AppText>
              </PressableRow>
            ))}
          </View>
        )}

        {tripsQuery.isLoading ? (
          <View>
            <Skeleton style={{ width: 80, height: 17, marginBottom: space.sm }} />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : tripsQuery.isError && !tripsQuery.data ? (
          <QueryErrorView message="최근 여행을 불러오지 못했어요." onRetry={() => tripsQuery.refetch()} />
        ) : (
          recentTrips.length > 0 && (
            <View>
              <AppText weight="medium" style={{ marginBottom: space.sm }}>
                {recentTripsTitle}
              </AppText>
              {recentTrips.map((trip, i) => (
                <Animated.View
                  key={trip.id}
                  entering={reducedMotion ? undefined : FadeInDown.delay(i * motion.listStagger).springify().damping(16)}
                >
                  <PressableRow
                    onPress={() => navigation.navigate("TripDetail", { id: trip.id })}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: space.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
                    <View style={{ flex: 1, gap: space.xxxs }}>
                      <AppText weight="medium" numberOfLines={1}>
                        {trip.title}
                      </AppText>
                      {trip.startDate && (
                        <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
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
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.bgMuted }}>
      <AppText weight="medium">이렇게 시작해보세요</AppText>
      {GUIDE_STEPS.map((step, index) => (
        <View key={step.title} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.full,
              backgroundColor: colors.accentBg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name={step.icon} size={15} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: space.xxxs }}>
            <AppText weight="medium" style={{ fontSize: fontSize.subheadline }}>
              {index + 1}. {step.title}
            </AppText>
            <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{step.body}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
