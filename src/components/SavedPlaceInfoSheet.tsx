import { View } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { SheetCloseButton } from "@/components/SheetCloseButton";
import type { Place } from "@/lib/api/places";
import { categoryLabel } from "@/lib/placeCategory";
import { kakaoMapUrl, openExternal, phoneUrl } from "@/lib/placeLinks";
import { colors } from "@/lib/theme";

// 영상에서 뽑은 장소(SavedPlace)의 정보 시트. 예전엔 리뷰 요약 시트(PlaceReviewSheet)에 SavedPlace id를
// 넘겼는데, 그 시트는 장소 카탈로그(Place) id로 조회해서 번호가 같은 전혀 다른 장소가 떴다(실제 탭으로 확인).
// SavedPlace는 장소 카탈로그·구글 장소와 연결 정보가 없어 리뷰 요약을 가져올 수 없으므로, 이미 저장된
// 정보만 보여준다. 열려 있을 때만 마운트해 처음부터 열린 상태로 그린다(대안 찾기 시트와 같은 방식).
export function SavedPlaceInfoSheet({ place, onClose }: { place: Place | null; onClose: () => void }) {
  if (!place) return null;

  const mapUrl = kakaoMapUrl(place);
  const telUrl = phoneUrl(place);
  const category = categoryLabel(place.category) ?? place.kakaoCategoryName?.split(">").pop()?.trim() ?? null;
  // 도로명 주소가 빈 문자열로 오는 경우가 있어(실측) ??가 아니라 ||로 지번 주소까지 넘어가게 한다.
  const address = place.roadAddress || place.address;
  const hasLocation = place.latitude !== null && place.longitude !== null;

  return (
    <BottomSheet index={0} snapPoints={["45%"]} enableDynamicSizing={false} enablePanDownToClose onClose={onClose}>
      <BottomSheetView style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText weight="medium" style={{ fontSize: 16 }}>
              {place.placeName}
            </AppText>
            {category && <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{category}</AppText>}
            {address && <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{address}</AppText>}
            {!hasLocation && (
              <AppText style={{ fontSize: 12, color: colors.accent }}>위치 확인 안됨 · 지도에 안 뜰 수 있어요</AppText>
            )}
          </View>
          <SheetCloseButton onPress={onClose} />
        </View>

        {(mapUrl || telUrl) && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {mapUrl && (
              <PressableScale
                onPress={() => openExternal(mapUrl)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Feather name="map" size={14} color={colors.ink} />
                <AppText style={{ fontSize: 13 }}>카카오맵에서 보기</AppText>
              </PressableScale>
            )}
            {telUrl && (
              <PressableScale
                onPress={() => openExternal(telUrl)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Feather name="phone" size={14} color={colors.ink} />
                <AppText style={{ fontSize: 13 }}>전화 걸기</AppText>
              </PressableScale>
            )}
          </View>
        )}

        <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
          영상에서 찾은 장소라 리뷰 요약은 아직 볼 수 없어요.
        </AppText>
      </BottomSheetView>
    </BottomSheet>
  );
}
