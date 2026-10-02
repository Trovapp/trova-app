import { View } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { SheetCloseButton } from "@/components/SheetCloseButton";
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
}: {
  place: Place | null;
  onClose: () => void;
  onMoveDay?: () => void;
}) {
  if (!place) return null;

  const mapUrl = kakaoMapUrl(place);
  const telUrl = phoneUrl(place);
  const category = categoryLabel(place.category) ?? place.kakaoCategoryName?.split(">").pop()?.trim() ?? null;
  // 도로명 주소가 빈 문자열로 오는 경우가 있어(실측) ??가 아니라 ||로 지번 주소까지 넘어가게 한다.
  const address = place.roadAddress || place.address;
  const hasLocation = place.latitude !== null && place.longitude !== null;

  return (
    <BottomSheet
      index={0}
      snapPoints={["45%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      // 영상 시트 위에 그대로 겹쳐 손잡이가 두 개 보이고 뒤 시트 제목이 반쯤 잘렸다(2026-10 QA). 뒤를 어둡게 해
      // 위 시트가 앞에 떠 있다는 걸 구분하고, 바깥을 누르면 닫는다. 열 때 지도가 이 장소 핀으로 옮겨 가므로
      // ⋮ 메뉴(기본 0.5)보다 옅게 해 핀이 보이게 둔다.
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.3} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ padding: space.lg, gap: space.md }}>
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

        {(mapUrl || telUrl || onMoveDay) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
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
                  borderWidth: 1,
                  borderColor: colors.border,
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
                  borderWidth: 1,
                  borderColor: colors.border,
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
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Feather name="phone" size={14} color={colors.ink} />
                <AppText style={{ fontSize: fontSize.footnote }}>전화 걸기</AppText>
              </PressableScale>
            )}
          </View>
        )}

        <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
          영상에서 찾은 장소라 리뷰 요약은 아직 볼 수 없어요.
        </AppText>
      </BottomSheetView>
    </BottomSheet>
  );
}
