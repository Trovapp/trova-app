import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { DayPickerSheet } from "@/components/DayPickerSheet";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { QueryErrorView } from "@/components/QueryErrorView";
import { haversineDistanceKm } from "@/lib/geo";
import { generateItinerary, getPlaces, moveToDay, optimizeRoute, reorderPlace, type Place } from "@/lib/api/places";
import { confirmTrip } from "@/lib/api/trips";
import { toDateString } from "@/lib/date";
import { groupByDay, isItineraryGroup } from "@/lib/itinerary";
import { colors } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VideoGroup">;

export function VideoGroupScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const [localPlaces, setLocalPlaces] = useState<Place[] | null>(null);
  const [emptyDayNumbers, setEmptyDayNumbers] = useState<number[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [dayPickerFor, setDayPickerFor] = useState<Place | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripTitle, setTripTitle] = useState("");
  const [confirmingTrip, setConfirmingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);

  const group = (placesQuery.data ?? []).filter((p) => p.jobId === jobId);

  const itineraryPlaces = localPlaces ?? group;
  const hasItinerary = isItineraryGroup(itineraryPlaces);
  const days = groupByDay(itineraryPlaces);
  const dayNumbers = Array.from(new Set([...days.keys(), ...emptyDayNumbers])).sort((a, b) => a - b);
  const currentActiveDay = activeDay ?? dayNumbers[0] ?? null;
  const activePlaces = currentActiveDay !== null ? days.get(currentActiveDay) ?? [] : [];
  const unassignedPlaces = itineraryPlaces.filter((p) => p.dayNumber === null);

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

  async function handleMoveDay(place: Place, dayNumber: number) {
    if (actionPending) return;
    setActionPending(true);
    const previous = itineraryPlaces;
    const previousEmptyDays = emptyDayNumbers;
    const previousActiveDay = currentActiveDay;
    const sourceDay = place.dayNumber;
    setItineraryError(null);
    setLocalPlaces(previous.map((p) => (p.id === place.id ? { ...p, dayNumber } : p)));
    setEmptyDayNumbers((current) => current.filter((d) => d !== dayNumber));

    const sourceDayNowEmpty =
      sourceDay !== null &&
      sourceDay === currentActiveDay &&
      !previous.some((p) => p.id !== place.id && p.dayNumber === sourceDay);
    if (sourceDayNowEmpty) {
      setActiveDay(dayNumber);
    }

    try {
      const updated = await moveToDay(place.id, dayNumber);
      setLocalPlaces((current) => (current ?? previous).map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setLocalPlaces(previous);
      setEmptyDayNumbers(previousEmptyDays);
      if (sourceDayNowEmpty) {
        setActiveDay(previousActiveDay);
      }
      setItineraryError("장소를 옮기지 못했어요. 다시 시도해주세요.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleReorder(place: Place, direction: "UP" | "DOWN") {
    if (actionPending || place.dayNumber === null) return;
    const dayPlaces = days.get(place.dayNumber) ?? [];
    const index = dayPlaces.findIndex((p) => p.id === place.id);
    const swapIndex = direction === "UP" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= dayPlaces.length) return;
    const neighbor = dayPlaces[swapIndex];

    setActionPending(true);
    const previous = itineraryPlaces;
    setItineraryError(null);
    const placeOrder = place.orderInDay;
    const neighborOrder = neighbor.orderInDay;
    setLocalPlaces(
      previous.map((p) => {
        if (p.id === place.id) return { ...p, orderInDay: neighborOrder };
        if (p.id === neighbor.id) return { ...p, orderInDay: placeOrder };
        return p;
      })
    );

    try {
      const updated = await reorderPlace(place.id, direction);
      setLocalPlaces((current) => (current ?? previous).map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setLocalPlaces(previous);
      setItineraryError("순서를 바꾸지 못했어요. 다시 시도해주세요.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleConfirmTrip() {
    if (group.length === 0 || confirmingTrip) return;
    setConfirmingTrip(true);
    setTripError(null);
    try {
      const trip = await confirmTrip(group[0].jobId, tripTitle.trim() || title, toDateString(new Date()));
      // replace는 아래에 깔린 여행 목록 화면을 unmount하지 않는다 — 무효화해두지 않으면
      // 뒤로 가기로 돌아왔을 때 방금 확정한 여행이 목록에 없다.
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      navigation.replace("TripDetail", { id: trip.id });
    } catch {
      setTripError("여행 확정에 실패했어요. 다시 시도해주세요.");
      setConfirmingTrip(false);
    }
  }

  function handleAddDay() {
    const nextDay = (dayNumbers[dayNumbers.length - 1] ?? 0) + 1;
    setEmptyDayNumbers((current) => [...current, nextDay]);
    setActiveDay(nextDay);
  }

  function handleDeleteDay(day: number) {
    setEmptyDayNumbers((current) => current.filter((d) => d !== day));
    if (currentActiveDay === day) {
      setActiveDay(dayNumbers.find((d) => d !== day) ?? null);
    }
  }

  async function handleOptimizeRoute() {
    if (actionPending || activePlaces.length < 2 || currentActiveDay === null) return;
    const jobIdForOptimize = activePlaces[0]?.jobId;
    if (jobIdForOptimize === undefined) return;

    setActionPending(true);
    setItineraryError(null);
    try {
      const updated = await optimizeRoute(jobIdForOptimize, currentActiveDay);
      const updatedById = new Map(updated.map((p) => [p.id, p]));
      setLocalPlaces((current) => (current ?? itineraryPlaces).map((p) => updatedById.get(p.id) ?? p));
    } catch {
      setItineraryError("동선을 최적화하지 못했어요. 다시 시도해주세요.");
    } finally {
      setActionPending(false);
    }
  }

  if (placesQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  // 조회 실패를 "영상 없음"으로 보여주면 사용자가 다시 시도할 방법이 없다.
  if (placesQuery.isError) {
    return (
      <QueryErrorView
        fullScreen
        message="장소를 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
        onRetry={() => placesQuery.refetch()}
      />
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

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <AppText weight="medium" style={{ fontSize: 18 }} numberOfLines={2}>
        {title}
      </AppText>

      {!hasItinerary && (
        <>
          <InlineMap
            pins={group
              .filter((p) => p.latitude !== null && p.longitude !== null)
              .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }))}
          />
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
          {error && <AppText style={{ color: colors.accent }}>{error}</AppText>}
          <View style={{ gap: 12 }}>
            {group.map((place, index) => {
              const isLast = index === group.length - 1;
              const next = group[index + 1];
              const distanceKm =
                !isLast && place.latitude !== null && place.longitude !== null && next?.latitude !== null && next?.longitude !== null
                  ? haversineDistanceKm(place.latitude, place.longitude, next!.latitude!, next!.longitude!)
                  : null;
              return <PlaceRow key={place.id} place={place} index={index} isLast={isLast} distanceKm={distanceKm} />;
            })}
          </View>
        </>
      )}

      {hasItinerary && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {dayNumbers.map((day) => (
              <Pressable
                key={day}
                onPress={() => setActiveDay(day)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  backgroundColor: day === currentActiveDay ? colors.accent : colors.bgMuted,
                }}
              >
                <AppText weight="medium" style={{ color: day === currentActiveDay ? "#fff" : colors.inkMuted, fontSize: 13 }}>
                  {day}일차
                </AppText>
              </Pressable>
            ))}
            <Pressable
              onPress={handleAddDay}
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
            >
              <AppText style={{ fontSize: 13, color: colors.inkMuted }}>+ 날짜 추가</AppText>
            </Pressable>
          </View>

          {!showTripForm ? (
            <Pressable
              onPress={() => {
                setTripTitle(title);
                setShowTripForm(true);
              }}
              style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, justifyContent: "center", alignItems: "center" }}
            >
              <AppText weight="medium" style={{ color: colors.accent }}>
                여행으로 만들기
              </AppText>
            </Pressable>
          ) : (
            <View style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
              <TextInput
                value={tripTitle}
                onChangeText={setTripTitle}
                placeholder="여행 이름"
                style={{
                  height: 40,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  fontFamily: "NotoSansKR_400Regular",
                }}
              />
              <Pressable
                onPress={handleConfirmTrip}
                disabled={confirmingTrip}
                style={{
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: colors.accent,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: confirmingTrip ? 0.6 : 1,
                }}
              >
                <AppText weight="medium" style={{ color: "#fff" }}>
                  {confirmingTrip ? "확정 중..." : "확정"}
                </AppText>
              </Pressable>
              {tripError && <AppText style={{ color: colors.accent }}>{tripError}</AppText>}
            </View>
          )}

          {currentActiveDay !== null && emptyDayNumbers.includes(currentActiveDay) && activePlaces.length === 0 && (
            <Pressable onPress={() => handleDeleteDay(currentActiveDay)}>
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>이 빈 날짜 삭제</AppText>
            </Pressable>
          )}

          <Pressable
            onPress={handleOptimizeRoute}
            disabled={actionPending || activePlaces.length < 2}
            style={{ opacity: actionPending || activePlaces.length < 2 ? 0.4 : 1 }}
          >
            <AppText style={{ fontSize: 13, color: colors.accent }}>동선 최적화</AppText>
          </Pressable>

          {itineraryError && <AppText style={{ color: colors.accent }}>{itineraryError}</AppText>}

          <InlineMap
            pins={activePlaces
              .filter((p) => p.latitude !== null && p.longitude !== null)
              .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }))}
          />

          <View style={{ gap: 12 }}>
            {activePlaces.map((place, index) => {
              const isLast = index === activePlaces.length - 1;
              const next = activePlaces[index + 1];
              const distanceKm =
                !isLast && place.latitude !== null && place.longitude !== null && next?.latitude !== null && next?.longitude !== null
                  ? haversineDistanceKm(place.latitude, place.longitude, next!.latitude!, next!.longitude!)
                  : null;
              return (
                <PlaceRow
                  key={place.id}
                  place={place}
                  index={index}
                  isLast={isLast}
                  distanceKm={distanceKm}
                  editable
                  disabled={actionPending}
                  onMoveUp={() => handleReorder(place, "UP")}
                  onMoveDown={() => handleReorder(place, "DOWN")}
                  onOpenDayPicker={() => setDayPickerFor(place)}
                />
              );
            })}
          </View>

          {unassignedPlaces.length > 0 && (
            <View style={{ gap: 12 }}>
              <AppText weight="medium" style={{ fontSize: 13, color: colors.inkMuted }}>
                아직 날짜가 없는 장소
              </AppText>
              {unassignedPlaces.map((place, index) => (
                <PlaceRow
                  key={place.id}
                  place={place}
                  index={index}
                  isLast={index === unassignedPlaces.length - 1}
                  distanceKm={null}
                  editable
                  disabled={actionPending}
                  onOpenDayPicker={() => setDayPickerFor(place)}
                />
              ))}
            </View>
          )}

          <DayPickerSheet
            visible={dayPickerFor !== null}
            dayNumbers={dayNumbers}
            currentDay={dayPickerFor?.dayNumber ?? null}
            onSelect={(day) => {
              if (dayPickerFor) handleMoveDay(dayPickerFor, day);
            }}
            onClose={() => setDayPickerFor(null)}
          />
        </>
      )}
    </ScrollView>
  );
}
