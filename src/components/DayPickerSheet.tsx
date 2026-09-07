import { Modal, Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

type DayPickerSheetProps = {
  visible: boolean;
  dayNumbers: number[];
  currentDay: number | null;
  onSelect: (day: number) => void;
  onClose: () => void;
};

export function DayPickerSheet({ visible, dayNumbers, currentDay, onSelect, onClose }: DayPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 4 }}
          onPress={(e) => e.stopPropagation()}
        >
          <AppText weight="medium" style={{ fontSize: 15, marginBottom: 8 }}>
            어느 날로 옮길까요?
          </AppText>
          {dayNumbers.map((day) => (
            <Pressable
              key={day}
              onPress={() => {
                onSelect(day);
                onClose();
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
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
