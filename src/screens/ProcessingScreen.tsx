import { useEffect, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { BackButton, useBackButtonClearance } from "@/components/BackButton";
import { Emoji } from "@/components/Emoji";
import { PressableScale } from "@/components/PressableScale";
import { ProgressHero } from "@/components/ProgressHero";
import { QueryErrorView } from "@/components/QueryErrorView";
import { Skeleton } from "@/components/Skeleton";
import { describeSourceUrl } from "@/lib/shareUrl";
import { colors } from "@/lib/theme";
import { getPendingJobs, getPlaces, resubmitFailedJob, type PendingJob } from "@/lib/api/places";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Processing">;

type Stage = NonNullable<PendingJob["currentStage"]> | "PENDING";

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

  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: 2000,
  });

  const job = pendingQuery.data?.find((item) => item.jobId === jobId);
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
      setRetryError(err instanceof Error ? err.message : "다시 시도하지 못했어요.");
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
      navigation.replace("VideoGroup", { jobId });
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

  if (pendingQuery.isLoading || !job) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <BackButton onPress={handleBack} />
        <Skeleton style={{ width: "50%", height: 22, alignSelf: "center" }} />
        <Skeleton style={{ width: "80%", height: 14, alignSelf: "center" }} />
        <Skeleton style={{ height: 10, borderRadius: 5, marginTop: 8 }} />
      </View>
    );
  }

  if (job.status === "FAILED") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}>
        <BackButton onPress={handleBack} />
        <Feather name="alert-circle" size={48} color={colors.accent} />
        <AppText weight="medium" style={{ fontSize: 20 }}>
          처리에 실패했어요
        </AppText>
        <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>
          {job.title ?? describeSourceUrl(job.sourceUrl)}
        </AppText>
        {canRetry ? (
          <>
            <PressableScale
              onPress={handleRetry}
              disabled={retrying}
              style={{
                marginTop: 12,
                height: 48,
                paddingHorizontal: 24,
                borderRadius: 12,
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
              marginTop: 12,
              height: 48,
              paddingHorizontal: 24,
              borderRadius: 12,
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
  const percent = job.progressPercent ?? 0;
  const message = job.stageMessage ?? STAGE_ANALYSIS[stage].title;
  const analysis = STAGE_ANALYSIS[stage];

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: topClearance, backgroundColor: colors.bg }}>
      <BackButton onPress={handleBack} />
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20 }}>
        <ProgressHero percent={percent} ceiling={nextCeiling(percent)} creepMs={STAGE_CREEP_MS[stage]} />
        <AppText weight="medium" style={{ fontSize: 20, textAlign: "center" }}>
          {message}
        </AppText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: colors.bgMuted,
          }}
        >
          <Emoji symbol="💡" size={14} />
          <AppText style={{ fontSize: 13, color: colors.inkMuted }}>{STAGE_TIP[stage]}</AppText>
        </View>
      </View>

      <View
        style={{
          padding: 20,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgMuted,
          gap: 6,
        }}
      >
        <AppText mono style={{ fontSize: 11, color: colors.inkMuted, letterSpacing: 1 }}>AI ANALYSIS</AppText>
        <AppText weight="medium" style={{ fontSize: 15 }}>
          {analysis.title}
        </AppText>
        <AppText style={{ fontSize: 13, color: colors.inkMuted, lineHeight: 19 }}>{analysis.description}</AppText>
      </View>
    </View>
  );
}
