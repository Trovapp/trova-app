import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Platform, RefreshControl, TextInput, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AlternativeFinderSheet } from "@/components/AlternativeFinderSheet";
import { AppText, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { ConversationSheet } from "@/components/ConversationSheet";
import { FolderPickerModal } from "@/components/FolderPickerModal";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { PlaceReviewSheet } from "@/components/PlaceReviewModal";
import { QueryErrorView } from "@/components/QueryErrorView";
import { RatingBadge } from "@/components/RatingBadge";
import { Skeleton } from "@/components/Skeleton";
import { WeatherAlertBanner } from "@/components/WeatherAlertBanner";
import { getDayColor } from "@/lib/itinerary";
import { haptics } from "@/lib/haptics";
import { parseTimeToDate, toTimeString } from "@/lib/date";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatCount } from "@/lib/number";
import { kakaoMapUrl, openExternal, phoneUrl } from "@/lib/placeLinks";
import { colors } from "@/lib/theme";
import { addBookmark, invalidateBookmarkQueries, listBookmarks, listFolders, removeBookmark } from "@/lib/api/bookmarks";
import { searchPlaces, type RecommendedPlace } from "@/lib/api/recommendations";
import {
  addTripPlace,
  checkWeather,
  deleteTrip,
  getGapRecommendations,
  getTrip,
  insertPlaceAfter,
  optimizeTripRoute,
  removeTripPlace,
  reorderTripPlace,
  startTripReplan,
  updateTripPlaceDetails,
  type Gap,
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

export function TripDetailScreen({ route, navigation }: Props) {
  const { id, weatherAlertTripPlaceId } = route.params;
  const queryClient = useQueryClient();
  const tripQuery = useQuery({ queryKey: ["trip", id], queryFn: () => getTrip(id) });
  const { refreshing, onRefresh } = usePullToRefresh(tripQuery.refetch);
  const tripTitle = tripQuery.data?.title;

  // 여행 삭제 — 한번 만든 여행을 지울 방법이 없어 테스트/중복 여행이 계속 쌓이던 문제.
  // 되돌릴 수 없으니 확인을 받고, 성공하면 목록을 새로 받고 이 여행 캐시는 버린 뒤 뒤로 간다.
  useLayoutEffect(() => {
    function confirmDeleteTrip() {
      Alert.alert("여행을 삭제할까요?", `"${tripTitle ?? "이 여행"}"의 일정과 장소가 모두 사라지고 되돌릴 수 없어요.`, [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            haptics.warning();
            try {
              await deleteTrip(id);
              await queryClient.invalidateQueries({ queryKey: ["trips"] });
              queryClient.removeQueries({ queryKey: ["trip", id] });
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.replace("MainTabs");
            } catch {
              Alert.alert("삭제하지 못했어요", "잠시 후 다시 시도해주세요.");
            }
          },
        },
      ]);
    }
    navigation.setOptions({
      headerRight: () => (
        <PressableScale onPress={confirmDeleteTrip} hitSlop={10} disabled={!tripTitle}>
          <Feather name="trash-2" size={19} color={colors.inkMuted} />
        </PressableScale>
      ),
    });
  }, [navigation, id, tripTitle, queryClient]);

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
  // 마지막으로 성공한 검색어 — 결과 0건일 때 "검색 결과 없음"을 보여주는 데 쓴다.
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  // 검색결과 카드("장소 카탈로그")는 placeId로, 여행에 이미 담긴 장소 카드는
  // tripPlaceId로 리뷰 요약을 연다 — 서로 다른 id 공간이라 구분해서 들고 있는다.
  const [reviewTarget, setReviewTarget] = useState<{ kind: "place" | "tripPlace"; id: number } | null>(null);
  const [folderPickerPlaceId, setFolderPickerPlaceId] = useState<number | null>(null);
  const [alternativeTargetId, setAlternativeTargetId] = useState<number | null>(null);
  const [alternativeInitialIndoor, setAlternativeInitialIndoor] = useState(false);
  // 홈의 날씨 알림("○○ 근처 실내 대안을 확인해보세요")에서 들어온 경우 — 예전엔 장소 정보를 버리고
  // 여행 상세 1일차 맨 위로만 와서, 비 오는 날짜와 장소를 직접 찾아 대안 찾기를 열어야 했다.
  // 이 화면 안의 날씨 배너와 똑같이 해당 날짜로 옮기고 실내 대안 찾기를 한 번만 연다.
  const handledWeatherAlertRef = useRef(false);
  useEffect(() => {
    const days = tripQuery.data?.days;
    if (!weatherAlertTripPlaceId || !days || handledWeatherAlertRef.current) return;
    handledWeatherAlertRef.current = true;
    const day = days.find((d) => d.places.some((p) => p.id === weatherAlertTripPlaceId));
    if (!day) return; // 그 사이 장소가 삭제된 경우엔 여행 상세만 보여준다.
    setActiveDay(day.day);
    setReviewTarget(null);
    setAlternativeInitialIndoor(true);
    setAlternativeTargetId(weatherAlertTripPlaceId);
  }, [weatherAlertTripPlaceId, tripQuery.data]);
  const [assistantTargetId, setAssistantTargetId] = useState<number | null>(null);
  const [gapCardFor, setGapCardFor] = useState<Gap | null>(null);
  const [replanStarting, setReplanStarting] = useState(false);
  // 장소 카드 "⋮" 더보기 메뉴(대안 찾기/비서/삭제) — 자주 안 쓰는 동작들을
  // 카드에 아이콘으로 늘어놓는 대신 여기 하나로 모은다.
  const [menuPlaceId, setMenuPlaceId] = useState<number | null>(null);

  const gapSheetRef = useRef<BottomSheetModal>(null);
  useEffect(() => {
    if (gapCardFor !== null) {
      gapSheetRef.current?.present();
    } else {
      gapSheetRef.current?.dismiss();
    }
  }, [gapCardFor]);

  // "⋮" 메뉴는 누를 때 바로 present()한다. 예전엔 menuPlaceId 변화를 effect로 보고 열고 닫았는데,
  // 시트가 닫히며 onDismiss가 값을 null로 되돌리면 effect가 이미 닫힌 시트에 dismiss()를 한 번 더 불러
  // 라이브러리 내부 상태가 꼬였고, 그 뒤로는 "⋮"를 눌러도 메뉴가 다시 열리지 않았다(실제 탭으로 재현).
  // 닫기는 각 메뉴 항목과 바깥 탭(backdrop)이 직접 한다.
  const menuSheetRef = useRef<BottomSheetModal>(null);
  function openPlaceMenu(placeId: number) {
    setMenuPlaceId(placeId);
    menuSheetRef.current?.present();
  }

  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const foldersQuery = useQuery({ queryKey: ["bookmarkFolders"], queryFn: listFolders });
  // trip이 아직 로딩/에러 상태일 수 있어(아래 early return 이전) tripId/day를 여기서
  // 확정할 수 없다 — early return 뒤에 훅을 두면 Rules of Hooks를 어기게 되므로,
  // trip이 준비되기 전엔 enabled:false로 대기시키고 준비되면 자동으로 다시 불린다.
  const currentTrip = tripQuery.data;
  const currentDay = activeDay ?? currentTrip?.days[0]?.day ?? 1;
  const gapRecommendationsQuery = useQuery({
    queryKey: ["gapRecommendations", currentTrip?.id, currentDay],
    queryFn: () => getGapRecommendations(currentTrip!.id, currentDay),
    enabled: currentTrip !== undefined,
  });
  const bookmarkedPlaceIds = new Set((bookmarksQuery.data ?? []).map((b) => b.placeId));

  const trip = tripQuery.data;

  if (tripQuery.isLoading) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Skeleton style={{ width: "60%", height: 20 }} />
        <Skeleton style={{ height: 180, borderRadius: 12 }} />
        <Skeleton style={{ height: 64, borderRadius: 12 }} />
        <Skeleton style={{ height: 64, borderRadius: 12 }} />
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
  // 추가해도 새 장소는 화면 위쪽 목록에 들어가서, 아래에서 검색하던 사용자는 추가됐는지 알기 어렵고
  // 한 번 더 눌러 같은 장소가 중복으로 들어가곤 했다 — 이 날짜에 이미 있는 장소는 "추가됨"으로 보여준다.
  // (다른 날짜에 같은 장소를 다시 넣는 건 재방문일 수 있어 막지 않는다.)
  const addedGooglePlaceIds = new Set(places.map((p) => p.googlePlaceId).filter((id): id is string => id !== null));
  const menuPlace = places.find((p) => p.id === menuPlaceId) ?? null;
  const dayColor = getDayColor(currentActiveDay);
  const tripId = trip.id;
  const totalPlaceCount = trip.days.reduce((sum, d) => sum + d.places.length, 0);

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
    const trimmed = query.trim();
    if (!trimmed || searching) return;
    setSearching(true);
    setError(null);
    try {
      setSearchResults(await searchPlaces(trimmed));
      setSearchedQuery(trimmed);
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
      await invalidateBookmarkQueries(queryClient);
    } catch {
      setError("찜하기에 실패했어요.");
    }
  }

  async function handleRemoveBookmark(bookmarkId: number) {
    haptics.warning();
    try {
      await removeBookmark(bookmarkId);
      await invalidateBookmarkQueries(queryClient);
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
    haptics.light();

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
    haptics.warning();
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

  function handleStartReplan() {
    if (replanStarting) return;
    Alert.alert(
      "전체 일정 재구성",
      "이 여행에 있는 장소들의 카테고리에 맞춰, 취향에 맞을 만한 다른 장소를 추천해드려요. 완료되면 장소마다 교체하거나 건너뛸 수 있고, 확정한 뒤엔 동선도 자동으로 다시 정리돼요.",
      [
        { text: "취소", style: "cancel" },
        { text: "시작", onPress: () => startReplan() },
      ]
    );
  }

  async function startReplan() {
    setReplanStarting(true);
    setError(null);
    try {
      const { jobId } = await startTripReplan(tripId);
      navigation.navigate("TripReplan", { tripId, jobId });
    } catch {
      setError("일정 재구성을 시작하지 못했어요.");
    } finally {
      setReplanStarting(false);
    }
  }

  function renderPlaceItem({ item: place, getIndex, drag, isActive }: RenderItemParams<TripPlace>) {
    const index = getIndex() ?? 0;
    const gap = (gapRecommendationsQuery.data ?? []).find((g) => g.beforePlaceId === place.id);
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
          onPressInfo={() => {
            setAlternativeTargetId(null);
            setReviewTarget({ kind: "tripPlace", id: place.id });
          }}
          onOpenMenu={() => openPlaceMenu(place.id)}
          showLinks={false}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 4 }}>
            <PressableScale
              onPress={() => {
                setEditingField({ placeId: place.id, field: "time" });
                setTimeDraft(parseTimeToDate(place.visitStartTime));
                setShowTimePicker(true);
              }}
            >
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                {place.visitStartTime ? `${place.visitStartTime.slice(0, 5)} 도착` : "시간 추가"}
              </AppText>
            </PressableScale>

            <PressableScale
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
            </PressableScale>

            <PressableScale
              onPress={() => {
                setMemoDraft(place.memo ?? "");
                setEditingField({ placeId: place.id, field: "memo" });
              }}
            >
              <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                {place.memo || "메모 추가"}
              </AppText>
            </PressableScale>
          </View>

          {editingField?.placeId === place.id && editingField.field === "transport" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              {(["WALK", "TRANSIT", "CAR"] as const).map((mode) => (
                <PressableScale
                  key={mode}
                  onPress={() => handleUpdateDetails(place.id, { arrivalTransportMode: mode })}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                    backgroundColor: place.arrivalTransportMode === mode ? colors.accent : colors.bgMuted,
                  }}
                >
                  <AppText style={{ fontSize: 11, color: place.arrivalTransportMode === mode ? colors.onAccent : colors.inkMuted }}>
                    {TRANSPORT_LABEL[mode]}
                  </AppText>
                </PressableScale>
              ))}
            </View>
          )}

          {editingField?.placeId === place.id && editingField.field === "memo" && (
            <TextInput
              maxFontSizeMultiplier={MAX_FONT_SCALE}
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
                locale="ko-KR"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onValueChange={(_, selected) => {
                  if (Platform.OS === "ios") {
                    // 드래그 중간값 — 저장하지 않고 담아만 둔다.
                    setTimeDraft(selected);
                    return;
                  }
                  // Android는 모달이라 "확인"을 눌렀을 때만 온다(취소는 onDismiss).
                  commitTime(place, selected);
                }}
                onDismiss={closeTimePicker}
              />
              {Platform.OS === "ios" && (
                <View style={{ flexDirection: "row", gap: 16, justifyContent: "flex-end" }}>
                  <PressableScale onPress={closeTimePicker} disabled={busy}>
                    <AppText style={{ fontSize: 13, color: colors.inkMuted }}>취소</AppText>
                  </PressableScale>
                  <PressableScale
                    onPress={() => commitTime(place, timeDraft ?? parseTimeToDate(place.visitStartTime))}
                    disabled={busy}
                    style={{ opacity: busy ? 0.4 : 1 }}
                  >
                    <AppText weight="medium" style={{ fontSize: 13, color: colors.accent }}>
                      확인
                    </AppText>
                  </PressableScale>
                </View>
              )}
            </View>
          )}
        </PlaceRow>
        {gap && gap.recommendations.length > 0 && (
          <PressableScale
            onPress={() => setGapCardFor(gap)}
            style={{
              marginLeft: 38,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
            }}
          >
            <AppText style={{ fontSize: 12, color: colors.accent }}>
              {gap.gapMinutes}분 비어요 — 이 사이 갈 곳 추천받기
            </AppText>
          </PressableScale>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <DraggableFlatList keyboardShouldPersistTaps="handled"
      data={places}
      keyExtractor={(item) => String(item.id)}
      onDragEnd={handleDragEnd}
      renderItem={renderPlaceItem}
      activationDistance={0}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
              {trip.days.map((d) => (
                <PressableScale
                  key={d.day}
                  onPress={() => setActiveDay(d.day)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    backgroundColor: d.day === currentActiveDay ? colors.accent : colors.bgMuted,
                  }}
                >
                  <AppText weight="medium" style={{ color: d.day === currentActiveDay ? colors.onAccent : colors.inkMuted, fontSize: 13 }}>
                    {d.day}일차{d.date ? ` (${d.date.slice(5)})` : ""}
                  </AppText>
                </PressableScale>
              ))}
            </View>
            <PressableScale onPress={handleCheckWeather} disabled={busy || !activeDayData?.date}>
              <AppText style={{ fontSize: 13, color: colors.accent, opacity: !activeDayData?.date ? 0.4 : 1 }}>날씨 확인</AppText>
            </PressableScale>
          </View>

          <PressableScale
            onPress={handleStartReplan}
            disabled={replanStarting || totalPlaceCount === 0}
            style={{
              flexDirection: "row",
              height: 44,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
              opacity: replanStarting || totalPlaceCount === 0 ? 0.4 : 1,
            }}
          >
            {!replanStarting && <Feather name="refresh-cw" size={15} color={colors.accent} />}
            <AppText weight="medium" style={{ color: colors.accent, fontSize: 14 }}>
              {replanStarting ? "시작하는 중..." : "전체 일정 재구성"}
            </AppText>
          </PressableScale>

          <WeatherAlertBanner
            tripId={tripId}
            onOpenAlternative={(_tripId, tripPlaceId) => {
              setReviewTarget(null);
              setAlternativeInitialIndoor(true);
              setAlternativeTargetId(tripPlaceId);
            }}
          />

          {weatherMessage && (
            <View style={{ padding: 10, borderRadius: 8, backgroundColor: colors.accentBg }}>
              <AppText style={{ fontSize: 13 }}>{weatherMessage}</AppText>
            </View>
          )}

          <PressableScale onPress={handleOptimizeRoute} disabled={busy || places.length < 2}>
            <AppText style={{ fontSize: 13, color: colors.accent, opacity: places.length < 2 ? 0.4 : 1 }}>
              동선 최적화
            </AppText>
          </PressableScale>

          {error && <ErrorText>{error}</ErrorText>}

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
            <PressableScale onPress={() => setActiveTab("search")}>
              <AppText weight="medium" style={{ color: activeTab === "search" ? colors.accent : colors.inkMuted }}>
                검색
              </AppText>
            </PressableScale>
            <PressableScale onPress={() => setActiveTab("bookmarks")}>
              <AppText weight="medium" style={{ color: activeTab === "bookmarks" ? colors.accent : colors.inkMuted }}>
                찜한 장소
              </AppText>
            </PressableScale>
          </View>
          {activeTab === "search" ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="장소 이름으로 검색 (예: 경복궁)"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
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
                <PressableScale
                  onPress={handleSearch}
                  disabled={searching || !query.trim()}
                  style={{
                    height: 40,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    backgroundColor: colors.accent,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: searching || !query.trim() ? 0.6 : 1,
                  }}
                >
                  <AppText weight="medium" style={{ color: colors.onAccent }}>
                    {searching ? "검색 중..." : "검색"}
                  </AppText>
                </PressableScale>
              </View>

              {searchedQuery !== null && !searching && searchResults.length === 0 && (
                <AppText style={{ color: colors.inkMuted }}>
                  '{searchedQuery}' 검색 결과가 없어요. 다른 이름으로 검색해보세요.
                </AppText>
              )}

              {/* 위쪽 일정 목록과 같은 구분선 리스트(테두리 카드 X) — 한 화면 안에서 스타일이 섞이지 않게. */}
              <View>
                {searchResults.map((place, index) => (
                  <View
                    key={place.id}
                    style={{
                      paddingVertical: 12,
                      gap: 6,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
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
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <RatingBadge rating={place.rating} />
                            {place.userRatingCount !== null && (
                              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                                (리뷰 {formatCount(place.userRatingCount)}개)
                              </AppText>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        <PressableScale onPress={() => handleToggleBookmark(place.id)} hitSlop={{ top: 13, bottom: 13, left: 13, right: 4 }}>
                          <Feather
                            name="star"
                            size={18}
                            color={bookmarkedPlaceIds.has(place.id) ? colors.accent : colors.border}
                          />
                        </PressableScale>
                        <AddToDayButton
                          added={addedGooglePlaceIds.has(place.googlePlaceId)}
                          disabled={busy}
                          onPress={() => handleAddPlace(place.googlePlaceId)}
                        />
                      </View>
                    </View>
                    <PressableScale
                      onPress={() => {
                        setAlternativeTargetId(null);
                        setReviewTarget({ kind: "place", id: place.id });
                      }}
                      hitSlop={{ top: 10, bottom: 10, right: 10 }}
                    >
                      <AppText style={{ fontSize: 12, color: colors.accent }}>상세보기</AppText>
                    </PressableScale>
                  </View>
                ))}
              </View>
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
                  <View>
                    {section.bookmarks.map((bookmark, index) => (
                      <View
                        key={bookmark.id}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingVertical: 12,
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: colors.borderSubtle,
                        }}
                      >
                        <PressableScale
                          style={{ flex: 1 }}
                          onPress={() => {
                            setAlternativeTargetId(null);
                            setReviewTarget({ kind: "place", id: bookmark.placeId });
                          }}
                        >
                          <AppText weight="medium" numberOfLines={1}>
                            {bookmark.placeName}
                          </AppText>
                        </PressableScale>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <AddToDayButton
                            added={addedGooglePlaceIds.has(bookmark.googlePlaceId)}
                            disabled={busy}
                            onPress={() => handleAddPlace(bookmark.googlePlaceId)}
                          />
                          <PressableScale
                            onPress={() =>
                              Alert.alert("찜을 해제할까요?", `"${bookmark.placeName}"을(를) 찜한 장소에서 뺍니다.`, [
                                { text: "취소", style: "cancel" },
                                { text: "해제", style: "destructive", onPress: () => handleRemoveBookmark(bookmark.id) },
                              ])
                            }
                            hitSlop={{ top: 12, bottom: 12, left: 4, right: 12 }}>
                            <AppText style={{ fontSize: 12, color: colors.inkMuted }}>찜 해제</AppText>
                          </PressableScale>
                        </View>
                      </View>
                    ))}
                  </View>
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
    <AlternativeFinderSheet
      tripPlaceId={alternativeTargetId}
      initialIndoor={alternativeInitialIndoor}
      onReplaced={() => {
        setAlternativeTargetId(null);
        reload();
      }}
      onClose={() => setAlternativeTargetId(null)}
    />
    <ConversationSheet
      tripId={tripId}
      tripPlaceId={assistantTargetId}
      onReplaced={() => {
        setAssistantTargetId(null);
        reload();
      }}
      onClose={() => setAssistantTargetId(null)}
    />
    <BottomSheetModal
      ref={menuSheetRef}
      enableDynamicSizing
      onDismiss={() => {
        setMenuPlaceId(null);
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: 8, paddingBottom: 32 }}>
        <AppText weight="medium" numberOfLines={1} style={{ padding: 12, color: colors.inkMuted, fontSize: 13 }}>
          {menuPlace?.placeName}
        </AppText>
        <PressableScale
          onPress={() => {
            if (!menuPlace) return;
            setReviewTarget(null);
            setAlternativeInitialIndoor(false);
            setAlternativeTargetId(menuPlace.id);
            menuSheetRef.current?.dismiss();
          }}
          style={{ padding: 14 }}
        >
          <AppText>대안 찾기</AppText>
        </PressableScale>
        <PressableScale
          onPress={() => {
            if (!menuPlace) return;
            setReviewTarget(null);
            setAlternativeTargetId(null);
            setAssistantTargetId(menuPlace.id);
            menuSheetRef.current?.dismiss();
          }}
          style={{ padding: 14 }}
        >
          <AppText>비서에게 물어보기</AppText>
        </PressableScale>
        {/* 행에 링크 줄까지 붙으면 장소 하나가 네 줄이 돼서, 가끔 쓰는 외부 링크는 메뉴로 옮겼다. */}
        {menuPlace && kakaoMapUrl(menuPlace) && (
          <PressableScale
            onPress={() => {
              const url = kakaoMapUrl(menuPlace);
              menuSheetRef.current?.dismiss();
              if (url) openExternal(url);
            }}
            style={{ padding: 14 }}
          >
            <AppText>카카오맵에서 보기</AppText>
          </PressableScale>
        )}
        {menuPlace && phoneUrl(menuPlace) && (
          <PressableScale
            onPress={() => {
              const url = phoneUrl(menuPlace);
              menuSheetRef.current?.dismiss();
              if (url) openExternal(url);
            }}
            style={{ padding: 14 }}
          >
            <AppText>전화 걸기</AppText>
          </PressableScale>
        )}
        <PressableScale
          onPress={() => {
            const target = menuPlace;
            menuSheetRef.current?.dismiss();
            if (!target) return;
            Alert.alert("장소를 삭제할까요?", `"${target.placeName}"을(를) 일정에서 삭제합니다.`, [
              { text: "취소", style: "cancel" },
              { text: "삭제", style: "destructive", onPress: () => handleRemove(target.id) },
            ]);
          }}
          style={{ padding: 14 }}
        >
          <AppText style={{ color: colors.accent }}>삭제</AppText>
        </PressableScale>
      </BottomSheetView>
    </BottomSheetModal>
    <BottomSheetModal
      ref={gapSheetRef}
      enableDynamicSizing
      onDismiss={() => setGapCardFor(null)}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: 16, paddingBottom: 32, gap: 10 }}>
        <AppText weight="medium">이 사이 갈 만한 곳</AppText>
        {error && <ErrorText>{error}</ErrorText>}
        {gapCardFor?.recommendations.map((r) => (
          <PressableScale
            key={r.placeId}
            disabled={busy}
            onPress={async () => {
              if (!gapCardFor || busy) return;
              setBusy(true);
              setError(null);
              try {
                await insertPlaceAfter(gapCardFor.beforePlaceId, r.googlePlaceId);
                // 성공했을 때만 닫는다 — 실패하면 에러 메시지를 보여준 채로 시트를
                // 열어둬서 사용자가 다른 후보를 다시 고를 수 있게 한다.
                setGapCardFor(null);
                await reload();
                await queryClient.invalidateQueries({ queryKey: ["gapRecommendations", tripId, currentActiveDay] });
              } catch {
                setError("장소를 추가하지 못했어요.");
              } finally {
                setBusy(false);
              }
            }}
            style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, opacity: busy ? 0.6 : 1 }}
          >
            <AppText weight="medium" numberOfLines={1}>{r.name}</AppText>
            {r.address && <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{r.address}</AppText>}
          </PressableScale>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
    </View>
  );
}

function AddToDayButton({ added, disabled, onPress }: { added: boolean; disabled: boolean; onPress: () => void }) {
  const box = { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 } as const;
  if (added) {
    return (
      <View style={[box, { borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 3 }]}>
        <Feather name="check" size={12} color={colors.inkMuted} />
        <AppText style={{ fontSize: 12, color: colors.inkMuted }}>추가됨</AppText>
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={[box, { borderColor: colors.accent, backgroundColor: colors.accent }]}>
      <AppText style={{ fontSize: 12, color: colors.onAccent }}>추가</AppText>
    </PressableScale>
  );
}
