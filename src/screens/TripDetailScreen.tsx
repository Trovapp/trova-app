import { useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { PlaceReviewModal } from "@/components/PlaceReviewModal";
import { getDayColor } from "@/lib/itinerary";
import { parseTimeToDate, toTimeString } from "@/lib/date";
import { colors } from "@/lib/theme";
import { addBookmark, listBookmarks, removeBookmark } from "@/lib/api/bookmarks";
import { searchPlaces, type RecommendedPlace } from "@/lib/api/recommendations";
import {
  addTripPlace,
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
  // iOS 스피너는 드래그하는 내내 onChange가 계속 발생한다 — 저장하지 않고 여기에만 담아두고
  // "확인"을 눌렀을 때 한 번만 저장한다.
  const [timeDraft, setTimeDraft] = useState<Date | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecommendedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [reviewModalPlaceId, setReviewModalPlaceId] = useState<number | null>(null);

  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const bookmarkedPlaceIds = new Set((bookmarksQuery.data ?? []).map((b) => b.placeId));

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

  async function handleSearch() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      setSearchResults(await searchPlaces(query.trim()));
    } catch {
      setError("장소를 찾지 못했어요. 다른 검색어로 시도해보세요.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddPlace(googlePlaceId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await addTripPlace(tripId, currentActiveDay, googlePlaceId);
      await reload();
    } catch {
      setError("장소를 추가하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleBookmark(placeId: number) {
    if (bookmarkedPlaceIds.has(placeId)) return;
    try {
      await addBookmark(placeId);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch {
      setError("찜하기에 실패했어요.");
    }
  }

  async function handleRemoveBookmark(bookmarkId: number) {
    try {
      await removeBookmark(bookmarkId);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch {
      setError("찜을 해제하지 못했어요.");
    }
  }

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

  // 저장이 실제로 끝났는지를 호출부가 알 수 있어야 한다. busy 가드로 그냥 return하면
  // async 함수는 다음 마이크로태스크에 곧바로 resolve되므로, .then()으로 다음 단계를
  // 이어붙이면 저장이 끝나기도 전에 진행돼버린다.
  async function handleUpdateDetails(
    placeId: number,
    patch: Parameters<typeof updateTripPlaceDetails>[1],
    options?: { keepEditingField?: boolean }
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    let saved = false;
    try {
      await updateTripPlaceDetails(placeId, patch);
      await reload();
      saved = true;
    } catch {
      setError("저장하지 못했어요.");
    } finally {
      setBusy(false);
      if (!options?.keepEditingField) {
        setEditingField(null);
      }
    }
    return saved;
  }

  function closeTimePicker() {
    setTimeDraft(null);
    setShowTimePicker(null);
    setEditingField(null);
  }

  // 시작 시간이 저장에 성공했을 때에만 종료 시간 단계로 넘어간다.
  async function commitTime(place: TripPlace, selected: Date) {
    const isStart = showTimePicker === "start";
    const timeStr = toTimeString(selected);
    const saved = await handleUpdateDetails(
      place.id,
      isStart ? { visitStartTime: timeStr } : { visitEndTime: timeStr },
      { keepEditingField: true }
    );
    if (saved && isStart) {
      setTimeDraft(parseTimeToDate(place.visitEndTime));
      setShowTimePicker("end");
      return;
    }
    closeTimePicker();
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
                  setTimeDraft(parseTimeToDate(place.visitStartTime));
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
              <View style={{ marginTop: 6, gap: 4 }}>
                <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                  {showTimePicker === "start" ? "방문 시작 시간" : "방문 종료 시간"}
                </AppText>
                <DateTimePicker
                  // Android는 마운트될 때 다이얼로그가 뜬다 — 시작→종료로 넘어갈 때
                  // key를 바꿔 다시 마운트해야 종료 시간 다이얼로그가 실제로 열린다.
                  key={showTimePicker}
                  value={
                    timeDraft ??
                    parseTimeToDate(showTimePicker === "start" ? place.visitStartTime : place.visitEndTime)
                  }
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selected) => {
                    if (Platform.OS === "ios") {
                      // 드래그 중간값 — 저장하지 않고 담아만 둔다.
                      if (selected) setTimeDraft(selected);
                      return;
                    }
                    // Android는 모달이라 확인/취소 시 한 번만 발생한다.
                    if (event.type !== "set" || !selected) {
                      closeTimePicker();
                      return;
                    }
                    commitTime(place, selected);
                  }}
                />
                {Platform.OS === "ios" && (
                  <View style={{ flexDirection: "row", gap: 16, justifyContent: "flex-end" }}>
                    <Pressable onPress={closeTimePicker} disabled={busy}>
                      <AppText style={{ fontSize: 13, color: colors.inkMuted }}>취소</AppText>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        commitTime(
                          place,
                          timeDraft ??
                            parseTimeToDate(showTimePicker === "start" ? place.visitStartTime : place.visitEndTime)
                        )
                      }
                      disabled={busy}
                      style={{ opacity: busy ? 0.4 : 1 }}
                    >
                      <AppText weight="medium" style={{ fontSize: 13, color: colors.accent }}>
                        확인
                      </AppText>
                    </Pressable>
                  </View>
                )}
              </View>
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
      {activeTab === "search" ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="장소 이름으로 검색 (예: 경복궁)"
              style={{
                flex: 1,
                height: 44,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                fontFamily: "IBMPlexMono_400Regular",
              }}
            />
            <Pressable
              onPress={handleSearch}
              disabled={searching || !query.trim()}
              style={{
                height: 44,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: searching || !query.trim() ? 0.6 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: "#fff" }}>
                {searching ? "검색 중..." : "검색"}
              </AppText>
            </Pressable>
          </View>

          {searchResults.map((place) => (
            <View key={place.id} style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="medium" numberOfLines={1}>
                    {place.name}
                  </AppText>
                  {place.address && (
                    <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                      {place.address}
                    </AppText>
                  )}
                  {place.rating !== null && (
                    <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                      ⭐ {place.rating.toFixed(1)}
                      {place.userRatingCount !== null ? ` (리뷰 ${place.userRatingCount}개)` : ""}
                    </AppText>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <Pressable onPress={() => handleToggleBookmark(place.id)}>
                    <AppText style={{ fontSize: 18 }}>{bookmarkedPlaceIds.has(place.id) ? "❤️" : "🤍"}</AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddPlace(place.googlePlaceId)}
                    disabled={busy}
                    style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.accent }}
                  >
                    <AppText style={{ fontSize: 12, color: "#fff" }}>추가</AppText>
                  </Pressable>
                </View>
              </View>
              <Pressable onPress={() => setReviewModalPlaceId(place.id)}>
                <AppText style={{ fontSize: 12, color: colors.accent }}>상세보기</AppText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {(bookmarksQuery.data ?? []).length === 0 && (
            <AppText style={{ color: colors.inkMuted }}>아직 찜한 장소가 없어요.</AppText>
          )}
          {(bookmarksQuery.data ?? []).map((bookmark) => (
            <View
              key={bookmark.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
            >
              <AppText weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {bookmark.placeName}
              </AppText>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => handleAddPlace(bookmark.googlePlaceId)}
                  disabled={busy}
                  style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.accent }}
                >
                  <AppText style={{ fontSize: 12, color: "#fff" }}>추가</AppText>
                </Pressable>
                <Pressable onPress={() => handleRemoveBookmark(bookmark.id)}>
                  <AppText style={{ fontSize: 12, color: colors.inkMuted }}>제거</AppText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <PlaceReviewModal
        visible={reviewModalPlaceId !== null}
        placeId={reviewModalPlaceId}
        onClose={() => setReviewModalPlaceId(null)}
      />
    </ScrollView>
  );
}
