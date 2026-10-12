import { Pressable, Text, View } from "react-native";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 웹(PWA)용 날짜·시간 선택(ADR 0013). @react-native-community/datetimepicker는 웹을 지원하지 않아
// metro.config.js가 웹 빌드에서만 이 파일로 바꿔 끼운다. 화면 코드는 그대로 — 웹은 안드로이드처럼 고르면 바로 확정된다.
type Props = {
  value: Date;
  mode?: "date" | "time";
  minimumDate?: Date;
  maximumDate?: Date;
  onValueChange?: (event: { type: "set" }, date: Date) => void;
  onDismiss?: () => void;
  [key: string]: unknown;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function DateTimePicker({ value, mode = "date", minimumDate, maximumDate, onValueChange, onDismiss }: Props) {
  const isTime = mode === "time";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <input
        type={isTime ? "time" : "date"}
        aria-label={isTime ? "시간 선택" : "날짜 선택"}
        value={isTime ? toTimeValue(value) : toDateValue(value)}
        min={!isTime && minimumDate ? toDateValue(minimumDate) : undefined}
        max={!isTime && maximumDate ? toDateValue(maximumDate) : undefined}
        style={{ fontSize: fontSize.body, padding: space.xs, borderRadius: radius.sm, border: `1px solid ${colors.border}`, color: colors.ink, background: colors.bg }}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          if (!raw) return;
          const next = new Date(value);
          if (isTime) {
            const [h, m] = raw.split(":").map(Number);
            next.setHours(h, m, 0, 0);
          } else {
            const [y, mo, d] = raw.split("-").map(Number);
            next.setFullYear(y, mo - 1, d);
          }
          onValueChange?.({ type: "set" }, next);
        }}
      />
      {onDismiss && (
        <Pressable accessibilityRole="button" onPress={onDismiss}>
          <Text style={{ color: colors.inkMuted }}>닫기</Text>
        </Pressable>
      )}
    </View>
  );
}
