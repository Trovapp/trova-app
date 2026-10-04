import { useEffect, useState } from "react";
import { Dimensions, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { SheetCloseButton } from "@/components/SheetCloseButton";
import { ApiError } from "@/lib/api/client";
import { bookmarkSavedPlace } from "@/lib/api/bookmarks";
import { haptics } from "@/lib/haptics";
import type { Place } from "@/lib/api/places";
import { categoryLabel } from "@/lib/placeCategory";
import { kakaoMapUrl, openExternal, phoneUrl } from "@/lib/placeLinks";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 영상에서 뽑은 장소(SavedPlace)의 정보 시트. 예전엔 리뷰 요약 시트(PlaceReviewSheet)에 SavedPlace id를
// 넘겼는데, 그 시트는 장소 카탈로그(Place) id로 조회해서 번호가 같은 전혀 다른 장소가 떴다(실제 탭으로 확인).
// SavedPlace는 장소 카탈로그·구글 장소와 연결 정보가 없어 리뷰 요약을 가져올 수 없으므로, 이미 저장된
// 정보만 보여준다. 열려 있을 때만 마운트해 처음부터 열린 상태로 그린다(대안 찾기 시트와 같은 방식).
// onMoveDay가 있으면(일정이 있는 영상) "다른 날로 이동"도 이 시트에서 한다. 예전엔 장소 행마다
// "다른 날로 이동 · 카카오맵 · 전화" 글자 버튼이 붙어 목록이 복잡했다(2026-10, 행동을 장소 시트로 모음).
export function SavedPlaceInfoSheet({
  place,
  onClose,
  onMoveDay,
  onAddToTrip,
}: {
  place: Place | null;
  onClose: () => void;
  onMoveDay?: () => void;
  // 있으면 "여행에 담기"를 보인다. 여행·일차 고르기는 화면에서 연다 — 이 시트 안에서 다른 시트를 띄우면
  // present()가 불려도 화면에 나오지 않았다(2026-10-04 QA). "다른 날로 이동"과 같은 방식.
  onAddToTrip?: () => void;
}) {
  const queryClient = useQueryClient();
  // 찜·여행에 담기 결과는 시트 안 한 줄로 알린다(사용자 관점 QA — 영상에서 찾은 곳을 바로 모을 수 없었다, #125·#126).
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<"bookmark" | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const placeId = place?.id;
  useEffect(() => {
    setNotice(null);
    setBookmarked(false);
  }, [placeId]);

  if (!place) return null;
  const current = place;

  async function handleBookmark() {
    setBusy("bookmark");
    setNotice(null);
    try {
      await bookmarkSavedPlace(current.id);
      setBookmarked(true);
      haptics.success();
      setNotice({ text: "찜했어요. 찜한 장소에서 볼 수 있어요.", error: false });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
    } catch (e) {
      const notFound = e instanceof ApiError && e.status === 422;
      setNotice({
        text: notFound ? "지도에서 이 장소를 찾지 못해 찜할 수 없어요." : "찜하지 못했어요. 잠시 후 다시 시도해주세요.",
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }



  const mapUrl = kakaoMapUrl(place);
  const telUrl = phoneUrl(place);
  const category = categoryLabel(place.category) ?? place.kakaoCategoryName?.split(">").pop()?.trim() ?? null;
  // 도로명 주소가 빈 문자열로 오는 경우가 있어(실측) ??가 아니라 ||로 지번 주소까지 넘어가게 한다.
  const address = place.roadAddress || place.address;
  const hasLocation = place.latitude !== null && place.longitude !== null;

  return (
    <BottomSheet
      index={0}
      // 내용 높이에 맞춘다 — 45% 고정일 때 찜·담기 결과 문장과 영상 메모가 시트 아래로 잘렸다(2026-10-04 QA).
      enableDynamicSizing
      maxDynamicContentSize={Math.round(Dimensions.get("window").height * 0.8)}
      enablePanDownToClose
      onClose={onClose}
      // 영상 시트 위에 그대로 겹쳐 손잡이가 두 개 보이고 뒤 시트 제목이 반쯤 잘렸다(2026-10 QA). 뒤를 어둡게 해
      // 위 시트가 앞에 떠 있다는 걸 구분하고, 바깥을 누르면 닫는다. 열 때 지도가 이 장소 핀으로 옮겨 가므로
      // ⋮ 메뉴(기본 0.5)보다 옅게 해 핀이 보이게 둔다.
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.3} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
          <View style={{ flex: 1, gap: space.xxs }}>
            <AppText weight="medium" style={{ fontSize: fontSize.callout }}>
              {place.placeName}
            </AppText>
            {category && <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{category}</AppText>}
            {address && <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{address}</AppText>}
            {!hasLocation && (
              <AppText style={{ fontSize: fontSize.caption1, color: colors.accent }}>위치 확인 안됨 · 지도에 안 뜰 수 있어요</AppText>
            )}
          </View>
          <SheetCloseButton onPress={onClose} />
        </View>

        {/* 동작 버튼은 테두리 대신 옅은 채움(여행 상세 동작 칩과 같은 규칙, 2026-10 QA) */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          <PressableScale
            onPress={handleBookmark}
            disabled={busy !== null || bookmarked}
            accessibilityState={{ disabled: busy !== null || bookmarked, busy: busy === "bookmark" }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.xs,
              paddingVertical: space.sm,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.accentBg,
            }}
          >
            <Feather name={bookmarked ? "check" : "heart"} size={14} color={colors.accent} />
            <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
              {busy === "bookmark" ? "찜하는 중..." : bookmarked ? "찜했어요" : "찜하기"}
            </AppText>
          </PressableScale>
          {onAddToTrip && (
            <PressableScale
              onPress={onAddToTrip}
              disabled={busy !== null}
              accessibilityState={{ disabled: busy !== null }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.accentBg,
              }}
            >
              <Feather name="plus" size={14} color={colors.accent} />
              <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
                여행에 담기
              </AppText>
            </PressableScale>
          )}
          {onMoveDay && (
            <PressableScale
              onPress={onMoveDay}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.borderSubtle,
              }}
            >
              <Feather name="calendar" size={14} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>다른 날로 이동</AppText>
            </PressableScale>
          )}
          {mapUrl && (
            <PressableScale
              onPress={() => openExternal(mapUrl)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.borderSubtle,
              }}
            >
              <Feather name="map" size={14} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>카카오맵에서 보기</AppText>
            </PressableScale>
          )}
          {telUrl && (
            <PressableScale
              onPress={() => openExternal(telUrl)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.borderSubtle,
              }}
            >
              <Feather name="phone" size={14} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>전화 걸기</AppText>
            </PressableScale>
          )}
        </View>
        {notice && (
          <AppText selectable style={{ fontSize: fontSize.footnote, color: notice.error ? colors.accent : colors.inkMuted }}>
            {notice.text}
          </AppText>
        )}

        {/* 영상에서 말한 내용(#104) — 사용자 메모와 섞이지 않게 출처를 제목으로 밝힌다. 없으면 예전 안내만. */}
        {place.videoNotes && place.videoNotes.length > 0 && (
          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
              <Feather name="film" size={13} color={colors.inkMuted} />
              <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
                영상에서 말한 내용
              </AppText>
            </View>
            {place.videoNotes.map((note) => (
              <AppText key={note} style={{ fontSize: fontSize.subheadline }}>
                · {note}
              </AppText>
            ))}
          </View>
        )}

        <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
          영상에서 찾은 장소라 리뷰 요약은 아직 볼 수 없어요.
        </AppText>
      </BottomSheetView>
    </BottomSheet>
  );
}
