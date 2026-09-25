import { useEffect, useRef } from "react";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import { colors } from "@/lib/theme";

type DayPickerSheetProps = {
  visible: boolean;
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
export function DayPickerSheet({ visible, dayNumbers, currentDay, onSelect, onClose }: DayPickerSheetProps) {
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={() => {
        haptics.light();
        onClose();
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: 16, paddingBottom: 32, gap: 4 }}>
        <AppText weight="medium" style={{ fontSize: 16, marginBottom: 8 }}>
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
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRadius: 8,
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
