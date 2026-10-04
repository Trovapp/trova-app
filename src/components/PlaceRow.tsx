import type { ReactNode } from "react";
import { View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { kakaoMapUrl, openExternal, phoneUrl } from "@/lib/placeLinks";
import { categoryGroupInfo } from "@/lib/placeCategory";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { hitSlopFor } from "@/lib/touch";

type PlaceRowItem = {
  id: number;
  placeName: string;
  address: string | null;
  // 없으면(undefined) 위치 확인 뱃지를 판단할 근거가 없다고 보고 표시하지 않는다 —
  // 이 필드를 안 넘기는 호출부(예: 찜한 장소)까지 전부 "위치 확인 안됨"으로 잘못
  // 보이게 되는 걸 막는다. 실제로 지오코딩이 실패한 장소만(값이 null) 뱃지가 뜬다.
  latitude?: number | null;
  longitude?: number | null;
  // 영상에서 뽑은 장소(Place)는 둘 다, 여행 장소(TripPlace)는 phone만 내려온다.
  phone?: string | null;
  kakaoPlaceUrl?: string | null;
  category?: string | null;
};


type PlaceRowProps = {
  place: PlaceRowItem;
  index: number;
  isLast: boolean;
  distanceKm: number | null;
  editable?: boolean;
  disabled?: boolean;
  onOpenDayPicker?: () => void;
  // 있으면 드래그 핸들을 렌더링한다 — 순서 변경이 필요한 화면(여행 상세,
  // 영상 속 장소)은 전부 드래그 방식이라 항상 이걸 넘긴다.
  dragHandle?: { onPressIn: () => void };
  // 있으면 이름/주소 영역을 탭해서 장소 상세(리뷰 요약)를 열 수 있게 한다.
  onPressInfo?: () => void;
  // 있으면 "⋮" 더보기 메뉴 진입점을 렌더링한다(대안 찾기/비서/삭제 등 자주 안
  // 쓰는 동작을 한데 묶는 곳 — 실제 메뉴 내용은 호출부 책임).
  onOpenMenu?: () => void;
  color?: string;
  // 카카오맵/전화 링크 줄. 행 아래에 편집 줄(children)과 "⋮" 메뉴가 따로 있는 화면(여행 상세)은
  // 줄이 너무 많아지므로 끄고 메뉴 쪽에 넣는다.
  showLinks?: boolean;
  // 번호 원에 보일 숫자. 분류 필터로 일부만 보일 때도 원래 순서 번호를 유지하려고 따로 받는다(기본: index + 1).
  number?: number;
  // 주소 앞에 분류 아이콘과 이름을 붙인다(영상 속 장소 결과 화면). 여행 상세 등 다른 화면은 지금 모습을 유지한다.
  showCategory?: boolean;
  children?: ReactNode;
};

export function PlaceRow({
  place,
  index,
  isLast,
  distanceKm,
  editable = false,
  disabled = false,
  onOpenDayPicker,
  dragHandle,
  onPressInfo,
  onOpenMenu,
  color = colors.accent,
  showLinks = true,
  number,
  showCategory = false,
  children,
}: PlaceRowProps) {
  const categoryInfo = showCategory ? categoryGroupInfo(place.category) : null;
  const mapUrl = showLinks ? kakaoMapUrl(place) : null;
  const telUrl = showLinks ? phoneUrl(place) : null;
  const showDayPicker = editable && !!onOpenDayPicker;
  return (
    <View style={{ gap: space.xxs }}>
      <View
        style={{
          flexDirection: "row",
          gap: space.sm,
          paddingVertical: space.md,
          borderTopWidth: index === 0 ? 0 : 1,
          borderTopColor: colors.borderSubtle,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.full,
            backgroundColor: color,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: colors.onAccent, fontSize: fontSize.caption1 }}>
            {number ?? index + 1}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <PressableScale onPress={onPressInfo} disabled={!onPressInfo}>
            <AppText weight="medium" numberOfLines={1}>
              {place.placeName}
            </AppText>
            {(categoryInfo || place.address) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                {categoryInfo && (
                  <>
                    <MaterialCommunityIcons name={categoryInfo.icon} size={12} color={colors.accent} />
                    <AppText style={{ fontSize: fontSize.caption1, color: colors.accent }}>{categoryInfo.label}</AppText>
                    {place.address && <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>·</AppText>}
                  </>
                )}
                {place.address && (
                  <AppText style={{ flexShrink: 1, fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
                    {place.address}
                  </AppText>
                )}
              </View>
            )}
            {place.latitude === null && place.longitude === null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                <Feather name="alert-triangle" size={11} color={colors.accent} />
                <AppText style={{ fontSize: fontSize.caption2, color: colors.accent }}>위치 확인 안됨 · 지도에 안 뜰 수 있어요</AppText>
              </View>
            )}
          </PressableScale>
          {(showDayPicker || mapUrl || telUrl) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              {showDayPicker && (
                <PressableScale onPress={onOpenDayPicker} disabled={disabled} hitSlop={{ top: 8, bottom: 8 }}>
                  <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>다른 날로 이동</AppText>
                </PressableScale>
              )}
              {mapUrl && (
                <PressableScale
                  onPress={() => openExternal(mapUrl)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}
                >
                  <Feather name="map" size={12} color={colors.inkMuted} />
                  <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>카카오맵</AppText>
                </PressableScale>
              )}
              {telUrl && (
                <PressableScale
                  onPress={() => openExternal(telUrl)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}
                >
                  <Feather name="phone" size={12} color={colors.inkMuted} />
                  <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>전화</AppText>
                </PressableScale>
              )}
            </View>
          )}
          {children}
        </View>
        {onOpenMenu && (
          <PressableScale
            onPress={onOpenMenu}
            disabled={disabled}
            hitSlop={hitSlopFor(26, 18, 10)}
            style={{ justifyContent: "center", alignItems: "center", paddingHorizontal: space.xxs }}
          >
            <Feather name="more-vertical" size={18} color={colors.inkMuted} />
          </PressableScale>
        )}
        {dragHandle && (
          <PressableScale
            onPressIn={dragHandle.onPressIn}
            disabled={disabled}
            hitSlop={hitSlopFor(26, 18, 12)}
            // 점자 글자(⠿)를 손잡이로 쓰던 것을 iOS 목록 순서 바꾸기와 같은 가로줄 3개 아이콘으로 바꿨다(2026-10 QA).
            // 바로 옆 ⋮ 메뉴와 구분되게 왼쪽에 간격을 조금 더 둔다.
            style={{ justifyContent: "center", paddingHorizontal: space.xxs, marginLeft: space.xxs, opacity: disabled ? 0.3 : 1 }}
          >
            <Feather name="menu" size={18} color={colors.inkMuted} />
          </PressableScale>
        )}
      </View>
      {!isLast && distanceKm !== null && (
        <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted, marginLeft: space.xxxl }}>
          다음 장소까지 {distanceKm.toFixed(1)}km
        </AppText>
      )}
    </View>
  );
}
