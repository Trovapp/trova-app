import { useLayoutEffect, useRef, useState } from "react";
import { Alert, Platform, TextInput, View } from "react-native";
import BottomSheet, { BottomSheetFooter, BottomSheetScrollView, BottomSheetView, type BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { PressableScale } from "@/components/PressableScale";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { DayPickerSheet } from "@/components/DayPickerSheet";
import { InlineMap } from "@/components/InlineMap";
import { PlaceRow } from "@/components/PlaceRow";
import { CountUpText } from "@/components/CountUpText";
import { CategoryFilterChips } from "@/components/CategoryFilterChips";
import { categoryGroup, type CategoryGroup } from "@/lib/placeCategory";
import { SavedPlaceInfoSheet } from "@/components/SavedPlaceInfoSheet";
import { QueryErrorView } from "@/components/QueryErrorView";
import { Skeleton } from "@/components/Skeleton";
import { SourceVideoLink } from "@/components/SourceVideoLink";
import { haversineDistanceKm } from "@/lib/geo";
import { haptics } from "@/lib/haptics";
import { deleteVideoPlaces, generateItinerary, getPlaces, moveToDay, optimizeRoute, reorderPlace, type Place } from "@/lib/api/places";
import { confirmTrip, getVideoTrip, TRIP_TITLE_MAX_LENGTH } from "@/lib/api/trips";
import { formatDateLabel, formatTripDates, toDateString } from "@/lib/date";
import { groupByDay, isItineraryGroup } from "@/lib/itinerary";
import { toUserMessage } from "@/lib/api/client";
import { colors, fontSize, radius, space } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VideoGroup">;

// 지도를 뒤에 꽉 채우고 목록은 끌어올리는 시트에 담는다(2026-10, 참고: Plotline 지도+시트, 찜한 장소 화면과 같은 구성).
const SHEET_DEFAULT_PERCENT = 55;
const SHEET_SNAP_POINTS = ["18%", `${SHEET_DEFAULT_PERCENT}%`, "90%"];
// 시트 아래 고정 버튼(52) + 위아래 여백만큼 목록 끝을 띄워 마지막 장소가 버튼에 가리지 않게 한다.
const FOOTER_SPACE = 52 + space.md * 2 + 34; // 34: 홈 표시줄 높이(대략)

export function VideoGroupScreen({ route, navigation }: Props) {
  const { jobId, justAnalyzed = false } = route.params;
  // 분석 직후 도착 연출(개수 세기·카드 순차 등장). 다시 들어올 때는 차분하게 둔다.
  const reducedMotion = useReducedMotion();
  // 화면에 들어온 직후에만 연출한다 — 날짜 탭을 바꿀 때 행이 새로 그려져도 다시 튀지 않게.
  const arrivalDeadlineRef = useRef(Date.now() + 2500);
  const arrive = justAnalyzed && !reducedMotion && Date.now() < arrivalDeadlineRef.current;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  // 이 영상으로 이미 만든 여행 — 있으면 "여행으로 만들기" 대신 "만든 여행 보기"를 보여준다. 예전엔 항상 폼을
  // 보여줘서 같은 영상 여행이 중복으로 쌓이거나, 입력한 이름·출발일이 말없이 무시되고 기존 여행으로 이동했다.
  // 조회에 실패하면(서버에 API가 없는 등) 지금처럼 만들기 폼을 보여준다.
  const videoTripQuery = useQuery({ queryKey: ["videoTrip", jobId], queryFn: () => getVideoTrip(jobId) });
  const existingTrip = videoTripQuery.data ?? null;
  const [localPlaces, setLocalPlaces] = useState<Place[] | null>(null);
  const [emptyDayNumbers, setEmptyDayNumbers] = useState<number[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [dayPickerFor, setDayPickerFor] = useState<Place | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  // 예전엔 시작일이 항상 "오늘"로 들어가서 다음 달 여행도 오늘 날짜가 됐고, 날짜 수정 API도 없어 고칠 수 없었다.
  const [tripStartDate, setTripStartDate] = useState(new Date());
  const [showTripDatePicker, setShowTripDatePicker] = useState(false);
  const [tripTitle, setTripTitle] = useState("");
  const [confirmingTrip, setConfirmingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [reviewPlaceId, setReviewPlaceId] = useState<number | null>(null);
  // 분류 필터(보기 전용). 목록과 지도 핀을 함께 거르고, 동선 최적화·여행 만들기는 항상 전체 장소로 한다.
  const [categoryFilter, setCategoryFilter] = useState<CategoryGroup | null>(null);
  const matchesFilter = (p: Place) => categoryFilter === null || categoryGroup(p.category) === categoryFilter;

  const group = (placesQuery.data ?? []).filter((p) => p.jobId === jobId);
  // 장소 정보 시트는 SavedPlace 자체를 넘긴다(리뷰 요약 시트에 SavedPlace id를 넘기면 다른 장소가 조회됐다).
  const reviewPlace = group.find((p) => p.id === reviewPlaceId) ?? null;
  const placeIdsKey = group.map((p) => p.id).join(",");

  // 완료된 영상 기록은 지울 방법이 없던 문제 — 여행 상세와 같은 위치(헤더 오른쪽)에 삭제를 둔다.
  useLayoutEffect(() => {
    const placeIds = placeIdsKey ? placeIdsKey.split(",").map(Number) : [];
    function confirmDeleteVideo() {
      Alert.alert(
        "영상 기록을 삭제할까요?",
        `이 영상에서 찾은 장소 ${placeIds.length}곳이 영상 기록에서 사라져요. 이 영상으로 만든 여행은 그대로 남아요.`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "삭제",
            style: "destructive",
            onPress: async () => {
              haptics.warning();
              const failed = await deleteVideoPlaces(placeIds);
              if (failed > 0) {
                await queryClient.invalidateQueries({ queryKey: ["places"] });
                Alert.alert("일부를 삭제하지 못했어요", `${failed}곳이 남았어요. 잠시 후 다시 시도해주세요.`);
                return;
              }
              // 목록을 먼저 새로 받으면 이 화면이 잠깐 "영상을 찾을 수 없어요"로 바뀌므로 먼저 떠난다.
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.replace("MainTabs");
              await queryClient.invalidateQueries({ queryKey: ["places"] });
            },
          },
        ],
      );
    }
    navigation.setOptions({
      headerRight: () => (
        <PressableScale onPress={confirmDeleteVideo} hitSlop={10} disabled={placeIds.length === 0}>
          <Feather name="trash-2" size={19} color={colors.inkMuted} />
        </PressableScale>
      ),
    });
  }, [navigation, placeIdsKey, queryClient]);

  const itineraryPlaces = localPlaces ?? group;
  const hasItinerary = isItineraryGroup(itineraryPlaces);
  const days = groupByDay(itineraryPlaces);
  const dayNumbers = Array.from(new Set([...days.keys(), ...emptyDayNumbers])).sort((a, b) => a - b);
  // 백엔드(confirmVideoPlacesIntoTrip)와 같은 기준 — 장소가 있는 날짜 중 가장 큰 일차로 도착일을 정한다.
  const tripDayCount = Math.max(1, ...days.keys());
  const tripEndDate = new Date(tripStartDate.getFullYear(), tripStartDate.getMonth(), tripStartDate.getDate() + tripDayCount - 1);
  const currentActiveDay = activeDay ?? dayNumbers[0] ?? null;
  const activePlaces = currentActiveDay !== null ? days.get(currentActiveDay) ?? [] : [];
  const visibleActivePlaces = activePlaces.filter(matchesFilter);
  const unassignedPlaces = itineraryPlaces.filter((p) => p.dayNumber === null);
  const visibleUnassignedPlaces = unassignedPlaces.filter(matchesFilter);

  async function handleGenerateItinerary() {
    if (group.length === 0 || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await generateItinerary(jobId);
      navigation.navigate("Processing", { jobId });
    } catch (err) {
      setError(toUserMessage(err, "일정 생성 요청에 실패했어요. 다시 시도해주세요."));
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

  // 드래그가 끝나면 화면은 바로 새 순서를 반영하고, 실제 저장은 기존 한 칸씩
  // 이동하는 API(reorderPlace)를 옮긴 칸 수만큼 순차 호출해서 처리한다 — 여행
  // 상세 화면(TripDetailScreen)의 드래그 저장 방식과 동일하다.
  async function handleDragEnd({ data, from, to }: { data: Place[]; from: number; to: number }) {
    // 걸러진 목록에서 옮기면 서버에 보내는 칸 수가 실제 순서와 어긋난다 — 필터 중엔 손잡이도 숨긴다.
    if (from === to || actionPending || categoryFilter !== null) return;
    haptics.light();
    const previous = itineraryPlaces;
    setItineraryError(null);
    const orderById = new Map(data.map((p, i) => [p.id, i]));
    setLocalPlaces(previous.map((p) => (orderById.has(p.id) ? { ...p, orderInDay: orderById.get(p.id)! } : p)));

    const movedPlace = data[to];
    const direction = to > from ? "DOWN" : "UP";
    const steps = Math.abs(to - from);
    setActionPending(true);
    try {
      let updated: Place | null = null;
      for (let i = 0; i < steps; i++) {
        updated = await reorderPlace(movedPlace.id, direction);
      }
      if (updated) {
        const finalUpdated = updated;
        setLocalPlaces((current) => (current ?? previous).map((p) => (p.id === finalUpdated.id ? finalUpdated : p)));
      }
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
      const trip = await confirmTrip(group[0].jobId, tripTitle.trim() || title.slice(0, TRIP_TITLE_MAX_LENGTH), toDateString(tripStartDate));
      haptics.success();
      // replace는 아래에 깔린 여행 목록 화면을 unmount하지 않는다 — 무효화해두지 않으면
      // 뒤로 가기로 돌아왔을 때 방금 확정한 여행이 목록에 없다.
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      await queryClient.invalidateQueries({ queryKey: ["videoTrip"] });
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
      <View style={{ flex: 1, padding: space.md, gap: space.sm }}>
        <Skeleton style={{ width: "70%", height: 20 }} />
        <Skeleton style={{ height: 180, borderRadius: radius.md }} />
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
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
  const visibleGroup = group.filter(matchesFilter);

  const filterChips = (
    <View style={{ gap: space.xxs }}>
      <CategoryFilterChips categories={group.map((p) => p.category)} value={categoryFilter} onChange={setCategoryFilter} />
      {categoryFilter !== null && (
        <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
          보기만 걸러요. 순서 바꾸기는 전체에서 할 수 있어요
        </AppText>
      )}
    </View>
  );

  function renderActivePlaceItem({ item: place, getIndex, drag, isActive }: RenderItemParams<Place>) {
    const index = getIndex() ?? 0;
    const isLast = index === visibleActivePlaces.length - 1;
    const next = visibleActivePlaces[index + 1];
    const distanceKm =
      !isLast && place.latitude !== null && place.longitude !== null && next?.latitude !== null && next?.longitude !== null
        ? haversineDistanceKm(place.latitude, place.longitude, next!.latitude!, next!.longitude!)
        : null;
    return (
      // 등장 애니메이션(바깥)과 드래그 중 투명도(안쪽)를 나눈다 — 한 View에 두면 Reanimated가 투명도를 덮어쓴다고 경고한다.
      <Animated.View
        entering={arrive ? FadeInDown.delay(250 + Math.min(index, 8) * 70).springify().damping(16) : undefined}
      >
        <View style={{ opacity: isActive ? 0.9 : 1 }}>
          <PlaceRow
            place={place}
            index={index}
            number={activePlaces.indexOf(place) + 1}
            showCategory
            isLast={isLast}
            distanceKm={distanceKm}
            showLinks={false}
            disabled={actionPending}
            dragHandle={categoryFilter === null ? { onPressIn: drag } : undefined}
            onPressInfo={() => setReviewPlaceId(place.id)}
          />
        </View>
      </Animated.View>
    );
  }

  const titleBlock = (
    <View style={{ gap: space.xxs }}>
      <AppText weight="medium" style={{ fontSize: fontSize.body }} numberOfLines={2}>
        {title}
      </AppText>
      <SourceVideoLink url={group[0].sourceUrl} platform={group[0].sourcePlatform} />
      {justAnalyzed && (
        <CountUpText
          value={group.length}
          suffix="곳을 찾았어요"
          animate={!reducedMotion}
          weight="medium"
          style={{ fontSize: fontSize.subheadline, color: colors.accent, marginTop: space.xxs }}
        />
      )}
    </View>
  );

  const mapPins = (hasItinerary ? visibleActivePlaces : visibleGroup)
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({ id: String(p.id), latitude: p.latitude as number, longitude: p.longitude as number }));

  // 시트 아래 고정 버튼 하나만 이 화면의 주 행동이다. 예전엔 위쪽 테두리 버튼이라 다른 칩·링크와 무게가 비슷했다.
  const footer = !hasItinerary
    ? { label: generating ? "일정 생성 중..." : "일정 짜기", onPress: handleGenerateItinerary, disabled: generating }
    : existingTrip
      ? // 이 영상으로 이미 만든 여행이 있으면 같은 곳으로 가는 카드를 따로 두지 않고 버튼에 여행 이름을 담는다.
        { label: `만든 여행 보기 · ${existingTrip.title}`, onPress: () => navigation.navigate("TripDetail", { id: existingTrip.id }), disabled: false }
      : showTripForm
        ? { label: confirmingTrip ? "만드는 중..." : "이대로 여행 만들기", onPress: handleConfirmTrip, disabled: confirmingTrip }
        : {
            label: "여행으로 만들기",
            onPress: () => {
              setTripTitle(title);
              setShowTripForm(true);
            },
            disabled: false,
          };

  function renderFooter(props: BottomSheetFooterProps) {
    return (
      // 버튼 영역 배경이 화면 맨 아래(홈 표시줄 뒤)까지 덮어야 목록이 버튼 아래로 비치지 않는다.
      <BottomSheetFooter {...props}>
        <View
          style={{
            paddingHorizontal: space.md,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.xs,
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <PressableScale
            onPress={footer.onPress}
            disabled={footer.disabled}
            accessibilityRole="button"
            style={{
              height: 52,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              opacity: footer.disabled ? 0.6 : 1,
            }}
          >
            <AppText weight="medium" numberOfLines={1} style={{ fontSize: fontSize.callout, color: colors.onAccent, paddingHorizontal: space.md }}>
              {footer.label}
            </AppText>
          </PressableScale>
        </View>
      </BottomSheetFooter>
    );
  }

  const map = (
    <InlineMap
      pins={mapPins}
      fill
      bottomInsetRatio={SHEET_DEFAULT_PERCENT / 100}
      selectedId={reviewPlaceId !== null ? String(reviewPlaceId) : null}
    />
  );

  if (!hasItinerary) {
    return (
      <View style={{ flex: 1 }}>
        {map}
        <BottomSheet index={1} snapPoints={SHEET_SNAP_POINTS} enableDynamicSizing={false} footerComponent={renderFooter}>
          <BottomSheetScrollView contentContainerStyle={{ padding: space.md, paddingBottom: FOOTER_SPACE, gap: space.sm }}>
            {titleBlock}
            {error && <ErrorText>{error}</ErrorText>}
            {filterChips}
            <View>
              {visibleGroup.map((place, index) => {
                const isLast = index === visibleGroup.length - 1;
                const next = visibleGroup[index + 1];
                const distanceKm =
                  !isLast && place.latitude !== null && place.longitude !== null && next?.latitude !== null && next?.longitude !== null
                    ? haversineDistanceKm(place.latitude, place.longitude, next!.latitude!, next!.longitude!)
                    : null;
                return (
                  <Animated.View
                    key={place.id}
                    entering={arrive ? FadeInDown.delay(250 + Math.min(index, 8) * 70).springify().damping(16) : undefined}
                  >
                    <PlaceRow
                      place={place}
                      index={index}
                      number={group.indexOf(place) + 1}
                      showCategory
                      isLast={isLast}
                      distanceKm={distanceKm}
                      showLinks={false}
                      onPressInfo={() => setReviewPlaceId(place.id)}
                    />
                  </Animated.View>
                );
              })}
            </View>
          </BottomSheetScrollView>
        </BottomSheet>
        <SavedPlaceInfoSheet place={reviewPlace} onClose={() => setReviewPlaceId(null)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {map}
      {/* 시트 안 목록은 끌어서 순서를 바꾼다 — 목록을 끌 때 시트까지 움직이지 않게 시트는 위쪽 손잡이로만 움직인다. */}
      <BottomSheet
        index={1}
        snapPoints={SHEET_SNAP_POINTS}
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
        footerComponent={renderFooter}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <DraggableFlatList
            keyboardShouldPersistTaps="handled"
            data={visibleActivePlaces}
            keyExtractor={(item) => String(item.id)}
            onDragEnd={handleDragEnd}
            renderItem={renderActivePlaceItem}
            activationDistance={0}
            contentContainerStyle={{ padding: space.md, paddingBottom: FOOTER_SPACE }}
            ListHeaderComponent={
              <View style={{ gap: space.sm, marginBottom: space.sm }}>
                {titleBlock}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                  {dayNumbers.map((day) => (
                    <PressableScale
                      key={day}
                      onPress={() => setActiveDay(day)}
                      style={{
                        paddingVertical: space.xs,
                        paddingHorizontal: space.md,
                        borderRadius: radius.full,
                        backgroundColor: day === currentActiveDay ? colors.accent : colors.bgMuted,
                      }}
                    >
                      <AppText weight="medium" style={{ color: day === currentActiveDay ? colors.onAccent : colors.inkMuted, fontSize: fontSize.footnote }}>
                        {day}일차
                      </AppText>
                    </PressableScale>
                  ))}
                  <PressableScale
                    onPress={handleAddDay}
                    style={{ paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }}
                  >
                    <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>+ 날짜 추가</AppText>
                  </PressableScale>
                  <PressableScale
                    onPress={handleOptimizeRoute}
                    disabled={actionPending || activePlaces.length < 2}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.xxs,
                      paddingVertical: space.xs,
                      paddingHorizontal: space.md,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: actionPending || activePlaces.length < 2 ? 0.4 : 1,
                    }}
                  >
                    <Feather name="shuffle" size={12} color={colors.accent} />
                    <AppText style={{ fontSize: fontSize.footnote, color: colors.accent }}>동선 최적화</AppText>
                  </PressableScale>
                </View>

                {!existingTrip && showTripForm && (
                  <View style={{ gap: space.xs, padding: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <AppText weight="medium" style={{ fontSize: fontSize.footnote }}>
                        여행으로 만들기
                      </AppText>
                      <PressableScale onPress={() => setShowTripForm(false)} hitSlop={10}>
                        <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>취소</AppText>
                      </PressableScale>
                    </View>
                    <TextInput
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      value={tripTitle}
                      onChangeText={setTripTitle}
                      placeholder="여행 이름"
                      maxLength={TRIP_TITLE_MAX_LENGTH}
                      style={{
                        height: 40,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.sm,
                        paddingHorizontal: space.sm,
                        fontFamily: "NotoSansKR_400Regular",
                      }}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                      <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>출발일</AppText>
                      <PressableScale
                        onPress={() => setShowTripDatePicker((v) => !v)}
                        style={{
                          flex: 1,
                          height: 40,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: radius.sm,
                          paddingHorizontal: space.sm,
                          justifyContent: "center",
                        }}
                      >
                        <AppText>{formatDateLabel(tripStartDate)}</AppText>
                      </PressableScale>
                    </View>
                    {showTripDatePicker && (
                      <View style={{ gap: space.xxs }}>
                        <DateTimePicker
                          value={tripStartDate}
                          mode="date"
                          // 새 여행 화면과 같은 규칙 — 오늘 이전 출발일은 고를 수 없다.
                          minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                          locale="ko-KR"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          onValueChange={(_, selected) => {
                            // iOS 스피너는 스스로 닫히지 않아 아래 "확인"으로 닫는다(새 여행 화면과 동일).
                            if (Platform.OS !== "ios") setShowTripDatePicker(false);
                            setTripStartDate(selected);
                          }}
                          onDismiss={() => setShowTripDatePicker(false)}
                        />
                        {Platform.OS === "ios" && (
                          <PressableScale onPress={() => setShowTripDatePicker(false)} style={{ alignSelf: "flex-end" }}>
                            <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
                              확인
                            </AppText>
                          </PressableScale>
                        )}
                      </View>
                    )}
                    <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                      {formatTripDates(toDateString(tripStartDate), toDateString(tripEndDate))}
                    </AppText>
                    {tripError && <ErrorText>{tripError}</ErrorText>}
                  </View>
                )}

                {currentActiveDay !== null && emptyDayNumbers.includes(currentActiveDay) && activePlaces.length === 0 && (
                  <PressableScale onPress={() => handleDeleteDay(currentActiveDay)} hitSlop={10}>
                    <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>이 빈 날짜 삭제</AppText>
                  </PressableScale>
                )}

                {itineraryError && <ErrorText>{itineraryError}</ErrorText>}

                {filterChips}
              </View>
            }
            ListEmptyComponent={
              <AppText style={{ textAlign: "center", color: colors.inkMuted, padding: space.md }}>
                이 날짜엔 아직 장소가 없어요.
              </AppText>
            }
            ListFooterComponent={
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {visibleUnassignedPlaces.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
                      아직 날짜가 없는 장소
                    </AppText>
                    <View>
                      {visibleUnassignedPlaces.map((place, index) => (
                        <PlaceRow
                          key={place.id}
                          place={place}
                          index={index}
                          number={unassignedPlaces.indexOf(place) + 1}
                          showCategory
                          isLast={index === visibleUnassignedPlaces.length - 1}
                          distanceKm={null}
                          showLinks={false}
                          disabled={actionPending}
                          onPressInfo={() => setReviewPlaceId(place.id)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            }
          />
        </BottomSheetView>
      </BottomSheet>
      <DayPickerSheet
        visible={dayPickerFor !== null}
        dayNumbers={dayNumbers}
        currentDay={dayPickerFor?.dayNumber ?? null}
        onSelect={(day) => {
          if (dayPickerFor) handleMoveDay(dayPickerFor, day);
        }}
        onClose={() => setDayPickerFor(null)}
      />
      <SavedPlaceInfoSheet
        place={reviewPlace}
        onClose={() => setReviewPlaceId(null)}
        onMoveDay={
          reviewPlace
            ? () => {
                setReviewPlaceId(null);
                setDayPickerFor(reviewPlace);
              }
            : undefined
        }
      />
    </View>
  );
}
