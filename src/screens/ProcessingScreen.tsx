import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { ProgressBar } from "@/components/ProgressBar";
import { colors } from "@/lib/theme";
import { getPendingJobs, type PendingJob } from "@/lib/api/places";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Processing">;

type Stage = NonNullable<PendingJob["currentStage"]> | "PENDING";

const STAGE_ICON: Record<Stage, string> = {
  PENDING: "⏳",
  EXTRACTING: "🎬",
  GEOCODING: "📍",
  SELECTING: "🔍",
  VERIFYING: "✅",
  SAVING: "💾",
};

const STAGE_TIP: Record<Stage, string> = {
  PENDING: "💡 곧 분석을 시작해요",
  EXTRACTING: "💡 영상 속 장소 이름을 찾고 있어요",
  GEOCODING: "💡 정확한 위치 정보를 확인해요",
  SELECTING: "💡 가장 알맞은 장소를 좁히고 있어요",
  VERIFYING: "💡 정보가 맞는지 다시 확인해요",
  SAVING: "💡 저장할 준비를 하고 있어요",
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

  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: 2000,
  });

  const job = pendingQuery.data?.find((item) => item.jobId === jobId);

  useEffect(() => {
    // FAILED 작업도 /api/places/pending 목록에 남아있으므로, 목록에서 사라졌다는
    // 것은 처리가 끝나 저장까지 완료됐다는 뜻이다. 완료 후에는 항상 이 영상의
    // 그룹 화면으로 이동한다 — 최초 추출과 일정 생성 재요청 둘 다 같은 화면을
    // 거치므로 분기 없이 이 한 줄이면 충분하다.
    if (pendingQuery.isSuccess && !job) {
      navigation.replace("VideoGroup", { jobId });
    }
  }, [pendingQuery.isSuccess, job, jobId, navigation]);

  if (pendingQuery.isLoading || !job) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  if (job.status === "FAILED") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}>
        <AppText style={{ fontSize: 48 }}>😵</AppText>
        <AppText weight="medium" style={{ fontSize: 20 }}>
          처리에 실패했어요
        </AppText>
        <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>
          {job.title ?? job.sourceUrl}
        </AppText>
        <Pressable
          onPress={() => navigation.replace("Home")}
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
          <AppText weight="medium" style={{ color: "#fff" }}>
            홈으로 돌아가기
          </AppText>
        </Pressable>
      </View>
    );
  }

  const stage: Stage = job.currentStage ?? "PENDING";
  const percent = job.progressPercent ?? 0;
  const message = job.stageMessage ?? STAGE_ANALYSIS[stage].title;
  const analysis = STAGE_ANALYSIS[stage];

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 72, backgroundColor: colors.bg }}>
      <View style={{ gap: 8 }}>
        <ProgressBar percent={percent} height={8} />
        <AppText mono weight="medium" style={{ color: colors.accent, textAlign: "right" }}>
          {percent}%
        </AppText>
      </View>

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.accentBg,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText style={{ fontSize: 52 }}>{STAGE_ICON[stage]}</AppText>
        </View>
        <AppText weight="medium" style={{ fontSize: 20, textAlign: "center" }}>
          {message}
        </AppText>
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: colors.bgMuted,
          }}
        >
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
