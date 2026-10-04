import type { RefObject } from "react";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";

type DayPickerSheetProps = {
  // 여는 쪽이 버튼에서 sheetRef.current?.present()를 바로 부른다(2026-10-04 QA — visible 값으로 효과에서 present()를
  // 부르면 영상 화면에서 시트가 열리지 않았다. present()는 불렸지만 애니메이션이 시작되지 않음).
  sheetRef: RefObject<BottomSheetModal | null>;
  dayNumbers: number[];
  currentDay: number | null;
  onSelect: (day: number) => void;
  onClose: () => void;
};

// 2026-09: 배경 탭으로만 닫히던 Modal 기반 시트를 @gorhom/bottom-sheet의
// BottomSheetModal로 바꿔서 드래그로도 닫히게 했다 — 직접 제스처를 구현하지
// 않고 이미 프로젝트에 있던(SavedPlacesScreen에서 이미 씀) 검증된 라이브러리를
// 그대로 재사용. onClose는 onDismiss(드래그/배경탭/dismiss() 호출 전부 포함해
// 시트가 실제로 닫혔을 때 딱 한 번만 발생)에만 연결해서 이중 호출을 피한다.
export function DayPickerSheet({ sheetRef, dayNumbers, currentDay, onSelect, onClose }: DayPickerSheetProps) {
  const ref = sheetRef;

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={() => {
        onClose();
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: space.md, paddingBottom: space.xxl, gap: space.xxs }}>
        <AppText weight="medium" style={{ fontSize: fontSize.callout, marginBottom: space.xs }}>
          어느 날로 옮길까요?
        </AppText>
        {dayNumbers.map((day) => (
          <PressableScale
            key={day}
            onPress={() => {
              onSelect(day);
              ref.current?.dismiss();
            }}
            disabled={day === currentDay}
            style={{
              paddingVertical: space.sm,
              paddingHorizontal: space.xs,
              borderRadius: radius.sm,
              backgroundColor: day === currentDay ? colors.bgMuted : "transparent",
            }}
          >
            <AppText style={day === currentDay ? { color: colors.inkMuted } : undefined}>
              {day}일차{day === currentDay ? " (현재)" : ""}
            </AppText>
          </PressableScale>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
