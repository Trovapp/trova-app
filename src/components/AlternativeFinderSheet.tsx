import { useEffect, useRef, useState, type ElementRef, type ReactNode } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { PlaceReviewContent } from "@/components/PlaceReviewModal";
import { PressableScale } from "@/components/PressableScale";
import { ProgressBar } from "@/components/ProgressBar";
import { RatingBadge } from "@/components/RatingBadge";
import { RecommendationReason } from "@/components/RecommendationReason";
import { haptics } from "@/lib/haptics";
import { categoryLabel } from "@/lib/placeCategory";
import { colors } from "@/lib/theme";
import {
  getAlternatives,
  replacePlace,
  type AlternativeCandidate,
  type AlternativeFilter,
} from "@/lib/api/trips";

const SNAP_POINTS = ["55%", "85%"];

const TRANSPORT_OPTIONS: { label: string; value: "WALK" | "TRANSIT" | "CAR" }[] = [
  { label: "도보", value: "WALK" },
  { label: "대중교통", value: "TRANSIT" },
  { label: "차량", value: "CAR" },
];

const CATEGORY_OPTIONS: { label: string; value?: string }[] = [
  { label: "전체" },
  { label: "카페", value: "카페" },
  { label: "음식점", value: "음식점" },
  { label: "관광명소", value: "관광명소" },
  { label: "박물관", value: "박물관" },
  { label: "공원", value: "공원" },
  { label: "쇼핑", value: "쇼핑" },
];

const DISTANCE_OPTIONS: { label: string; value?: number }[] = [
  { label: "제한 없음" },
  { label: "500m", value: 0.5 },
  { label: "1km", value: 1 },
  { label: "2km", value: 2 },
  { label: "5km", value: 5 },
];

const TRAVEL_TIME_OPTIONS: { label: string; value?: number }[] = [
  { label: "제한 없음" },
  { label: "10분", value: 10 },
  { label: "20분", value: 20 },
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
];

// 검색은 구글 Places 단일 호출이라 백엔드가 단계별 진행률을 안 준다 — 리뷰 요약
// 로딩(PlaceReviewModal)과 같은 "체감 진행률" 패턴을 재사용한다. 리뷰 생성(Gemini
// 호출)보다는 짧은 요청이라 예상 소요시간만 더 짧게 잡는다.
const EXPECTED_SEARCH_MS = 3000;
const SIMULATED_CAP_PERCENT = 92;
// 92%에서 이만큼 더 지나면 "느린 이유" 안내를 보여준다 — PlaceReviewModal과 동일한
// 이유(무료 티어 rate limit 백오프로 가끔 오래 걸림).
const SLOW_NOTICE_DELAY_MS = 4000;

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 16,
        backgroundColor: active ? colors.accent : colors.bgMuted,
      }}
    >
      <AppText style={{ fontSize: 12, color: active ? colors.onAccent : colors.inkMuted }}>{label}</AppText>
    </PressableScale>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText weight="medium" style={{ fontSize: 12, color: colors.inkMuted }}>
        {title}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

