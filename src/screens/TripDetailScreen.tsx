import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { FolderPickerModal } from "@/components/FolderPickerModal";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { PlaceReviewSheet } from "@/components/PlaceReviewModal";
import { QueryErrorView } from "@/components/QueryErrorView";
import { getDayColor } from "@/lib/itinerary";
import { parseTimeToDate, toTimeString } from "@/lib/date";
import { colors } from "@/lib/theme";
import { addBookmark, listBookmarks, listFolders, removeBookmark } from "@/lib/api/bookmarks";
import { searchPlaces, type RecommendedPlace } from "@/lib/api/recommendations";
import {
  addTripPlace,
  checkWeather,
  getTrip,
  optimizeTripRoute,
  removeTripPlace,
  reorderTripPlace,
  updateTripPlaceDetails,
  type TripDetail,
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

const UNSORTED_ID = -1; // "미분류" 가상 폴더 id — 저장 장소 화면(SavedPlacesScreen)과 동일한 규칙.

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
  const [showTimePicker, setShowTimePicker] = useState(false);
  // iOS 스피너는 드래그하는 내내 onChange가 계속 발생한다 — 저장하지 않고 여기에만 담아두고
  // "확인"을 눌렀을 때 한 번만 저장한다.
  const [timeDraft, setTimeDraft] = useState<Date | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecommendedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  // 검색결과 카드("장소 카탈로그")는 placeId로, 여행에 이미 담긴 장소 카드는
  // tripPlaceId로 리뷰 요약을 연다 — 서로 다른 id 공간이라 구분해서 들고 있는다.
  const [reviewTarget, setReviewTarget] = useState<{ kind: "place" | "tripPlace"; id: number } | null>(null);
  const [folderPickerPlaceId, setFolderPickerPlaceId] = useState<number | null>(null);

  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const foldersQuery = useQuery({ queryKey: ["bookmarkFolders"], queryFn: listFolders });
  const bookmarkedPlaceIds = new Set((bookmarksQuery.data ?? []).map((b) => b.placeId));

  const trip = tripQuery.data;

  if (tripQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  // 조회 실패와 "아직 데이터 없음"을 같은 화면으로 보여주지 않는다.
  if (tripQuery.isError || !trip) {
    return (
      <QueryErrorView
        fullScreen
        message="여행 정보를 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
        onRetry={() => tripQuery.refetch()}
      />
    );
  }

  const currentActiveDay = activeDay ?? trip.days[0]?.day ?? 1;
  const activeDayData = trip.days.find((d) => d.day === currentActiveDay);
  const places = activeDayData?.places ?? [];
  const dayColor = getDayColor(currentActiveDay);
  const tripId = trip.id;

  const folders = foldersQuery.data ?? [];
  const bookmarks = bookmarksQuery.data ?? [];
  // 저장 장소 화면과 같은 규칙으로 찜한 장소를 폴더별로 묶는다 — "미분류"를 먼저,
  // 그 다음 폴더들을, 각각 안에 장소가 하나도 없는 섹션은 숨긴다.
  const bookmarkFolderSections = [
    { id: UNSORTED_ID, name: "미분류", color: colors.inkMuted, bookmarks: bookmarks.filter((b) => b.folderId === null) },
    ...folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      bookmarks: bookmarks.filter((b) => b.folderId === folder.id),
    })),
  ].filter((section) => section.bookmarks.length > 0);

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
    setFolderPickerPlaceId(placeId);
  }

  async function handlePickFolder(folderId: number | null) {
    if (folderPickerPlaceId === null) return;
    const placeId = folderPickerPlaceId;
    setFolderPickerPlaceId(null);
    try {
      await addBookmark(placeId, folderId);
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

  // 드래그가 끝나면 화면은 바로 새 순서를 반영하고(체감상 즉시 반응해야 하니까),
  // 실제 저장은 기존 한 칸씩 이동하는 API를 옮긴 칸 수만큼 순차 호출해서 처리한다.
  // 새 "한번에 재배치" API를 따로 만들지 않기 위한 선택 — 하루 일정은 보통 몇 개
  // 안 되니 여러 번 호출해도 체감 지연이 없다. 성공/실패 여부와 무관하게 끝나면
  // 서버 상태로 다시 맞춘다(reload).
  async function handleDragEnd({ data, from, to }: { data: TripPlace[]; from: number; to: number }) {
    if (from === to || !activeDayData) return;

    queryClient.setQueryData<TripDetail>(["trip", id], (current) => {
      if (!current) return current;
      return {
        ...current,
        days: current.days.map((d) => (d.day === currentActiveDay ? { ...d, places: data } : d)),
      };
    });

    const movedPlace = data[to];
    const direction = to > from ? "DOWN" : "UP";
    const steps = Math.abs(to - from);
    setBusy(true);
    setError(null);
    try {
      for (let i = 0; i < steps; i++) {
        await reorderTripPlace(movedPlace.id, direction);
      }
    } catch {
      setError("순서를 바꾸지 못했어요.");
    } finally {
      setBusy(false);
      await reload();
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
    setShowTimePicker(false);
    setEditingField(null);
  }

  // 도착 시간 하나만 받는다 — 종료 시간은 이 화면 어디에도 쓰이지 않아서(캘린더형
  // 블록 뷰가 아니라 리스트) 입력만 두 번 시키고 버려지는 값이었다.
  async function commitTime(place: TripPlace, selected: Date) {
    await handleUpdateDetails(place.id, { visitStartTime: toTimeString(selected) });
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

  async function handleOptimizeRoute() {
    if (busy || places.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await optimizeTripRoute(tripId, currentActiveDay);
      await reload();
    } catch {
      setError("동선을 최적화하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function renderPlaceItem({ item: place, getIndex, drag, isActive }: RenderItemParams<TripPlace>) {
    const index = getIndex() ?? 0;
    return (
      <View style={{ opacity: isActive ? 0.9 : 1 }}>
        <PlaceRow
          place={place}
          index={index}
          isLast={index === places.length - 1}
          distanceKm={null}
          editable
          disabled={busy}
          color={dayColor}
          dragHandle={{ onPressIn: drag }}
          onPressInfo={() => setReviewTarget({ kind: "tripPlace", id: place.id })}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 4 }}>
            <Pressable
              onPress={() => {
                setEditingField({ placeId: place.id, field: "time" });
                setTimeDraft(parseTimeToDate(place.visitStartTime));
                setShowTimePicker(true);
              }}
            >
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                {place.visitStartTime ? `${place.visitStartTime.slice(0, 5)} 도착` : "시간 추가"}
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
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>도착 시간</AppText>
              <DateTimePicker
                value={timeDraft ?? parseTimeToDate(place.visitStartTime)}
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
                    onPress={() => commitTime(place, timeDraft ?? parseTimeToDate(place.visitStartTime))}
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <DraggableFlatList
      data={places}
      keyExtractor={(item) => String(item.id)}
      onDragEnd={handleDragEnd}
      renderItem={renderPlaceItem}
      activationDistance={0}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 16 }}>
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

          <Pressable onPress={handleOptimizeRoute} disabled={busy || places.length < 2}>
            <AppText style={{ fontSize: 13, color: colors.accent, opacity: places.length < 2 ? 0.4 : 1 }}>
              동선 최적화
            </AppText>
          </Pressable>

          {error && <AppText style={{ color: colors.accent }}>{error}</AppText>}

          <InlineMap
            pins={places
              .filter((p) => p.latitude !== null && p.longitude !== null)
              .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }))}
            selectedId={reviewTarget?.kind === "tripPlace" ? String(reviewTarget.id) : null}
          />
        </View>
      }
      ListEmptyComponent={
        <AppText style={{ textAlign: "center", color: colors.inkMuted, padding: 16 }}>
          아직 장소가 없어요. 아래에서 검색해서 추가해보세요.
        </AppText>
      }
      ListFooterComponent={
        <View style={{ gap: 16, marginTop: 16 }}>
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
                    fontFamily: "NotoSansKR_400Regular",
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
                        <AppText style={{ fontSize: 18 }}>{bookmarkedPlaceIds.has(place.id) ? "⭐" : "☆"}</AppText>
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
                  <Pressable onPress={() => setReviewTarget({ kind: "place", id: place.id })}>
                    <AppText style={{ fontSize: 12, color: colors.accent }}>상세보기</AppText>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {bookmarksQuery.isError && (
                <QueryErrorView message="찜한 장소를 불러오지 못했어요." onRetry={() => bookmarksQuery.refetch()} />
              )}
              {!bookmarksQuery.isError && bookmarkFolderSections.length === 0 && (
                <AppText style={{ color: colors.inkMuted }}>아직 찜한 장소가 없어요.</AppText>
              )}
              {bookmarkFolderSections.map((section) => (
                <View key={section.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: section.color }} />
                    <AppText weight="medium" style={{ fontSize: 13, color: colors.inkMuted }}>
                      {section.name}
                    </AppText>
                  </View>
                  {section.bookmarks.map((bookmark) => (
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
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => setReviewTarget({ kind: "place", id: bookmark.placeId })}
                      >
                        <AppText weight="medium" numberOfLines={1}>
                          {bookmark.placeName}
                        </AppText>
                      </Pressable>
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
              ))}
            </View>
          )}

          <FolderPickerModal
            visible={folderPickerPlaceId !== null}
            onClose={() => setFolderPickerPlaceId(null)}
            onPick={handlePickFolder}
          />
        </View>
      }
    />
    <PlaceReviewSheet
      placeId={reviewTarget?.kind === "place" ? reviewTarget.id : null}
      tripPlaceId={reviewTarget?.kind === "tripPlace" ? reviewTarget.id : null}
      onClose={() => setReviewTarget(null)}
    />
    </View>
  );
}
