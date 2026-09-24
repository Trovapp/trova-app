import type { ReactNode } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors } from "@/lib/theme";

type PlaceRowItem = {
  id: number;
  placeName: string;
  address: string | null;
  // 없으면(undefined) 위치 확인 뱃지를 판단할 근거가 없다고 보고 표시하지 않는다 —
  // 이 필드를 안 넘기는 호출부(예: 찜한 장소)까지 전부 "위치 확인 안됨"으로 잘못
  // 보이게 되는 걸 막는다. 실제로 지오코딩이 실패한 장소만(값이 null) 뱃지가 뜬다.
  latitude?: number | null;
  longitude?: number | null;
};

type PlaceRowProps = {
  place: PlaceRowItem;
  index: number;
  isLast: boolean;
  distanceKm: number | null;
  editable?: boolean;
  disabled?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onOpenDayPicker?: () => void;
  // 위/아래 버튼 대신 드래그로 순서를 바꾸는 화면(여행 상세)에서 전달한다 —
  // 있으면 화살표 대신 드래그 핸들을 렌더링한다.
  dragHandle?: { onPressIn: () => void };
  // 있으면 이름/주소 영역을 탭해서 장소 상세(리뷰 요약)를 열 수 있게 한다.
  onPressInfo?: () => void;
  // 있으면 "⋮" 더보기 메뉴 진입점을 렌더링한다(대안 찾기/비서/삭제 등 자주 안
  // 쓰는 동작을 한데 묶는 곳 — 실제 메뉴 내용은 호출부 책임).
  onOpenMenu?: () => void;
  color?: string;
  children?: ReactNode;
};

export function PlaceRow({
  place,
  index,
  isLast,
  distanceKm,
  editable = false,
  disabled = false,
  onMoveUp,
  onMoveDown,
  onOpenDayPicker,
  dragHandle,
  onPressInfo,
  onOpenMenu,
  color = colors.accent,
  children,
}: PlaceRowProps) {
  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          paddingVertical: 14,
          borderTopWidth: index === 0 ? 0 : 1,
          borderTopColor: colors.borderSubtle,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: color,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: colors.onAccent, fontSize: 12 }}>
            {index + 1}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <PressableScale onPress={onPressInfo} disabled={!onPressInfo}>
            <AppText weight="medium" numberOfLines={1}>
              {place.placeName}
            </AppText>
            {place.address && (
              <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                {place.address}
              </AppText>
            )}
            {place.latitude === null && place.longitude === null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="alert-triangle" size={11} color={colors.accent} />
                <AppText style={{ fontSize: 11, color: colors.accent }}>위치 확인 안됨 · 지도에 안 뜰 수 있어요</AppText>
              </View>
            )}
          </PressableScale>
          {editable && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {!dragHandle && (onMoveUp || onMoveDown) && (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <PressableScale
                    onPress={onMoveUp}
                    disabled={disabled || index === 0 || !onMoveUp}
                    style={{ opacity: disabled || index === 0 ? 0.3 : 1 }}
                  >
                    <Feather name="arrow-up" size={14} color={colors.inkMuted} />
                  </PressableScale>
                  <PressableScale
                    onPress={onMoveDown}
                    disabled={disabled || isLast || !onMoveDown}
                    style={{ opacity: disabled || isLast ? 0.3 : 1 }}
                  >
                    <Feather name="arrow-down" size={14} color={colors.inkMuted} />
                  </PressableScale>
                </View>
              )}
              {onOpenDayPicker && (
                <PressableScale onPress={onOpenDayPicker} disabled={disabled}>
                  <AppText style={{ fontSize: 13, color: colors.inkMuted }}>다른 날로 이동</AppText>
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
            hitSlop={10}
            style={{ justifyContent: "center", alignItems: "center", paddingHorizontal: 4 }}
          >
            <Feather name="more-vertical" size={18} color={colors.inkMuted} />
          </PressableScale>
        )}
        {dragHandle && (
          <PressableScale
            onPressIn={dragHandle.onPressIn}
            disabled={disabled}
            hitSlop={12}
            style={{ justifyContent: "center", paddingHorizontal: 4, opacity: disabled ? 0.3 : 1 }}
          >
            <AppText style={{ fontSize: 18, color: colors.inkMuted }}>⠿</AppText>
          </PressableScale>
        )}
      </View>
      {!isLast && distanceKm !== null && (
        <AppText style={{ fontSize: 11, color: colors.inkMuted, marginLeft: 38 }}>
          다음 장소까지 {distanceKm.toFixed(1)}km
        </AppText>
      )}
    </View>
  );
}
