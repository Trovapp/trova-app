import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { BackButton } from "@/components/BackButton";
import { Emoji } from "@/components/Emoji";
import { ProgressHero } from "@/components/ProgressHero";
import { QueryErrorView } from "@/components/QueryErrorView";
import { RatingBadge } from "@/components/RatingBadge";
import { RecommendationReason } from "@/components/RecommendationReason";
import { Skeleton } from "@/components/Skeleton";
import { haptics } from "@/lib/haptics";
import { colors } from "@/lib/theme";
import { getTrip, getTripReplanJob, optimizeTripRoute, replacePlace, type TripReplanResult } from "@/lib/api/trips";
import { categoryLabel } from "@/lib/placeCategory";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TripReplan">;

type CardStatus = "confirming" | "confirmed" | "skipped";

export function TripReplanScreen({ route, navigation }: Props) {
  const { tripId, jobId } = route.params;
  const queryClient = useQueryClient();

  const [cardStatus, setCardStatus] = useState<Record<number, CardStatus>>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const replanQuery = useQuery({
    queryKey: ["tripReplanJob", tripId, jobId],
    queryFn: () => getTripReplanJob(tripId, jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "DONE" || status === "FAILED" ? false : 2000;
    },
  });

  // 대안을 못 찾은 장소는 id만 내려오므로, 이름을 보여주려면 여행 상세를 한 번 더
  // 조회해 매칭해야 한다 — 결과 화면에서만 필요한 보조 조회라 재구성 진행 자체를
  // 막지 않도록 완료(DONE) 상태일 때만 활성화한다.
  const job = replanQuery.data;
  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTrip(tripId),
    enabled: job?.status === "DONE",
  });
  const nameByTripPlaceId = new Map(
    (tripQuery.data?.days ?? []).flatMap((d) => d.places).map((p) => [p.id, p.placeName])
  );

  // 확정한 교체가 하나라도 있으면, 그 장소가 속한 날짜만 골라 동선을 자동으로
  // 다시 정리한다(이미 있는 RouteOptimizer 기반 엔드포인트 재사용). 실패해도
  // 화면 이동 자체는 막지 않는다 — 동선 재배치는 있으면 좋은 정리일 뿐, 교체
  // 자체는 이미 확정됐으므로.
  async function goBackToTrip() {
    const confirmedIds = Object.entries(cardStatus)
      .filter(([, status]) => status === "confirmed")
      .map(([id]) => Number(id));
    if (confirmedIds.length > 0 && tripQuery.data) {
      const affectedDays = new Set<number>();
      for (const day of tripQuery.data.days) {
        if (day.places.some((p) => confirmedIds.includes(p.id))) {
          affectedDays.add(day.day);
        }
      }
      await Promise.allSettled([...affectedDays].map((day) => optimizeTripRoute(tripId, day)));
    }
    // 이 화면은 여행 상세에서 push되므로 replace하면 스택에 여행 상세가 두 개 쌓여
    // 뒤로가기 시 같은 화면이 또 나온다. 기존 여행 상세로 되돌아가고(없으면 새로 추가),
    // 그 화면은 마운트된 채라 동선이 바뀐 여행 데이터를 여기서 다시 불러오게 한다.
    await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    navigation.popTo("TripDetail", { id: tripId });
  }

  async function handleConfirm(tripPlaceId: number, googlePlaceId: string) {
    setCardStatus((s) => ({ ...s, [tripPlaceId]: "confirming" }));
    setConfirmError(null);
    try {
      await replacePlace(tripPlaceId, googlePlaceId);
      await queryClient.invalidateQueries({ queryKey: ["trip"] });
      await queryClient.invalidateQueries({ queryKey: ["gapRecommendations"] });
      setCardStatus((s) => ({ ...s, [tripPlaceId]: "confirmed" }));
    } catch {
      setCardStatus((s) => {
        const next = { ...s };
        delete next[tripPlaceId];
        return next;
      });
      setConfirmError("교체하지 못했어요. 다시 시도해주세요.");
    }
  }

  function handleSkip(tripPlaceId: number) {
    setCardStatus((s) => ({ ...s, [tripPlaceId]: "skipped" }));
  }

  // 재구성은 폴링으로 진행되는 백그라운드 작업이라, 완료 알림은 사용자의 탭이 아니라
  // 상태가 PENDING/PROCESSING → DONE으로 바뀌는 순간에 붙는다 — 그 전환을 한 번만
  // 잡아내려고 이전 상태를 ref로 들고 비교한다.
  const previousStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const status = replanQuery.data?.status;
    if (status && previousStatusRef.current && previousStatusRef.current !== "DONE" && status === "DONE") {
      haptics.success();
    }
    if (status) previousStatusRef.current = status;
  }, [replanQuery.data?.status]);

  // 폴링이 계속 실패하면 로딩 스켈레톤에 영원히 멈춰 보인다 — 재시도 수단을 준다.
  if (replanQuery.isError) {
    return (
      <View style={{ flex: 1 }}>
        <BackButton onPress={goBackToTrip} />
        <QueryErrorView
          fullScreen
          message="재구성 상태를 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
          onRetry={() => replanQuery.refetch()}
        />
      </View>
    );
  }

  if (replanQuery.isLoading || !job) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <BackButton onPress={goBackToTrip} />
        <Skeleton style={{ width: "50%", height: 22, alignSelf: "center" }} />
        <Skeleton style={{ width: "80%", height: 14, alignSelf: "center" }} />
        <Skeleton style={{ height: 10, borderRadius: 5, marginTop: 8 }} />
      </View>
    );
  }

  if (job.status === "FAILED") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}>
        <BackButton onPress={goBackToTrip} />
        <Feather name="alert-circle" size={48} color={colors.accent} />
        <AppText weight="medium" style={{ fontSize: 20 }}>
          재구성에 실패했어요
        </AppText>
        {job.errorMessage && (
          <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>{job.errorMessage}</AppText>
        )}
        <PressableScale
          onPress={goBackToTrip}
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
            여행으로 돌아가기
          </AppText>
        </PressableScale>
      </View>
    );
  }

  if (job.status === "PENDING" || job.status === "PROCESSING") {
    const total = job.totalTargets;
    const percent = total === null ? 0 : total === 0 ? 100 : Math.round((job.completedTargets / total) * 100);
    // 타겟(장소) 하나 처리에 실측 평균 7.6초가 걸린다(docs/benchmarks/2026-09-16-trip-replan-latency.md,
    // 6타겟 44.36초/47.14초 실측 평균 45.75초÷6) — 그동안 백엔드가 다음 값을 확정할 때까지
    // 이 시간만큼 천천히 차오르게 하고, 다음 타겟 완료 시점(실제 값)은 절대 앞지르지 않는다.
    const AVG_TARGET_MS = 7600;
    const nextTargetPercent =
      total === null ? 15 : total === 0 ? 100 : Math.round(((job.completedTargets + 1) / total) * 100);
    const ceiling = Math.min(nextTargetPercent - 2, 99);
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: 72, backgroundColor: colors.bg }}>
        <BackButton onPress={goBackToTrip} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20 }}>
          <ProgressHero percent={percent} ceiling={ceiling} creepMs={AVG_TARGET_MS} />
          {total !== null && (
            <AppText mono weight="medium" style={{ color: colors.inkMuted }}>
              {job.completedTargets} / {total}
            </AppText>
          )}
          <AppText weight="medium" style={{ fontSize: 20, textAlign: "center" }}>
            {total === null ? "여행 속 장소들을 살펴보고 있어요" : "취향에 맞는 대안을 찾고 있어요"}
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
            <AppText style={{ fontSize: 13, color: colors.inkMuted }}>여행 전체를 확인하는 중이라 조금 걸릴 수 있어요</AppText>
          </View>
        </View>
      </View>
    );
  }

  // 여기부터는 job.status === "DONE"
  const result: TripReplanResult = job.result ?? { replaced: [], failedTripPlaceIds: [] };
  const isEmpty = result.replaced.length === 0 && result.failedTripPlaceIds.length === 0;

  if (isEmpty) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}>
        <BackButton onPress={goBackToTrip} />
        <Feather name="check-circle" size={48} color={colors.accent} />
        <AppText weight="medium" style={{ fontSize: 18, textAlign: "center" }}>
          추천할 만한 다른 장소를 찾지 못했어요
        </AppText>
        <PressableScale
          onPress={goBackToTrip}
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
            여행으로 돌아가기
          </AppText>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackButton onPress={goBackToTrip} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 64, gap: 16 }}>
        <AppText weight="medium" style={{ fontSize: 18 }}>
          새로운 추천을 찾았어요
        </AppText>
        <AppText style={{ fontSize: 13, color: colors.inkMuted }}>
          장소마다 확인하고 교체하거나 건너뛸 수 있어요. 확정하면 동선도 자동으로 다시 정리돼요.
        </AppText>

        {confirmError && <AppText style={{ color: colors.accent }}>{confirmError}</AppText>}

        {result.replaced.map(({ tripPlaceId, originalName, candidate }) => {
          const status = cardStatus[tripPlaceId];
          return (
            <View
              key={tripPlaceId}
              style={{
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
                opacity: status === "skipped" ? 0.5 : 1,
              }}
            >
              <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                {originalName} →
              </AppText>
              <AppText weight="medium" numberOfLines={1}>
                {candidate.name}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                {candidate.rating !== null && <RatingBadge rating={candidate.rating} />}
                <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                  {[
                    categoryLabel(candidate.category),
                    candidate.distanceToNextKm !== null ? `다음 장소까지 ${candidate.distanceToNextKm.toFixed(1)}km` : null,
                    candidate.estimatedTravelMinutes !== null ? `약 ${candidate.estimatedTravelMinutes}분` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              </View>
              {candidate.recommendationReason && <RecommendationReason text={candidate.recommendationReason} />}

              {status === "confirmed" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="check" size={14} color={colors.accent} />
                  <AppText style={{ fontSize: 13, color: colors.accent }}>교체 완료</AppText>
                </View>
              ) : status === "skipped" ? (
                <AppText style={{ fontSize: 13, color: colors.inkMuted }}>건너뜀</AppText>
              ) : (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <PressableScale
                    onPress={() => handleSkip(tripPlaceId)}
                    disabled={status === "confirming"}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <AppText style={{ fontSize: 13, color: colors.inkMuted }}>건너뛰기</AppText>
                  </PressableScale>
                  <PressableScale
                    onPress={() => handleConfirm(tripPlaceId, candidate.googlePlaceId)}
                    disabled={status === "confirming"}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: colors.accent,
                      justifyContent: "center",
                      alignItems: "center",
                      opacity: status === "confirming" ? 0.6 : 1,
                    }}
                  >
                    <AppText weight="medium" style={{ fontSize: 13, color: colors.onAccent }}>
                      {status === "confirming" ? "교체 중..." : "교체"}
                    </AppText>
                  </PressableScale>
                </View>
              )}
            </View>
          );
        })}

        {result.failedTripPlaceIds.length > 0 && (
          <View style={{ gap: 6, padding: 14, borderRadius: 12, backgroundColor: colors.bgMuted }}>
            <AppText weight="medium" style={{ fontSize: 13 }}>
              대안을 찾지 못한 장소
            </AppText>
            {result.failedTripPlaceIds.map((id) => (
              <AppText key={id} style={{ fontSize: 13, color: colors.inkMuted }}>
                {nameByTripPlaceId.get(id) ?? "이름을 불러오는 중..."}
              </AppText>
            ))}
          </View>
        )}

        <PressableScale
          onPress={goBackToTrip}
          style={{
            marginTop: 8,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: colors.onAccent }}>
            여행으로 돌아가기
          </AppText>
        </PressableScale>
      </ScrollView>
    </View>
  );
}
