import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { BackButton, useBackButtonClearance } from "@/components/BackButton";
import { Emoji } from "@/components/Emoji";
import { PressableScale } from "@/components/PressableScale";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Orb, type OrbState } from "@/components/Orb";
import { ProgressHero } from "@/components/ProgressHero";
import { QueryErrorView } from "@/components/QueryErrorView";
import { Skeleton } from "@/components/Skeleton";
import { describeSourceUrl, sourceKindLabel } from "@/lib/shareUrl";
import { cleanVideoTitle } from "@/lib/videoTitle";
import { toUserMessage } from "@/lib/api/client";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { getPendingJobs, getPlaces, resubmitFailedJob, type PendingJob } from "@/lib/api/places";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Processing">;

export type Stage = NonNullable<PendingJob["currentStage"]> | "PENDING";

// 백엔드 ProcessingStage.java와 동일한 고정 퍼센트 — 다음 스테이지 값만 절대
// 앞지르지 않게 캡을 잡는 용도로 쓴다.
const STAGE_MILESTONES = [0, 20, 50, 70, 90, 100];

// (2026-09 trova-backend 세션에서 실제 파이프라인 여러 번 실행해 스테이지별 소요시간을
// 실측함 — 예전엔 "측정된 적이 없어서 감으로 잡음"이었던 걸 그 데이터로 교체.
// EXTRACTING(다운로드+Gemini 추출, 파이썬 서브프로세스 한 번)이 압도적으로 오래
// 걸리고 변동도 큼(정상 12~40초, Gemini 불안정 시 그 이상) — 크리프를 짧게 잡으면
// 천장까지 다 채운 뒤 실제 데이터가 올 때까지 프로그레스바가 멈춘 것처럼 보임.
// GEOCODING은 카카오 API 호출 병렬화 이후 6개 장소 기준 139ms로 사실상 즉시 끝남
// (실측: 순차 576ms -> 병렬 139ms). SELECTING/VERIFYING은 후보가 모호할 때만
// 도는 조건부 Gemini 호출이라 스킵되는 경우가 많고, 돌더라도 수 초 내외.
const STAGE_CREEP_MS: Record<Stage, number> = {
  PENDING: 20000, // 곧 EXTRACTING으로 넘어가고, 그 구간이 제일 기니 미리 넉넉하게
  EXTRACTING: 20000, // 실측 중간값(12~40초) 근처로— 너무 일찍 멈춘 것처럼 안 보이게
  GEOCODING: 2000, // 실측 139ms — 크리프는 거의 항상 실제 값에 바로 덮어써짐
  SELECTING: 3000,
  VERIFYING: 3000,
  SAVING: 1000,
};

function nextCeiling(percent: number): number {
  const next = STAGE_MILESTONES.find((m) => m > percent) ?? 100;
  return next === 100 ? 100 : Math.min(next - 2, 99);
}

// 찾은 장소 이름을 보여주는 최소 시간. 이름을 하나씩 띄우는 연출(220ms 간격)이 끝나고 잠깐 머무를 만큼.
const MIN_FOUND_NAMES_MS = 2500;

const STAGE_TIP: Record<Stage, string> = {
  PENDING: "곧 분석을 시작해요",
  EXTRACTING: "영상 속 장소 이름을 찾고 있어요",
  GEOCODING: "정확한 위치 정보를 확인해요",
  SELECTING: "가장 알맞은 장소를 좁히고 있어요",
  VERIFYING: "정보가 맞는지 다시 확인해요",
  SAVING: "저장할 준비를 하고 있어요",
};

const STAGE_ANALYSIS: Record<Stage, { title: string; description: string }> = {
  PENDING: { title: "요청을 접수했어요", description: "잠시 후 AI 분석이 시작돼요." },
  EXTRACTING: {
    title: "장소 이름을 찾고 있어요",
    description: "영상과 자막을 분석해서 언급된 장소 이름을 추출하고 있어요.",
  },
  GEOCODING: {
    title: "위치를 확인하고 있어요",
    description: "추출한 장소 이름으로 정확한 위치 좌표를 찾고 있어요.",
  },
  SELECTING: {
    title: "후보를 좁히고 있어요",
    description: "여러 후보 장소 중 영상 내용과 가장 맞는 곳을 고르고 있어요.",
  },
  VERIFYING: {
    title: "정보를 확인하고 있어요",
    description: "선택된 장소 정보가 정확한지 한 번 더 확인하고 있어요.",
  },
  SAVING: {
    title: "저장하고 있어요",
    description: "확인이 끝난 장소를 저장하고 있어요.",
  },
};

