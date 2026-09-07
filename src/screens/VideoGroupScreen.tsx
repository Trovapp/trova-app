import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { haversineDistanceKm } from "@/lib/geo";
import { generateItinerary, getPlaces } from "@/lib/api/places";
import { isItineraryGroup } from "@/lib/itinerary";
import { colors } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VideoGroup">;

export function VideoGroupScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const group = (placesQuery.data ?? []).filter((p) => p.jobId === jobId);

  async function handleGenerateItinerary() {
    if (group.length === 0 || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await generateItinerary(jobId);
      navigation.navigate("Processing", { jobId });
    } catch {
      setError("일정 생성 요청에 실패했어요. 다시 시도해주세요.");
      setGenerating(false);
    }
  }

  if (placesQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  if (group.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>해당 영상을 찾을 수 없어요.</AppText>
      </View>
    );
  }

  const title = group.find((p) => p.title)?.title ?? "제목 없음";

  // Task 13에서 isItineraryGroup(group)이 true인 경우를 일자별 편집
  // UI로 교체한다. 지금은 두 경우 모두 같은 평면 리스트로 보여준다 —
  // 일정이 있으면 dayNumber/orderInDay 순, 없으면 API가 준 순서 그대로.
  const ordered = isItineraryGroup(group)
    ? [...group].sort((a, b) => {
        if (a.dayNumber !== b.dayNumber) return (a.dayNumber ?? 0) - (b.dayNumber ?? 0);
        return (a.orderInDay ?? 0) - (b.orderInDay ?? 0);
      })
    : group;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <AppText weight="medium" style={{ fontSize: 18 }} numberOfLines={2}>
        {title}
      </AppText>

      <InlineMap
        pins={ordered
          .filter((p) => p.latitude !== null && p.longitude !== null)
          .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }))}
      />

      {!isItineraryGroup(group) && (
        <View>
          <Pressable
            onPress={handleGenerateItinerary}
            disabled={generating}
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              opacity: generating ? 0.6 : 1,
            }}
          >
            <AppText weight="medium" style={{ color: "#fff" }}>
              {generating ? "일정 생성 중..." : "일정 짜기"}
            </AppText>
          </Pressable>
          {error && <AppText style={{ marginTop: 8, color: colors.accent }}>{error}</AppText>}
        </View>
      )}

      <View style={{ gap: 12 }}>
        {ordered.map((place, index) => {
          const isLast = index === ordered.length - 1;
          const next = ordered[index + 1];
          const distanceKm =
            !isLast &&
            place.latitude !== null &&
            place.longitude !== null &&
            next?.latitude !== null &&
            next?.longitude !== null
              ? haversineDistanceKm(place.latitude, place.longitude, next!.latitude!, next!.longitude!)
              : null;
          return (
            <PlaceRow key={place.id} place={place} index={index} isLast={isLast} distanceKm={distanceKm} />
          );
        })}
      </View>
    </ScrollView>
  );
}
