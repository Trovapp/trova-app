import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { ProgressBar } from "@/components/ProgressBar";
import { colors } from "@/lib/theme";
import { getTrip, getTripReplanJob, replacePlace, type TripReplanResult } from "@/lib/api/trips";
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

  function goBackToTrip() {
    navigation.replace("TripDetail", { id: tripId });
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

  if (replanQuery.isLoading || !job) {
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
          재구성에 실패했어요
        </AppText>
        {job.errorMessage && (
          <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>{job.errorMessage}</AppText>
        )}
        <Pressable
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
          <AppText weight="medium" style={{ color: "#fff" }}>
            여행으로 돌아가기
          </AppText>
        </Pressable>
      </View>
    );
  }

  if (job.status === "PENDING" || job.status === "PROCESSING") {
    const total = job.totalTargets;
    const percent = total === null ? 0 : total === 0 ? 100 : Math.round((job.completedTargets / total) * 100);
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: 72, backgroundColor: colors.bg }}>
        <View style={{ gap: 8 }}>
          <ProgressBar percent={percent} height={8} />
          {total !== null && (
            <AppText mono weight="medium" style={{ color: colors.accent, textAlign: "right" }}>
              {job.completedTargets} / {total}
            </AppText>
          )}
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
            <AppText style={{ fontSize: 52 }}>🔄</AppText>
          </View>
          <AppText weight="medium" style={{ fontSize: 20, textAlign: "center" }}>
            {total === null ? "실외 장소를 살펴보고 있어요" : "실내 대안을 찾고 있어요"}
          </AppText>
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 20,
              backgroundColor: colors.bgMuted,
            }}
          >
            <AppText style={{ fontSize: 13, color: colors.inkMuted }}>💡 여행 전체를 확인하는 중이라 조금 걸릴 수 있어요</AppText>
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
        <AppText style={{ fontSize: 48 }}>✅</AppText>
        <AppText weight="medium" style={{ fontSize: 18, textAlign: "center" }}>
          재구성할 실외 장소가 없어요
        </AppText>
        <Pressable
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
          <AppText weight="medium" style={{ color: "#fff" }}>
            여행으로 돌아가기
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 64, gap: 16 }}>
        <AppText weight="medium" style={{ fontSize: 18 }}>
          실내 대안을 찾았어요
        </AppText>
        <AppText style={{ fontSize: 13, color: colors.inkMuted }}>
          장소마다 확인하고 교체하거나 건너뛸 수 있어요.
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
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                {[
                  candidate.category,
                  candidate.rating !== null ? `⭐ ${candidate.rating.toFixed(1)}` : null,
                  candidate.distanceToNextKm !== null ? `다음 장소까지 ${candidate.distanceToNextKm.toFixed(1)}km` : null,
                  candidate.estimatedTravelMinutes !== null ? `약 ${candidate.estimatedTravelMinutes}분` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
              {candidate.recommendationReason && (
                <AppText style={{ fontSize: 12, color: colors.accent }}>✨ {candidate.recommendationReason}</AppText>
              )}

              {status === "confirmed" ? (
                <AppText style={{ fontSize: 13, color: colors.accent }}>✓ 교체 완료</AppText>
              ) : status === "skipped" ? (
                <AppText style={{ fontSize: 13, color: colors.inkMuted }}>건너뜀</AppText>
              ) : (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Pressable
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
                  </Pressable>
                  <Pressable
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
                    <AppText weight="medium" style={{ fontSize: 13, color: "#fff" }}>
                      {status === "confirming" ? "교체 중..." : "교체"}
                    </AppText>
                  </Pressable>
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

        <Pressable
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
          <AppText weight="medium" style={{ color: "#fff" }}>
            여행으로 돌아가기
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}