export function ProcessingScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const topClearance = useBackButtonClearance();
  // 헤더를 끈 화면이라 하단 홈 인디케이터 영역도 직접 비워야 맨 아래 안내 문구가 겹치지 않는다.
  const bottomInset = useSafeAreaInsets().bottom;

  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: 2000,
  });

  const currentJob = pendingQuery.data?.find((item) => item.jobId === jobId);
  // 완료 직후 결과 화면으로 넘어가기 전 잠깐 기다리는 동안, 목록에서 사라진 작업의 마지막 모습을 계속 보여준다.
  const [lastSeenJob, setLastSeenJob] = useState<PendingJob | null>(null);
  useEffect(() => {
    if (currentJob) setLastSeenJob(currentJob);
  }, [currentJob]);
  const job = currentJob;
  const namesShownAtRef = useRef<number | null>(null);
  // 한 번 받은 찾은 이름은 이 작업이 끝날 때까지 기억한다. 서버는 완료 직후 이름을 지우는데, 상태(DB)와 이름(메모리)을
  // 따로 읽어서 완료 직전 한 번의 조회에 "처리 중인데 이름 0곳"이 섞여 올 수 있다(로컬 서버 실측).
  const [foundNames, setFoundNames] = useState<string[]>([]);
  useEffect(() => {
    const names = currentJob?.foundPlaceNames ?? [];
    if (names.length === 0) return;
    setFoundNames(names);
    if (namesShownAtRef.current === null) namesShownAtRef.current = Date.now();
  }, [currentJob?.foundPlaceNames]);
  // 실패한 작업에 이미 저장된 장소가 있으면 "일정 생성" 단계 실패다 — 그땐 링크 재제출이 맞지 않아
  // 다시 시도를 보여주지 않는다. 장소 조회가 끝나기 전엔 판단을 미룬다.
  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces, enabled: job?.status === "FAILED" });
  const canRetry = placesQuery.isSuccess && !placesQuery.data.some((place) => place.jobId === jobId);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function handleRetry() {
    if (!job || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const { jobId: newJobId } = await resubmitFailedJob(job);
      navigation.replace("Processing", { jobId: newJobId });
    } catch (err) {
      setRetryError(toUserMessage(err, "다시 시도하지 못했어요. 잠시 후 다시 시도해주세요."));
      setRetrying(false);
    }
  }

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("MainTabs");
    }
  }

  useEffect(() => {
    // FAILED 작업도 /api/places/pending 목록에 남아있으므로, 목록에서 사라졌다는
    // 것은 처리가 끝나 저장까지 완료됐다는 뜻이다. 완료 후에는 항상 이 영상의
    // 그룹 화면으로 이동한다 — 최초 추출과 일정 생성 재요청 둘 다 같은 화면을
    // 거치므로 분기 없이 이 한 줄이면 충분하다.
    // 단, 캐시에 남아있던 예전 목록(이 작업이 만들어지기 전 데이터)으로 판단하면 방금 만든
    // 작업도 "없음 = 완료"로 오인해 바로 넘어가 버린다 — 이 화면에서 새로 받아온 목록으로만 판단한다.
    // 다시 시도 중엔 이전 실패 기록을 지우므로 그 사이의 "없음"도 무시한다.
    if (pendingQuery.isSuccess && pendingQuery.isFetchedAfterMount && !job && !retrying) {
      // 찾은 장소 이름은 분석이 거의 끝날 때 도착해서(실측: 끝나기 1~3초 전), 바로 넘어가면 번쩍하고 사라진다.
      // 이름이 보인 지 최소 시간이 안 됐으면 남은 만큼 기다렸다 넘어간다.
      const shownAt = namesShownAtRef.current;
      const wait = shownAt === null ? 0 : Math.max(0, MIN_FOUND_NAMES_MS - (Date.now() - shownAt));
      const id = setTimeout(() => navigation.replace("VideoGroup", { jobId, justAnalyzed: true }), wait);
      return () => clearTimeout(id);
    }
  }, [pendingQuery.isSuccess, pendingQuery.isFetchedAfterMount, job, jobId, navigation, retrying]);

  // 폴링이 계속 실패하면 로딩 스켈레톤에 영원히 멈춰 보인다 — 재시도 수단을 준다.
  if (pendingQuery.isError) {
    return (
      <View style={{ flex: 1 }}>
        <BackButton onPress={handleBack} />
        <QueryErrorView
          fullScreen
          message="처리 상태를 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
          onRetry={() => pendingQuery.refetch()}
        />
      </View>
    );
  }

  const holdingJob = !job && namesShownAtRef.current !== null && lastSeenJob?.status !== "FAILED" ? lastSeenJob : null;
  if (holdingJob) {
    return (
      <View style={{ flex: 1, padding: space.xl, paddingTop: topClearance, paddingBottom: Math.max(24, bottomInset + 8) }}>
        <BackButton onPress={handleBack} />
        <ProcessingProgressView
          stage="SAVING"
          percent={holdingJob.progressPercent ?? 90}
          message="거의 다 됐어요"
          title={holdingJob.title}
          sourceUrl={holdingJob.sourceUrl}
          foundPlaceNames={foundNames}
        />
      </View>
    );
  }

  if (pendingQuery.isLoading || !job) {
    return (
      <View style={{ flex: 1, padding: space.xl, gap: space.md, justifyContent: "center" }}>
        <BackButton onPress={handleBack} />
        <Skeleton style={{ width: "50%", height: 22, alignSelf: "center" }} />
        <Skeleton style={{ width: "80%", height: 14, alignSelf: "center" }} />
        <Skeleton style={{ height: 10, borderRadius: radius.full, marginTop: space.xs }} />
      </View>
    );
  }

  if (job.status === "FAILED") {
    const noPlaces = job.failureReason === "NO_PLACES";
    const aiQuota = job.failureReason === "AI_QUOTA";
    const sourceBlocked = job.failureReason === "SOURCE_RATE_LIMITED";
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: space.xl, gap: space.md }}>
        <BackButton onPress={handleBack} />
        <Feather name={noPlaces ? "map-pin" : aiQuota || sourceBlocked ? "clock" : "alert-circle"} size={48} color={colors.accent} />
        <AppText weight="medium" style={{ fontSize: fontSize.title3 }}>
          {noPlaces
            ? "장소를 찾지 못했어요"
            : aiQuota
              ? "오늘 AI 분석 한도를 다 썼어요"
              : sourceBlocked
                ? "인스타그램이 잠시 요청을 막았어요"
                : "처리에 실패했어요"}
        </AppText>
        <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>
          {job.title ?? describeSourceUrl(job.sourceUrl)}
        </AppText>
        {noPlaces && (
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, textAlign: "center", lineHeight: 19 }}>
            영상에서 장소 이름이 나오지 않았거나 알아보기 어려웠어요.{"\n"}장소를 소개하는 다른 영상을 넣어보세요.
          </AppText>
        )}
        {aiQuota && (
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, textAlign: "center", lineHeight: 19 }}>
            매일 오후 4~5시쯤 한도가 다시 채워져요.{"\n"}그 뒤에 이 영상을 다시 넣어주세요.
          </AppText>
        )}
        {sourceBlocked && (
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, textAlign: "center", lineHeight: 19 }}>
            요청이 몰려서 잠시 막힌 거예요.{"\n"}조금 뒤에 이 릴스를 다시 넣어주세요.
          </AppText>
        )}
        {/* 장소를 못 찾은 영상은 다시 해도 결과가 같고, AI 한도·인스타 제한은 풀리기 전엔 다시 해도 실패해서 홈으로 안내한다. */}
        {canRetry && !noPlaces && !aiQuota && !sourceBlocked ? (
          <>
            <PressableScale
              onPress={handleRetry}
              disabled={retrying}
              style={{
                marginTop: space.sm,
                height: 48,
                paddingHorizontal: space.xl,
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: retrying ? 0.6 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: colors.onAccent }}>
                {retrying ? "다시 요청하는 중..." : "다시 시도"}
              </AppText>
            </PressableScale>
            <PressableScale onPress={() => navigation.replace("MainTabs")} hitSlop={10} disabled={retrying}>
              <AppText style={{ color: colors.inkMuted }}>홈으로 돌아가기</AppText>
            </PressableScale>
            {retryError && <ErrorText>{retryError}</ErrorText>}
          </>
        ) : (
          <PressableScale
            onPress={() => navigation.replace("MainTabs")}
            style={{
              marginTop: space.sm,
              height: 48,
              paddingHorizontal: space.xl,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <AppText weight="medium" style={{ color: colors.onAccent }}>
              홈으로 돌아가기
            </AppText>
          </PressableScale>
        )}
      </View>
    );
  }

  const stage: Stage = job.currentStage ?? "PENDING";
  return (
    <View style={{ flex: 1, padding: space.xl, paddingTop: topClearance, paddingBottom: Math.max(24, bottomInset + 8) }}>
      <BackButton onPress={handleBack} />
      <ProcessingProgressView
        stage={stage}
        percent={job.progressPercent ?? 0}
        message={job.stageMessage}
        title={job.title}
        sourceUrl={job.sourceUrl}
        foundPlaceNames={foundNames}
      />
    </View>
  );
}

