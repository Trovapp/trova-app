import { useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { getDayColor } from "@/lib/itinerary";
import { parseTimeToDate, toTimeString } from "@/lib/date";
import { colors } from "@/lib/theme";
import {
  checkWeather,
  getTrip,
  removeTripPlace,
  reorderTripPlace,
  updateTripPlaceDetails,
  type TripPlace,
} from "@/lib/api/trips";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TripDetail">;

const TRANSPORT_LABEL: Record<"WALK" | "TRANSIT" | "CAR", string> = {
  WALK: "도보",
  TRANSIT: "대중교통",
  CAR: "차량",
};

type EditingField = { placeId: number; field: "time" | "transport" | "memo" } | null;

export function TripDetailScreen({ route }: Props) {
  const { id } = route.params;
  const queryClient = useQueryClient();
  const tripQuery = useQuery({ queryKey: ["trip", id], queryFn: () => getTrip(id) });

  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"search" | "bookmarks">("search");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [showTimePicker, setShowTimePicker] = useState<"start" | "end" | null>(null);
  const [memoDraft, setMemoDraft] = useState("");

  const trip = tripQuery.data;

  if (tripQuery.isLoading || !trip) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  const currentActiveDay = activeDay ?? trip.days[0]?.day ?? 1;
  const activeDayData = trip.days.find((d) => d.day === currentActiveDay);
  const places = activeDayData?.places ?? [];
  const dayColor = getDayColor(currentActiveDay);
  const tripId = trip.id;

  async function reload() {
    await queryClient.invalidateQueries({ queryKey: ["trip", id] });
  }

  async function handleReorder(placeId: number, direction: "UP" | "DOWN") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await reorderTripPlace(placeId, direction);
      await reload();
    } catch {
      setError("순서를 바꾸지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(placeId: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeTripPlace(placeId);
      await reload();
    } catch {
      setError("장소를 삭제하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateDetails(placeId: number, patch: Parameters<typeof updateTripPlaceDetails>[1]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateTripPlaceDetails(placeId, patch);
      await reload();
    } catch {
      setError("저장하지 못했어요.");
    } finally {
      setBusy(false);
      setEditingField(null);
    }
  }

  async function handleCheckWeather() {
    if (busy) return;
    setBusy(true);
    setWeatherMessage(null);
    try {
      const result = await checkWeather(tripId, currentActiveDay);
      setWeatherMessage(result.message);
    } catch {
      setWeatherMessage("날씨 확인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
          {trip.days.map((d) => (
            <Pressable
              key={d.day}
              onPress={() => setActiveDay(d.day)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor: d.day === currentActiveDay ? colors.accent : colors.bgMuted,
              }}
            >
              <AppText weight="medium" style={{ color: d.day === currentActiveDay ? "#fff" : colors.inkMuted, fontSize: 13 }}>
                {d.day}일차{d.date ? ` (${d.date.slice(5)})` : ""}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={handleCheckWeather} disabled={busy || !activeDayData?.date}>
          <AppText style={{ fontSize: 13, color: colors.accent, opacity: !activeDayData?.date ? 0.4 : 1 }}>날씨 확인</AppText>
        </Pressable>
      </View>

      {weatherMessage && (
        <View style={{ padding: 10, borderRadius: 8, backgroundColor: colors.accentBg }}>
          <AppText style={{ fontSize: 13 }}>{weatherMessage}</AppText>
        </View>
      )}
      {error && <AppText style={{ color: colors.accent }}>{error}</AppText>}

      <InlineMap
        pins={places
          .filter((p) => p.latitude !== null && p.longitude !== null)
          .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }))}
      />

      <View style={{ gap: 12 }}>
        {places.length === 0 && (
          <AppText style={{ textAlign: "center", color: colors.inkMuted, padding: 16 }}>
            아직 장소가 없어요. 아래에서 검색해서 추가해보세요.
          </AppText>
        )}
        {places.map((place, index) => (
          <PlaceRow
            key={place.id}
            place={place}
            index={index}
            isLast={index === places.length - 1}
            distanceKm={null}
            editable
            disabled={busy}
            color={dayColor}
            onMoveUp={() => handleReorder(place.id, "UP")}
            onMoveDown={() => handleReorder(place.id, "DOWN")}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 4 }}>
              <Pressable
                onPress={() => {
                  setEditingField({ placeId: place.id, field: "time" });
                  setShowTimePicker("start");
                }}
              >
                <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                  {place.visitStartTime && place.visitEndTime
                    ? `${place.visitStartTime.slice(0, 5)}~${place.visitEndTime.slice(0, 5)}`
                    : "시간 추가"}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() =>
                  setEditingField(
                    editingField?.placeId === place.id && editingField.field === "transport"
                      ? null
                      : { placeId: place.id, field: "transport" }
                  )
                }
              >
                <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                  {place.arrivalTransportMode ? TRANSPORT_LABEL[place.arrivalTransportMode] : "이동수단 추가"}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMemoDraft(place.memo ?? "");
                  setEditingField({ placeId: place.id, field: "memo" });
                }}
              >
                <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                  {place.memo || "메모 추가"}
                </AppText>
              </Pressable>

              <Pressable onPress={() => handleRemove(place.id)} disabled={busy} style={{ marginLeft: "auto" }}>
                <AppText style={{ fontSize: 13, color: colors.inkMuted }}>삭제</AppText>
              </Pressable>
            </View>

            {editingField?.placeId === place.id && editingField.field === "transport" && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                {(["WALK", "TRANSIT", "CAR"] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => handleUpdateDetails(place.id, { arrivalTransportMode: mode })}
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 14,
                      backgroundColor: place.arrivalTransportMode === mode ? colors.accent : colors.bgMuted,
                    }}
                  >
                    <AppText style={{ fontSize: 11, color: place.arrivalTransportMode === mode ? "#fff" : colors.inkMuted }}>
                      {TRANSPORT_LABEL[mode]}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}

            {editingField?.placeId === place.id && editingField.field === "memo" && (
              <TextInput
                autoFocus
                defaultValue={memoDraft}
                onChangeText={setMemoDraft}
                onBlur={() => handleUpdateDetails(place.id, { memo: memoDraft })}
                onSubmitEditing={() => handleUpdateDetails(place.id, { memo: memoDraft })}
                style={{
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  fontSize: 12,
                }}
              />
            )}

            {editingField?.placeId === place.id && editingField.field === "time" && showTimePicker && (
              <DateTimePicker
                value={parseTimeToDate(showTimePicker === "start" ? place.visitStartTime : place.visitEndTime)}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event, selected) => {
                  if (!selected) {
                    setShowTimePicker(null);
                    return;
                  }
                  const timeStr = toTimeString(selected);
                  if (showTimePicker === "start") {
                    handleUpdateDetails(place.id, { visitStartTime: timeStr }).then(() => setShowTimePicker("end"));
                  } else {
                    handleUpdateDetails(place.id, { visitEndTime: timeStr }).then(() => setShowTimePicker(null));
                  }
                }}
              />
            )}
          </PlaceRow>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
        <Pressable onPress={() => setActiveTab("search")}>
          <AppText weight="medium" style={{ color: activeTab === "search" ? colors.accent : colors.inkMuted }}>
            검색
          </AppText>
        </Pressable>
        <Pressable onPress={() => setActiveTab("bookmarks")}>
          <AppText weight="medium" style={{ color: activeTab === "bookmarks" ? colors.accent : colors.inkMuted }}>
            찜한 장소
          </AppText>
        </Pressable>
      </View>
      {/* 검색/찜 탭 내용은 Task 17에서 여기에 추가된다. */}
    </ScrollView>
  );
}
