import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, RefreshControl, ScrollView, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AlternativeFinderSheet } from "@/components/AlternativeFinderSheet";
import { AppText, FONT, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { ConversationSheet } from "@/components/ConversationSheet";
import { FolderPickerModal } from "@/components/FolderPickerModal";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { PlaceReviewSheet } from "@/components/PlaceReviewModal";
import { QueryErrorView } from "@/components/QueryErrorView";
import { StaleNotice } from "@/components/StaleNotice";
import { RatingBadge } from "@/components/RatingBadge";
import { Skeleton } from "@/components/Skeleton";
import { WeatherAlertBanner } from "@/components/WeatherAlertBanner";
import { getDayColor } from "@/lib/itinerary";
import { haptics } from "@/lib/haptics";
import { objectParticle } from "@/lib/korean";
import { parseTimeToDate, toTimeString } from "@/lib/date";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatCount } from "@/lib/number";
import { kakaoMapUrl, openExternal, phoneUrl } from "@/lib/placeLinks";
import { toUserMessage } from "@/lib/api/client";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { addBookmark, invalidateBookmarkQueries, listBookmarks, listFolders, removeBookmark } from "@/lib/api/bookmarks";
import { searchPlaces, type RecommendedPlace } from "@/lib/api/recommendations";
import {
  addTripPlace,
  checkWeather,
  deleteTrip,
  getGapRecommendations,
  getTrip,
  insertPlaceAfter,
  invalidateTripPlaceChangeQueries,
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
import { hitSlopFor } from "@/lib/touch";

type Props = NativeStackScreenProps<RootStackParamList, "TripDetail">;

// 지도를 뒤에 꽉 채우고 일정은 끌어올리는 시트에 담는다(2026-10, 영상 속 장소 화면과 같은 구성. 참고: Plotline 일정 화면).
const SHEET_DEFAULT_PERCENT = 55;
const SHEET_SNAP_POINTS = ["18%", `${SHEET_DEFAULT_PERCENT}%`, "90%"];

const TRANSPORT_LABEL: Record<"WALK" | "TRANSIT" | "CAR", string> = {
  WALK: "도보",
  TRANSIT: "대중교통",
  CAR: "차량",
};

const UNSORTED_ID = -1; // "미분류" 가상 폴더 id — 저장 장소 화면(SavedPlacesScreen)과 동일한 규칙.

type EditingField = { placeId: number; field: "time" | "stay" | "transport" | "memo" } | null;

// 머무는 시간 선택지(분). 떠나는 시간 = 도착 + 머무는 시간으로 저장한다.
// 빈 시간 추천은 "앞 장소 떠나는 시간 ~ 다음 장소 도착 시간"이 30분 넘을 때만 뜨는데, 앱에 떠나는 시간을 넣는 곳이
// 없어 실제 사용자에게는 한 번도 뜰 수 없었다(2026-10 확인: 운영 여행 장소 24곳 중 떠나는 시간 2곳, 모두 API로 넣은 시험값).
const STAY_OPTIONS = [30, 60, 90, 120, 180] as const;

function formatStay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}분` : m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// 자정을 넘기면 23:59로 맞춘다(서버의 시간 칸은 날짜 없는 시각이라 다음 날로 넘길 수 없다).
function addMinutes(hhmm: string, minutes: number): string {
  const total = Math.min(toMinutes(hhmm) + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function stayMinutes(place: { visitStartTime: string | null; visitEndTime: string | null }): number | null {
  if (!place.visitStartTime || !place.visitEndTime) return null;
  const diff = toMinutes(place.visitEndTime.slice(0, 5)) - toMinutes(place.visitStartTime.slice(0, 5));
  return diff > 0 ? diff : null;
}

export function TripDetailScreen({ route, navigation }: Props) {
  const { id, weatherAlertTripPlaceId } = route.params;
  const queryClient = useQueryClient();
  const tripQuery = useQuery({ queryKey: ["trip", id], queryFn: () => getTrip(id) });
  const { refreshing, onRefresh } = usePullToRefresh(tripQuery.refetch);
  const tripTitle = tripQuery.data?.title;

  // 여행 삭제 — 한번 만든 여행을 지울 방법이 없어 테스트/중복 여행이 계속 쌓이던 문제.
  // 되돌릴 수 없으니 확인을 받고, 성공하면 목록을 새로 받고 이 여행 캐시는 버린 뒤 뒤로 간다.
  // 헤더에 휴지통을 바로 두지 않고 ⋯ 메뉴 안에 둔다 — 찜 폴더 삭제(⋮ 메뉴)와 같은 방식(디자인 QA T1).
  const tripMenuSheetRef = useRef<BottomSheetModal>(null);
  const confirmDeleteTripRef = useRef<() => void>(() => {});
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
              // 영상 속 장소 화면의 "이 영상으로 만든 여행" 표시도 지운 여행을 가리키지 않게 한다.
              await queryClient.invalidateQueries({ queryKey: ["videoTrip"] });
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
    confirmDeleteTripRef.current = confirmDeleteTrip;
    navigation.setOptions({
      // 화면 어디에도 여행 이름이 없어 어떤 여행을 보고 있는지 알 수 없었다(2026-10 QA) — 헤더 제목으로 보여준다.
      // 긴 이름은 iOS 헤더가 말줄임표로 줄인다. 불러오기 전에는 원래 제목을 둔다.
      title: tripTitle ?? "여행 상세",
      headerRight: () => (
        <PressableScale
          onPress={() => tripMenuSheetRef.current?.present()}
          hitSlop={hitSlopFor(20)}
          disabled={!tripTitle}
          accessibilityLabel="여행 메뉴"
        >
          <Feather name="more-horizontal" size={20} color={colors.inkMuted} />
        </PressableScale>
      ),
    });
  }, [navigation, id, tripTitle, queryClient]);

  // 목록 맨 아래의 장소 검색창이 키보드에 가렸다(디자인 QA K1). 목록이 BottomSheetView 안에서 내용 높이만큼 늘어나 스크롤되지
  // 않았다(로그: 목록 높이 = 내용 높이). 목록을 시트 높이에 맞추고, 키보드 높이만큼 아래 여백을 더한 뒤, 검색창이 입력 중일 때
  // 키보드가 뜨면 여백이 그려진 뒤(onContentSizeChange) 목록을 끝까지 내린다. 여백을 빼면 다시 가려졌다(시뮬레이터에서 확인).
  // 같은 원인으로 장소가 많은 날은 아래 장소가 시트 밖으로 잘려 스크롤로도 못 봤을 수 있다(목록이 시트 높이를 넘어 늘어났음).
  // DraggableFlatList의 ref는 gesture-handler FlatList 타입이라, 쓰는 scrollToOffset만 좁혀 둔다.
  const listRef = useRef<{
    scrollToOffset: (options: { offset: number; animated?: boolean }) => void;
    scrollToIndex: (options: { index: number; viewPosition?: number; animated?: boolean }) => void;
  } | null>(null);
  // BottomSheetTextInput의 ref도 gesture-handler 타입이라, 쓰는 isFocused만 좁혀 둔다.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollToSearchRef = useRef(false);
  const contentHeightRef = useRef(0);
  const searchInputRef = useRef<{ isFocused: () => boolean } | null>(null);
  // 메모 입력창은 그 장소 줄 바로 아래에 열려서, 아래쪽 장소의 메모를 고치면 키보드에 가렸다(#134 QA, 영상 메모가 여러 줄이라 더 잘 보임).
  // 검색창과 같은 방식으로, 키보드 여백이 붙은 뒤 고치는 장소를 목록 맨 위로 올린다. 입력창이 생길 때도 높이가 한 번 늘어나므로
  // (로그로 확인) 키보드가 뜬 뒤에만 내린다.
  const memoEditIndexRef = useRef<number | null>(null);
  const scrollToMemoRef = useRef(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // BottomSheetTextInput은 onFocus를 넘겨주지 않아(로그로 확인), 키보드가 뜰 때 검색창이 입력 중인지 본다.
      // 늘린 아래 여백이 그려진 뒤에 내려야 해서(고정 시간 대기는 됐다 안 됐다 함), 목록 내용 높이가 바뀔 때 내린다.
      if (searchInputRef.current?.isFocused()) {
        scrollToSearchRef.current = true;
      } else if (memoEditIndexRef.current !== null) {
        scrollToMemoRef.current = true;
      }
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      scrollToSearchRef.current = false;
      scrollToMemoRef.current = false;
      memoEditIndexRef.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
  // 열려 있지 않은 시트에 dismiss()를 부르면 뒤의 present()가 무시된다(아래 ⋮ 메뉴 설명, 2026-10-04 폴더 선택에서도 재현) —
  // 지금 열려 있을 때만 닫고, 드래그·바깥 탭으로 닫히면 onDismiss에서 표시를 지운다.
  const gapSheetOpen = useRef(false);
  useEffect(() => {
    if (gapCardFor !== null) {
      gapSheetOpen.current = true;
      gapSheetRef.current?.present();
    } else if (gapSheetOpen.current) {
      gapSheetOpen.current = false;
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
      <View style={{ flex: 1, padding: space.md, gap: space.sm }}>
        <Skeleton style={{ width: "60%", height: 20 }} />
        <Skeleton style={{ height: 180, borderRadius: radius.md }} />
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
      </View>
    );
  }

  // 조회 실패와 "아직 데이터 없음"을 같은 화면으로 보여주지 않는다.
  // 받아 둔 여행이 있으면 오류 화면 대신 지도 위에 한 줄만 알린다(디자인 QA E1).
  if (!trip) {
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
    } catch (err) {
      setError(toUserMessage(err, "장소를 찾지 못했어요. 다른 검색어로 시도해보세요."));
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
      await invalidateTripPlaceChangeQueries(queryClient);
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
    const start = toTimeString(selected);
    // 머무는 시간을 이미 정했으면 도착 시간을 옮길 때 떠나는 시간도 같이 옮긴다 — 떠나는 시간이 도착보다 앞서지 않게.
    const stay = stayMinutes(place);
    await handleUpdateDetails(place.id, stay !== null ? { visitStartTime: start, visitEndTime: addMinutes(start, stay) } : { visitStartTime: start });
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
    } catch (err) {
      setError(toUserMessage(err, "일정 재구성을 시작하지 못했어요."));
    } finally {
      setReplanStarting(false);
    }
  }

  // 행의 값이나 ⋮ 메뉴에서 시간·이동수단·메모 편집을 연다(행 안의 편집기는 그대로 쓴다).
  function startEditing(place: TripPlace, field: "time" | "stay" | "transport" | "memo") {
    // 머무는 시간은 도착 시간을 기준으로 계산한다 — 도착 시간이 없으면 도착 시간부터 정하게 한다.
    if (field === "stay" && !place.visitStartTime) {
      field = "time";
    }
    if (field === "stay") {
      setEditingField(editingField?.placeId === place.id && editingField.field === "stay" ? null : { placeId: place.id, field: "stay" });
    } else if (field === "time") {
      setEditingField({ placeId: place.id, field: "time" });
      setTimeDraft(parseTimeToDate(place.visitStartTime));
      setShowTimePicker(true);
    } else if (field === "transport") {
      setEditingField(editingField?.placeId === place.id && editingField.field === "transport" ? null : { placeId: place.id, field: "transport" });
    } else {
      setMemoDraft(place.memo ?? "");
      setEditingField({ placeId: place.id, field: "memo" });
      memoEditIndexRef.current = places.findIndex((p) => p.id === place.id);
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
          {/* 예전엔 장소마다 "시간 추가 · 이동수단 추가 · 메모 추가" 글자 버튼이 붙어 장소 하나가 여러 줄이 됐다(2026-10).
              정하는 동작은 ⋮ 메뉴로 모으고, 행에는 이미 정한 값만 보여준다. 값을 누르면 바로 고칠 수 있다. */}
          {(place.visitStartTime || place.arrivalTransportMode || place.memo) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center", marginTop: space.xxs }}>
              {place.visitStartTime && (
                <PressableScale onPress={() => startEditing(place, "time")} style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                  <Feather name="clock" size={12} color={colors.inkMuted} />
                  <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                    {stayMinutes(place) !== null
                      ? `${place.visitStartTime.slice(0, 5)}–${place.visitEndTime!.slice(0, 5)} (${formatStay(stayMinutes(place)!)})`
                      : `${place.visitStartTime.slice(0, 5)} 도착`}
                  </AppText>
                </PressableScale>
              )}
              {place.arrivalTransportMode && (
                <PressableScale onPress={() => startEditing(place, "transport")} style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                  <Feather name="navigation" size={12} color={colors.inkMuted} />
                  <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{TRANSPORT_LABEL[place.arrivalTransportMode]}</AppText>
                </PressableScale>
              )}
              {place.memo && (
                // 영상에서 말한 내용이 "· 내용" 여러 줄로 들어온다(백엔드 #134) — 한 줄만 보이면 첫 줄만 남아서 3줄까지 보인다.
                <PressableScale onPress={() => startEditing(place, "memo")} style={{ flexDirection: "row", alignItems: "flex-start", gap: space.xxs, flexBasis: "100%", flexShrink: 1 }}>
                  <Feather name="edit-3" size={12} color={colors.inkMuted} style={{ marginTop: space.xxxs }} />
                  <AppText style={{ flexShrink: 1, fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={3}>
                    {place.memo}
                  </AppText>
                </PressableScale>
              )}
            </View>
          )}

          {editingField?.placeId === place.id && editingField.field === "stay" && place.visitStartTime && (
            <View style={{ marginTop: space.xs, gap: space.xxs }}>
              <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                머무는 시간 · {place.visitStartTime.slice(0, 5)} 도착
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {STAY_OPTIONS.map((minutes) => {
                  const selected = stayMinutes(place) === minutes;
                  return (
                    <PressableScale
                      key={minutes}
                      onPress={() => handleUpdateDetails(place.id, { visitEndTime: addMinutes(place.visitStartTime!.slice(0, 5), minutes) })}
                      disabled={busy}
                      style={{
                        paddingVertical: space.xxs,
                        paddingHorizontal: space.sm,
                        borderRadius: radius.md,
                        backgroundColor: selected ? colors.accent : colors.bgMuted,
                      }}
                    >
                      <AppText style={{ fontSize: fontSize.caption2, color: selected ? colors.onAccent : colors.inkMuted }}>
                        {formatStay(minutes)}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          )}

          {editingField?.placeId === place.id && editingField.field === "transport" && (
            <View style={{ flexDirection: "row", gap: space.xs, marginTop: space.xs }}>
              {(["WALK", "TRANSIT", "CAR"] as const).map((mode) => (
                <PressableScale
                  key={mode}
                  onPress={() => handleUpdateDetails(place.id, { arrivalTransportMode: mode })}
                  style={{
                    paddingVertical: space.xxs,
                    paddingHorizontal: space.sm,
                    borderRadius: radius.md,
                    backgroundColor: place.arrivalTransportMode === mode ? colors.accent : colors.bgMuted,
                  }}
                >
                  <AppText style={{ fontSize: fontSize.caption2, color: place.arrivalTransportMode === mode ? colors.onAccent : colors.inkMuted }}>
                    {TRANSPORT_LABEL[mode]}
                  </AppText>
                </PressableScale>
              ))}
            </View>
          )}

          {editingField?.placeId === place.id && editingField.field === "memo" && (
            // 언제 저장되는지 안 보이고(리턴 키가 "↵"), 바깥을 눌러도 키보드가 안 닫혔다(디자인 QA K2·K3).
            // 안내 문구·"완료" 리턴 키·완료 버튼을 둔다. 저장은 지금처럼 입력이 끝날 때(blur) 한 번 한다.
            <View style={{ marginTop: space.xs, flexDirection: "row", alignItems: "flex-end", gap: space.xs }}>
              <BottomSheetTextInput
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                autoFocus
                defaultValue={memoDraft}
                onChangeText={setMemoDraft}
                placeholder="메모를 적고 완료를 누르세요"
                placeholderTextColor={colors.inkMuted}
                // 영상 메모처럼 여러 줄인 메모도 그대로 고칠 수 있게 여러 줄 입력. 리턴 키는 그대로 "완료"(줄바꿈 대신 닫기).
                multiline
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                onBlur={() => handleUpdateDetails(place.id, { memo: memoDraft })}
                onSubmitEditing={() => Keyboard.dismiss()}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.sm,
                  paddingVertical: space.xs,
                  fontSize: fontSize.caption1,
                  fontFamily: FONT.regular,
                  color: colors.ink,
                }}
              />
              <PressableScale onPress={() => Keyboard.dismiss()} hitSlop={hitSlopFor(36, 24)} accessibilityRole="button">
                <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
                  완료
                </AppText>
              </PressableScale>
            </View>
          )}

          {editingField?.placeId === place.id && editingField.field === "time" && showTimePicker && (
            <View style={{ marginTop: space.xs, gap: space.xxs }}>
              <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>도착 시간</AppText>
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
                <View style={{ flexDirection: "row", gap: space.md, justifyContent: "flex-end" }}>
                  <PressableScale onPress={closeTimePicker} disabled={busy}>
                    <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>취소</AppText>
                  </PressableScale>
                  <PressableScale
                    onPress={() => commitTime(place, timeDraft ?? parseTimeToDate(place.visitStartTime))}
                    disabled={busy}
                    style={{ opacity: busy ? 0.4 : 1 }}
                  >
                    <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
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
              marginLeft: space.xxxl,
              padding: space.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
            }}
          >
            <AppText style={{ fontSize: fontSize.caption1, color: colors.accent }}>
              {gap.gapMinutes}분 비어요 — 이 사이 갈 곳 추천받기
            </AppText>
          </PressableScale>
        )}
      </View>
    );
  }

  const actionChip = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space.xxs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    // 테두리만 있는 버튼이 많아 화면이 선으로 가득해 보였다(2026-10 QA, "Wireframe Borders") — 옅은 채움으로 바꿨다.
    // 새 색을 만들면 웹 토큰도 바꿔야 해서 기존 토큰을 쓴다(bgMuted는 흰 배경과 거의 구분되지 않음).
    backgroundColor: colors.borderSubtle,
  };

  return (
    <View style={{ flex: 1 }}>
    {tripQuery.isError && <StaleNotice floating onRetry={() => tripQuery.refetch()} />}
    <InlineMap
      pins={places
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }))}
      fill
      bottomInsetRatio={SHEET_DEFAULT_PERCENT / 100}
      selectedId={reviewTarget?.kind === "tripPlace" ? String(reviewTarget.id) : null}
    />
    {/* 시트 안 목록은 끌어서 순서를 바꾼다 — 목록을 끌 때 시트까지 움직이지 않게 시트는 위쪽 손잡이로만 움직인다. */}
    <BottomSheet index={1} snapPoints={SHEET_SNAP_POINTS} enableDynamicSizing={false} enableContentPanningGesture={false}>
    {/* BottomSheetView는 내용 높이만큼 늘어나 목록이 스크롤되지 않고 아래가 잘렸다(로그: 목록 높이 = 내용 높이). 시트 높이에 맞추는 View를 쓴다(디자인 QA K1). */}
    <View style={{ flex: 1 }}>
    <DraggableFlatList keyboardShouldPersistTaps="handled"
      ref={listRef as never}
      // 바깥 틀이 시트 높이를 넘어 늘어나면 목록이 스크롤되지 않고 아래가 잘린다 — 시트 안에 맞춰 스크롤되게 한다(디자인 QA K1).
      containerStyle={{ flex: 1 }}
      onContentSizeChange={(_w, h) => {
        // 키보드가 뜬 직후 여백이 붙기 전 높이로 먼저 한 번 불린다(로그로 확인) — 높이가 실제로 늘었을 때 내린다.
        if (scrollToSearchRef.current && h > contentHeightRef.current) {
          scrollToSearchRef.current = false;
          // scrollToEnd는 이 목록(DraggableFlatList)에서 움직이지 않았다 — 위치를 직접 주는 scrollToOffset은 움직인다(로그·캡처로 확인).
          listRef.current?.scrollToOffset({ offset: h, animated: true });
        } else if (scrollToMemoRef.current && memoEditIndexRef.current !== null && h > contentHeightRef.current) {
          const index = memoEditIndexRef.current;
          scrollToMemoRef.current = false;
          memoEditIndexRef.current = null;
          if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
        }
        contentHeightRef.current = h;
      }}
      data={places}
      keyExtractor={(item) => String(item.id)}
      onDragEnd={handleDragEnd}
      renderItem={renderPlaceItem}
      activationDistance={0}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxxl + keyboardHeight }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={{ gap: space.sm, marginBottom: space.sm }}>
          {/* 일차 칩: 날짜와 그날 장소 수를 함께 보여주고 가로로 넘긴다(참고: Plotline 일정의 날짜 칩). */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            {trip.days.map((d) => {
              const selected = d.day === currentActiveDay;
              return (
                <PressableScale
                  key={d.day}
                  onPress={() => setActiveDay(d.day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.xs,
                    paddingVertical: space.xs,
                    paddingHorizontal: space.md,
                    borderRadius: radius.full,
                    backgroundColor: selected ? colors.accent : colors.bgMuted,
                  }}
                >
                  <AppText weight="medium" style={{ color: selected ? colors.onAccent : colors.ink, fontSize: fontSize.footnote }}>
                    {d.day}일차{d.date ? ` · ${d.date.slice(5).replace("-", "/")}` : ""}
                  </AppText>
                  <View
                    style={{
                      minWidth: 20,
                      paddingHorizontal: space.xxs,
                      borderRadius: radius.full,
                      backgroundColor: selected ? "rgba(255,255,255,0.25)" : colors.bg,
                      alignItems: "center",
                    }}
                  >
                    <AppText style={{ fontSize: fontSize.caption2, color: selected ? colors.onAccent : colors.inkMuted }}>{d.places.length}</AppText>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>

          {/* 예전엔 날씨 확인(글자), 전체 일정 재구성(큰 테두리 버튼), 동선 최적화(글자)가 세 줄로 쌓였다. 한 줄 칩으로 모은다. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <PressableScale
              onPress={handleStartReplan}
              disabled={replanStarting || totalPlaceCount === 0}
              style={{ ...actionChip, backgroundColor: colors.accentBg, opacity: replanStarting || totalPlaceCount === 0 ? 0.4 : 1 }}
            >
              <Feather name="refresh-cw" size={12} color={colors.accent} />
              <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
                {replanStarting ? "시작하는 중..." : "전체 일정 재구성"}
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={handleOptimizeRoute}
              disabled={busy || places.length < 2}
              style={{ ...actionChip, opacity: busy || places.length < 2 ? 0.4 : 1 }}
            >
              <Feather name="shuffle" size={12} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>동선 최적화</AppText>
            </PressableScale>
            <PressableScale
              onPress={handleCheckWeather}
              disabled={busy || !activeDayData?.date}
              style={{ ...actionChip, opacity: busy || !activeDayData?.date ? 0.4 : 1 }}
            >
              <Feather name="cloud" size={12} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>날씨 확인</AppText>
            </PressableScale>
          </ScrollView>

          <WeatherAlertBanner
            tripId={tripId}
            onOpenAlternative={(_tripId, tripPlaceId) => {
              setReviewTarget(null);
              setAlternativeInitialIndoor(true);
              setAlternativeTargetId(tripPlaceId);
            }}
          />

          {weatherMessage && (
            <View style={{ padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.accentBg }}>
              <AppText style={{ fontSize: fontSize.footnote }}>{weatherMessage}</AppText>
            </View>
          )}

          {error && <ErrorText>{error}</ErrorText>}
        </View>
      }
      ListEmptyComponent={
        <AppText style={{ textAlign: "center", color: colors.inkMuted, padding: space.md }}>
          아직 장소가 없어요. 아래에서 검색해서 추가해보세요.
        </AppText>
      }
      ListFooterComponent={
        <View style={{ gap: space.md, marginTop: space.md }}>
          <View style={{ flexDirection: "row", gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
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
            <View style={{ gap: space.sm }}>
              {/* 찜한 장소 검색창(디자인 QA B2)과 같은 iOS식 검색창 — 옆 "검색" 버튼 대신 키보드 검색 키로 찾는다(디자인 QA K4). */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  height: 40,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.md,
                  backgroundColor: colors.bgMuted,
                }}
              >
                <Feather name="search" size={16} color={colors.inkMuted} />
                <BottomSheetTextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="장소 이름으로 검색 (예: 경복궁)"
                  returnKeyType="search"
                  enablesReturnKeyAutomatically
                  clearButtonMode="while-editing"
                  selectionColor={colors.accent}
                  onSubmitEditing={handleSearch}
                  ref={searchInputRef as never}
                  editable={!searching}
                  style={{ flex: 1, height: "100%", fontFamily: FONT.regular, color: colors.ink }}
                />
                {searching && <ActivityIndicator size="small" color={colors.inkMuted} />}
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
                      paddingVertical: space.sm,
                      gap: space.xs,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.xs }}>
                      <View style={{ flex: 1 }}>
                        <AppText weight="medium" numberOfLines={1}>
                          {place.name}
                        </AppText>
                        {place.address && (
                          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
                            {place.address}
                          </AppText>
                        )}
                        {place.rating !== null && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                            <RatingBadge rating={place.rating} />
                            {place.userRatingCount !== null && (
                              <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                                (리뷰 {formatCount(place.userRatingCount)}개)
                              </AppText>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
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
                      <AppText style={{ fontSize: fontSize.caption1, color: colors.accent }}>상세보기</AppText>
                    </PressableScale>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {bookmarksQuery.isError && (
                <QueryErrorView message="찜한 장소를 불러오지 못했어요." onRetry={() => bookmarksQuery.refetch()} />
              )}
              {!bookmarksQuery.isError && bookmarkFolderSections.length === 0 && (
                <AppText style={{ color: colors.inkMuted }}>아직 찜한 장소가 없어요.</AppText>
              )}
              {bookmarkFolderSections.map((section) => (
                <View key={section.id} style={{ gap: space.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                    <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: section.color }} />
                    <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
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
                          paddingVertical: space.sm,
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                          <AddToDayButton
                            added={addedGooglePlaceIds.has(bookmark.googlePlaceId)}
                            disabled={busy}
                            onPress={() => handleAddPlace(bookmark.googlePlaceId)}
                          />
                          <PressableScale
                            onPress={() =>
                              Alert.alert("찜을 해제할까요?", `"${bookmark.placeName}"${objectParticle(bookmark.placeName)} 찜한 장소에서 빼요.`, [
                                { text: "취소", style: "cancel" },
                                { text: "해제", style: "destructive", onPress: () => { haptics.warning(); handleRemoveBookmark(bookmark.id); } },
                              ])
                            }
                            hitSlop={{ top: 12, bottom: 12, left: 4, right: 12 }}>
                            <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>찜 해제</AppText>
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
    </View>
    </BottomSheet>
    <PlaceReviewSheet
      placeId={reviewTarget?.kind === "place" ? reviewTarget.id : null}
      tripPlaceId={reviewTarget?.kind === "tripPlace" ? reviewTarget.id : null}
      onClose={() => setReviewTarget(null)}
      // 여행에 담긴 장소를 볼 때만 — 비서는 여행의 장소를 두고 대화한다.
      onAskAssistant={
        reviewTarget?.kind === "tripPlace"
          ? () => {
              const id = reviewTarget.id;
              setReviewTarget(null);
              setAlternativeTargetId(null);
              setAssistantTargetId(id);
            }
          : undefined
      }
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
      <BottomSheetView style={{ padding: space.xs, paddingBottom: space.xxl }}>
        <AppText weight="medium" numberOfLines={1} style={{ padding: space.sm, color: colors.inkMuted, fontSize: fontSize.footnote }}>
          {menuPlace?.placeName}
        </AppText>
        {/* 비서는 이 앱만의 기능인데 메뉴 9개 중 6번째 회색 글자라 눈에 안 띄었다(사용자 지적, 2026-10-04).
            맨 위에 연한 주황 배경으로 두고, 같은 "AI가 찾아주는" 동작인 대안 찾기를 바로 아래에 둔다.
            글자색은 주황으로 하지 않는다 — 아래 "삭제"가 주황이라 헷갈린다. */}
        <PressableScale
          onPress={() => {
            if (!menuPlace) return;
            setReviewTarget(null);
            setAlternativeTargetId(null);
            setAssistantTargetId(menuPlace.id);
            menuSheetRef.current?.dismiss();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            padding: space.md,
            marginHorizontal: space.xs,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.accentBg,
          }}
        >
          <Feather name="message-circle" size={16} color={colors.accent} />
          <View style={{ flex: 1, gap: space.xxxs }}>
            <AppText weight="medium">비서에게 물어보기</AppText>
            <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>조용한 카페, 사람 적은 곳처럼 물어보세요</AppText>
          </View>
        </PressableScale>
        <PressableScale
          onPress={() => {
            if (!menuPlace) return;
            setReviewTarget(null);
            setAlternativeInitialIndoor(false);
            setAlternativeTargetId(menuPlace.id);
            menuSheetRef.current?.dismiss();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md }}
        >
          <Feather name="search" size={16} color={colors.inkMuted} />
          <AppText>대안 찾기</AppText>
        </PressableScale>
        <View style={{ height: 1, marginHorizontal: space.md, backgroundColor: colors.borderSubtle }} />
        {/* 일정 정하기(시간·이동수단·메모)는 행에서 빼고 여기 맨 위에 모았다. 아래 동작들도 같은 모양으로 아이콘을 붙인다
            (위 4개만 아이콘이 있어 두 묶음이 다른 메뉴처럼 보였다, 2026-10 QA). */}
        {menuPlace &&
          ([
            { field: "time", icon: "clock", label: menuPlace.visitStartTime ? "도착 시간 바꾸기" : "도착 시간 정하기" },
            { field: "stay", icon: "watch", label: stayMinutes(menuPlace) !== null ? "머무는 시간 바꾸기" : "머무는 시간 정하기" },
            { field: "transport", icon: "navigation", label: menuPlace.arrivalTransportMode ? "이동수단 바꾸기" : "이동수단 정하기" },
            { field: "memo", icon: "edit-3", label: menuPlace.memo ? "메모 고치기" : "메모 쓰기" },
          ] as const).map((item) => (
            <PressableScale
              key={item.field}
              onPress={() => {
                const target = menuPlace;
                menuSheetRef.current?.dismiss();
                startEditing(target, item.field);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md }}
            >
              <Feather name={item.icon} size={16} color={colors.inkMuted} />
              <AppText>{item.label}</AppText>
            </PressableScale>
          ))}
        <View style={{ height: 1, marginHorizontal: space.md, backgroundColor: colors.borderSubtle }} />
        {/* 행에 링크 줄까지 붙으면 장소 하나가 네 줄이 돼서, 가끔 쓰는 외부 링크는 메뉴로 옮겼다. */}
        {menuPlace && kakaoMapUrl(menuPlace) && (
          <PressableScale
            onPress={() => {
              const url = kakaoMapUrl(menuPlace);
              menuSheetRef.current?.dismiss();
              if (url) openExternal(url);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md }}
          >
            <Feather name="map" size={16} color={colors.inkMuted} />
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
            style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md }}
          >
            <Feather name="phone" size={16} color={colors.inkMuted} />
            <AppText>전화 걸기</AppText>
          </PressableScale>
        )}
        <PressableScale
          onPress={() => {
            const target = menuPlace;
            menuSheetRef.current?.dismiss();
            if (!target) return;
            Alert.alert("장소를 삭제할까요?", `"${target.placeName}"${objectParticle(target.placeName)} 일정에서 삭제해요.`, [
              { text: "취소", style: "cancel" },
              { text: "삭제", style: "destructive", onPress: () => { haptics.warning(); handleRemove(target.id); } },
            ]);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md }}
        >
          <Feather name="trash-2" size={16} color={colors.accent} />
          <AppText style={{ color: colors.accent }}>삭제</AppText>
        </PressableScale>
      </BottomSheetView>
    </BottomSheetModal>
    <BottomSheetModal
      ref={gapSheetRef}
      enableDynamicSizing
      onDismiss={() => {
        gapSheetOpen.current = false;
        setGapCardFor(null);
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: space.md, paddingBottom: space.xxl, gap: space.sm }}>
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
            style={{ padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, opacity: busy ? 0.6 : 1 }}
          >
            <AppText weight="medium" numberOfLines={1}>{r.name}</AppText>
            {r.address && <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{r.address}</AppText>}
          </PressableScale>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
    <BottomSheetModal
      ref={tripMenuSheetRef}
      enableDynamicSizing
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: space.xs, paddingBottom: space.xxl }}>
        <AppText weight="medium" numberOfLines={1} style={{ padding: space.sm, color: colors.inkMuted, fontSize: fontSize.footnote }}>
          {tripTitle}
        </AppText>
        <PressableScale
          onPress={() => {
            tripMenuSheetRef.current?.dismiss();
            confirmDeleteTripRef.current();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md }}
        >
          <Feather name="trash-2" size={16} color={colors.accent} />
          <AppText style={{ color: colors.accent }}>여행 삭제</AppText>
        </PressableScale>
      </BottomSheetView>
    </BottomSheetModal>
    </View>
  );
}

function AddToDayButton({ added, disabled, onPress }: { added: boolean; disabled: boolean; onPress: () => void }) {
  const box = { paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.sm, borderWidth: 1 } as const;
  if (added) {
    return (
      <View style={[box, { borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: space.xxs }]}>
        <Feather name="check" size={12} color={colors.inkMuted} />
        <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>추가됨</AppText>
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={[box, { borderColor: colors.accent, backgroundColor: colors.accent }]}>
      <AppText style={{ fontSize: fontSize.caption1, color: colors.onAccent }}>추가</AppText>
    </PressableScale>
  );
}