// 분석 단계 → 오브 상태. 장소 이름을 찾는 긴 구간은 "생각", 위치·후보를 좁히는 구간은 바깥으로 물결이 퍼지는 "탐색".
const STAGE_ORB: Record<Stage, OrbState> = {
  PENDING: "waiting",
  EXTRACTING: "thinking",
  GEOCODING: "searching",
  SELECTING: "searching",
  VERIFYING: "searching",
  SAVING: "settling",
};

export function ProcessingProgressView({
  stage,
  percent,
  message,
  title,
  sourceUrl,
  foundPlaceNames = [],
}: {
  stage: Stage;
  percent: number;
  message?: string | null;
  title?: string | null;
  sourceUrl?: string;
  foundPlaceNames?: string[];
}) {
  const analysis = STAGE_ANALYSIS[stage];
  // 무엇을 보고 있는지 보여준다 — 다듬은 제목, 쓸 수 없으면 "유튜브 쇼츠" 같은 영상 종류.
  // 제목을 아직 모르거나 못 가져왔으면 단계 팁을 그대로 보여준다.
  const videoLabel = title ? cleanVideoTitle(title) ?? (sourceUrl ? sourceKindLabel(sourceUrl) : null) : null;
  const found = foundPlaceNames.length > 0;
  return (
    <>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: space.sm }}>
        <Orb state={found ? "arrived" : STAGE_ORB[stage]} size={140} />
        <ProgressHero percent={percent} ceiling={nextCeiling(percent)} creepMs={STAGE_CREEP_MS[stage]} showCards={false} />
        <AppText weight="medium" style={{ fontSize: fontSize.title3, textAlign: "center" }}>
          {message ?? analysis.title}
        </AppText>
        {found ? (
          <FoundPlaceChips names={foundPlaceNames} />
        ) : videoLabel ? (
          <View style={{ alignItems: "center", gap: space.xxxs, paddingHorizontal: space.sm }}>
            <AppText weight="medium" numberOfLines={2} style={{ fontSize: fontSize.subheadline, color: colors.ink, textAlign: "center" }}>
              {videoLabel}
            </AppText>
            <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>영상을 보고 있어요</AppText>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.xs,
              paddingVertical: space.xs,
              paddingHorizontal: space.md,
              borderRadius: radius.full,
              backgroundColor: colors.bgMuted,
            }}
          >
            <Emoji symbol="💡" size={14} />
            <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{STAGE_TIP[stage]}</AppText>
          </View>
        )}
      </View>

      <View
        style={{
          padding: space.lg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgMuted,
          gap: space.xs,
        }}
      >
        <AppText mono style={{ fontSize: fontSize.caption2, color: colors.inkMuted, letterSpacing: 1 }}>AI ANALYSIS</AppText>
        <AppText weight="medium" style={{ fontSize: fontSize.subheadline }}>
          {analysis.title}
        </AppText>
        <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, lineHeight: 19 }}>{analysis.description}</AppText>
      </View>

      {/* 처리는 서버에서 비동기로 도는데, 안내가 없으면 12~40초(실측) 동안 이 화면을 지켜봐야 한다고 느끼기 쉽다. */}
      <AppText style={{ marginTop: space.md, fontSize: fontSize.caption1, lineHeight: 18, color: colors.inkMuted, textAlign: "center" }}>
        다른 화면으로 가도 분석은 계속돼요.{"\n"}결과는 영상 기록 탭에서 확인할 수 있어요.
      </AppText>
    </>
  );
}

// 찾은 장소 이름이 하나씩 차례로 떠오른다. "동작 줄이기"가 켜져 있으면 Reanimated가 등장 애니메이션을 생략한다.
function FoundPlaceChips({ names }: { names: string[] }) {
  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingHorizontal: space.xs }}>
      <AppText weight="medium" style={{ fontSize: fontSize.subheadline, color: colors.accent }}>
        {names.length}곳을 찾았어요
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.xs }}>
        {names.map((name, index) => (
          <Animated.View
            key={name + index}
            entering={FadeInDown.delay(index * 220).duration(420)}
            style={{ paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.lg, backgroundColor: colors.accentBg }}
          >
            <AppText style={{ fontSize: fontSize.footnote, color: colors.ink }}>{name}</AppText>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