export function AlternativeFinderSheet({
  tripPlaceId,
  initialIndoor = false,
  onReplaced,
  onClose,
}: {
  tripPlaceId: number | null;
  initialIndoor?: boolean;
  onReplaced: () => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<ElementRef<typeof BottomSheetScrollView>>(null);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [indoor, setIndoor] = useState(initialIndoor);
  const [transportMode, setTransportMode] = useState<"WALK" | "TRANSIT" | "CAR" | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | undefined>(undefined);
  const [maxTravelMinutes, setMaxTravelMinutes] = useState<number | undefined>(undefined);
  // 대부분은 필터 없이 바로 검색하므로 기본은 접어서 "대안 찾기" 버튼이 스크롤
  // 없이 바로 보이게 한다 — 필터가 필요하면 요약 행을 눌러 펼친다.
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [candidates, setCandidates] = useState<AlternativeCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchPercent, setSearchPercent] = useState(0);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlternativeCandidate | null>(null);
  const [reviewCandidateId, setReviewCandidateId] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);

  const isOpen = tripPlaceId !== null;

  useEffect(() => {
    if (isOpen) {
      setIndoor(initialIndoor);
      setCategory(undefined);
      setTransportMode(null);
      setMaxDistanceKm(undefined);
      setMaxTravelMinutes(undefined);
      setCandidates(null);
      setSelected(null);
      setReviewCandidateId(null);
      setSearchError(null);
      setFiltersExpanded(false);
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripPlaceId]);

  // 리뷰 패널 ↔ 목록 전환 시 이전 스크롤 위치가 그대로 남아있지 않도록 맨 위로.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [reviewCandidateId]);

  useEffect(() => {
    if (!searching) {
      setSearchPercent(0);
      setShowSlowNotice(false);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setSearchPercent(Math.min(SIMULATED_CAP_PERCENT, Math.round((elapsed / EXPECTED_SEARCH_MS) * SIMULATED_CAP_PERCENT)));
      if (elapsed > EXPECTED_SEARCH_MS + SLOW_NOTICE_DELAY_MS) {
        setShowSlowNotice(true);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [searching]);

  async function handleSearch() {
    if (tripPlaceId === null || searching) return;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const filter: AlternativeFilter = {
        category,
        indoor: indoor || undefined,
        maxDistanceKm,
        maxTravelMinutes,
        transportMode: transportMode ?? undefined,
      };
      const result = await getAlternatives(tripPlaceId, filter);
      setCandidates(result);
      // 검색 결과가 있으면 필터를 접어서 결과 목록이 바로 보이게 한다 — 결과가
      // 없으면 사용자가 바로 필터를 조정할 수 있게 펼친 채로 둔다.
      setFiltersExpanded(result.length === 0);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch {
      setSearchError("대안을 찾지 못했어요. 다시 시도해주세요.");
    } finally {
      setSearching(false);
    }
  }

  async function handleReplace() {
    if (tripPlaceId === null || selected === null || replacing) return;
    setReplacing(true);
    try {
      await replacePlace(tripPlaceId, selected.googlePlaceId);
      await queryClient.invalidateQueries({ queryKey: ["trip"] });
      await queryClient.invalidateQueries({ queryKey: ["gapRecommendations"] });
      onReplaced();
    } catch {
      setSearchError("교체하지 못했어요. 다시 시도해주세요.");
    } finally {
      setReplacing(false);
    }
  }

  const filterSummary =
    [
      category ? CATEGORY_OPTIONS.find((o) => o.value === category)?.label : null,
      indoor ? "실내만" : null,
      transportMode ? TRANSPORT_OPTIONS.find((o) => o.value === transportMode)?.label : null,
      maxDistanceKm !== undefined ? DISTANCE_OPTIONS.find((o) => o.value === maxDistanceKm)?.label : null,
      maxTravelMinutes !== undefined ? TRAVEL_TIME_OPTIONS.find((o) => o.value === maxTravelMinutes)?.label : null,
    ]
      .filter((label): label is string => Boolean(label))
      .join(" · ") || "필터 설정 안 함";

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={() => {
        haptics.light();
        onClose();
      }}
    >
      <BottomSheetScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, gap: 16 }}>
        {reviewCandidateId !== null ? (
          <>
            <PressableScale
              onPress={() => setReviewCandidateId(null)}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Feather name="chevron-left" size={18} color={colors.accent} />
              <AppText style={{ fontSize: 14, color: colors.accent }}>목록으로</AppText>
            </PressableScale>
            <PlaceReviewContent placeId={reviewCandidateId} showMiniMap={false} />
          </>
        ) : (
          <>
            <AppText weight="medium" style={{ fontSize: 16 }}>
              대안 찾기
            </AppText>

            <PressableScale
              onPress={() => setFiltersExpanded((v) => !v)}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.bgMuted,
              }}
            >
              <AppText style={{ fontSize: 13, color: colors.inkMuted, flex: 1, marginRight: 8 }} numberOfLines={1}>
                {filterSummary}
              </AppText>
              <Feather name={filtersExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.inkMuted} />
            </PressableScale>

            {filtersExpanded && (
              <>
                <FilterSection title="카테고리">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.label}
                      label={opt.label}
                      active={category === opt.value}
                      onPress={() => setCategory(opt.value)}
                    />
                  ))}
                  <Chip label="실내만" active={indoor} onPress={() => setIndoor((v) => !v)} />
                </FilterSection>

                <FilterSection title="이동 수단">
                  {TRANSPORT_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={transportMode === opt.value}
                      onPress={() => setTransportMode((current) => (current === opt.value ? null : opt.value))}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="다음 장소까지 거리">
                  {DISTANCE_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.label}
                      label={opt.label}
                      active={maxDistanceKm === opt.value}
                      onPress={() => setMaxDistanceKm(opt.value)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="이동 시간">
                  {TRAVEL_TIME_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.label}
                      label={opt.label}
                      active={maxTravelMinutes === opt.value}
                      onPress={() => setMaxTravelMinutes(opt.value)}
                    />
                  ))}
                </FilterSection>
              </>
            )}

            <View style={{ gap: 8 }}>
              <PressableScale
                onPress={handleSearch}
                disabled={searching}
                style={{
                  height: 46,
                  borderRadius: 10,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: searching ? 0.8 : 1,
                }}
              >
                <AppText weight="medium" style={{ color: colors.onAccent }}>
                  {searching ? `대안 찾는 중... ${searchPercent}%` : "대안 찾기"}
                </AppText>
              </PressableScale>
              {searching && <ProgressBar percent={searchPercent} height={4} />}
              {searching && showSlowNotice && (
                <AppText style={{ color: colors.inkMuted, fontSize: 12 }}>
                  무료 API를 쓰고 있어서 가끔 평소보다 오래 걸릴 수 있어요.
                </AppText>
              )}
            </View>

            {searchError && <AppText style={{ color: colors.accent }}>{searchError}</AppText>}

            {candidates !== null && candidates.length === 0 && (
              <AppText style={{ color: colors.inkMuted, textAlign: "center", padding: 12 }}>
                조건에 맞는 대안을 찾지 못했어요.
              </AppText>
            )}

            {candidates !== null && candidates.length > 0 && (
              <View style={{ gap: 10 }}>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
                {candidates.map((candidate) => {
                  const isSelected = selected?.placeId === candidate.placeId;
                  return (
                    <View
                      key={candidate.placeId}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? colors.accent : colors.border,
                        gap: 6,
                      }}
                    >
                      <PressableScale onPress={() => setSelected(isSelected ? null : candidate)}>
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
                              candidate.isCongestionAvailable ? `혼잡도: ${candidate.congestionLevel}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </AppText>
                        </View>
                      </PressableScale>
                      {candidate.recommendationReason && (
                        <RecommendationReason text={candidate.recommendationReason} />
                      )}
                      <PressableScale
                        onPress={() => setReviewCandidateId(candidate.placeId)}
                        hitSlop={6}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        <AppText style={{ fontSize: 12, color: colors.accent }}>리뷰 보기</AppText>
                        <Feather name="chevron-right" size={12} color={colors.accent} />
                      </PressableScale>

                      {isSelected && (
                        <View style={{ gap: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                          <InlineMap
                            pins={[{ id: "selected", latitude: candidate.latitude, longitude: candidate.longitude, color: colors.accent }]}
                            height={120}
                            showPath={false}
                          />
                          {searchError && <AppText style={{ color: colors.accent }}>{searchError}</AppText>}
                          <PressableScale
                            onPress={handleReplace}
                            disabled={replacing}
                            style={{
                              height: 46,
                              borderRadius: 10,
                              backgroundColor: colors.accent,
                              justifyContent: "center",
                              alignItems: "center",
                              opacity: replacing ? 0.6 : 1,
                            }}
                          >
                            <AppText weight="medium" style={{ color: colors.onAccent }}>
                              {replacing ? "교체 중..." : "이 장소로 확정"}
                            </AppText>
                          </PressableScale>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
