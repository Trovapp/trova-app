import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { PlaceReviewContent } from "@/components/PlaceReviewModal";
import { colors } from "@/lib/theme";
import {
  getAlternatives,
  replacePlace,
  type AlternativeCandidate,
  type AlternativeFilter,
} from "@/lib/api/trips";

const SNAP_POINTS = ["55%", "85%"];
const TRANSPORT_LABEL: Record<"WALK" | "TRANSIT" | "CAR", string> = {
  WALK: "도보",
  TRANSIT: "대중교통",
  CAR: "차량",
};

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
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [indoor, setIndoor] = useState(initialIndoor);
  const [transportMode, setTransportMode] = useState<"WALK" | "TRANSIT" | "CAR" | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [maxTravelMinutes, setMaxTravelMinutes] = useState("");
  const [candidates, setCandidates] = useState<AlternativeCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlternativeCandidate | null>(null);
  const [reviewCandidateId, setReviewCandidateId] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);

  const isOpen = tripPlaceId !== null;

  useEffect(() => {
    if (isOpen) {
      setIndoor(initialIndoor);
      setCandidates(null);
      setSelected(null);
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripPlaceId]);

  async function handleSearch() {
    if (tripPlaceId === null || searching) return;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const parsedMaxDistanceKm = maxDistanceKm ? Number(maxDistanceKm) : undefined;
      const parsedMaxTravelMinutes = maxTravelMinutes ? Number(maxTravelMinutes) : undefined;
      const filter: AlternativeFilter = {
        category: category.trim() || undefined,
        indoor: indoor || undefined,
        maxDistanceKm: Number.isFinite(parsedMaxDistanceKm) ? parsedMaxDistanceKm : undefined,
        maxTravelMinutes: Number.isFinite(parsedMaxTravelMinutes) ? parsedMaxTravelMinutes : undefined,
        transportMode: transportMode ?? undefined,
      };
      setCandidates(await getAlternatives(tripPlaceId, filter));
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

  return (
    <BottomSheet ref={sheetRef} index={-1} snapPoints={SNAP_POINTS} enableDynamicSizing={false} enablePanDownToClose onClose={onClose}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <AppText weight="medium" style={{ fontSize: 16 }}>
          대안 찾기
        </AppText>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="카테고리(예: 카페, 박물관)"
            style={{
              flex: 1,
              height: 40,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              fontFamily: "NotoSansKR_400Regular",
            }}
          />
          <Pressable
            onPress={() => setIndoor((v) => !v)}
            style={{
              paddingHorizontal: 12,
              height: 40,
              borderRadius: 10,
              justifyContent: "center",
              backgroundColor: indoor ? colors.accent : colors.bgMuted,
            }}
          >
            <AppText style={{ color: indoor ? "#fff" : colors.inkMuted, fontSize: 13 }}>실내만</AppText>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["WALK", "TRANSIT", "CAR"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setTransportMode((current) => (current === mode ? null : mode))}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: transportMode === mode ? colors.accent : colors.bgMuted,
              }}
            >
              <AppText style={{ fontSize: 12, color: transportMode === mode ? "#fff" : colors.inkMuted }}>
                {TRANSPORT_LABEL[mode]}
              </AppText>
            </Pressable>
          ))}
          <TextInput
            value={maxDistanceKm}
            onChangeText={setMaxDistanceKm}
            placeholder="다음 장소까지 최대 거리(km)"
            keyboardType="numeric"
            style={{
              flex: 1,
              height: 32,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              fontSize: 12,
              fontFamily: "NotoSansKR_400Regular",
            }}
          />
          <TextInput
            value={maxTravelMinutes}
            onChangeText={setMaxTravelMinutes}
            placeholder="이동 시간(분)"
            keyboardType="numeric"
            style={{
              flex: 1,
              height: 32,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              fontSize: 12,
              fontFamily: "NotoSansKR_400Regular",
            }}
          />
        </View>

        <Pressable
          onPress={handleSearch}
          disabled={searching}
          style={{
            height: 44,
            borderRadius: 10,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            opacity: searching ? 0.6 : 1,
          }}
        >
          <AppText weight="medium" style={{ color: "#fff" }}>
            {searching ? "찾는 중..." : "대안 찾기"}
          </AppText>
        </Pressable>

        {searchError && <AppText style={{ color: colors.accent }}>{searchError}</AppText>}

        {candidates !== null && candidates.length === 0 && (
          <AppText style={{ color: colors.inkMuted, textAlign: "center", padding: 12 }}>
            조건에 맞는 대안을 찾지 못했어요.
          </AppText>
        )}

        {candidates?.map((candidate) => (
          <View
            key={candidate.placeId}
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: selected?.placeId === candidate.placeId ? 2 : 1,
              borderColor: selected?.placeId === candidate.placeId ? colors.accent : colors.border,
              gap: 6,
            }}
          >
            <Pressable onPress={() => setSelected(candidate)}>
              <AppText weight="medium" numberOfLines={1}>
                {candidate.name}
              </AppText>
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                {[
                  candidate.category,
                  candidate.rating !== null ? `⭐ ${candidate.rating.toFixed(1)}` : null,
                  candidate.distanceToNextKm !== null ? `다음 장소까지 ${candidate.distanceToNextKm.toFixed(1)}km` : null,
                  candidate.estimatedTravelMinutes !== null ? `약 ${candidate.estimatedTravelMinutes}분` : null,
                  candidate.isCongestionAvailable ? `혼잡도: ${candidate.congestionLevel}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
            </Pressable>
            <Pressable onPress={() => setReviewCandidateId(candidate.placeId)}>
              <AppText style={{ fontSize: 12, color: colors.accent }}>리뷰 보기</AppText>
            </Pressable>
          </View>
        ))}

        {selected && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <AppText weight="medium" style={{ fontSize: 13 }}>
              미리보기
            </AppText>
            <InlineMap
              pins={[{ id: "selected", latitude: selected.latitude, longitude: selected.longitude, color: colors.accent }]}
              height={140}
              showPath={false}
            />
            {searchError && <AppText style={{ color: colors.accent }}>{searchError}</AppText>}
            <Pressable
              onPress={handleReplace}
              disabled={replacing}
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: replacing ? 0.6 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: "#fff" }}>
                {replacing ? "교체 중..." : "이 장소로 교체"}
              </AppText>
            </Pressable>
          </View>
        )}

        {reviewCandidateId !== null && (
          <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
            <PlaceReviewContent placeId={reviewCandidateId} showMiniMap={false} />
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
