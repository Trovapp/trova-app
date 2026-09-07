import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppText } from "@/components/AppText";
import { createTrip } from "@/lib/api/trips";
import { toDateString } from "@/lib/date";
import { colors } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "NewTrip">;

export function NewTripScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const trip = await createTrip(title.trim(), toDateString(startDate), toDateString(endDate));
      navigation.replace("TripDetail", { id: trip.id });
    } catch {
      setError("여행을 만들지 못했어요. 날짜를 확인하고 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <AppText weight="medium" style={{ fontSize: 20 }}>
        새 여행 만들기
      </AppText>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="예: 김해 당일치기"
        autoFocus
        style={{
          height: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          fontFamily: "NotoSansKR_400Regular",
        }}
      />

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText style={{ fontSize: 12, color: colors.inkMuted }}>출발일</AppText>
          <Pressable
            onPress={() => setShowStartPicker(true)}
            style={{ height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, justifyContent: "center", paddingHorizontal: 12 }}
          >
            <AppText>{toDateString(startDate)}</AppText>
          </Pressable>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText style={{ fontSize: 12, color: colors.inkMuted }}>도착일</AppText>
          <Pressable
            onPress={() => setShowEndPicker(true)}
            style={{ height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, justifyContent: "center", paddingHorizontal: 12 }}
          >
            <AppText>{toDateString(endDate)}</AppText>
          </Pressable>
        </View>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, selected) => {
            setShowStartPicker(Platform.OS === "ios");
            if (selected) {
              setStartDate(selected);
              // 출발일이 도착일보다 늦어지면 도착일도 함께 밀어준다(웹과 동일한 보정).
              if (selected > endDate) setEndDate(selected);
            }
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={startDate}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, selected) => {
            setShowEndPicker(Platform.OS === "ios");
            if (selected) setEndDate(selected);
          }}
        />
      )}

      {error && <AppText style={{ color: colors.accent }}>{error}</AppText>}

      <Pressable
        onPress={handleSubmit}
        disabled={!title.trim() || submitting}
        style={{
          height: 48,
          borderRadius: 12,
          backgroundColor: colors.accent,
          justifyContent: "center",
          alignItems: "center",
          opacity: !title.trim() || submitting ? 0.6 : 1,
        }}
      >
        <AppText weight="medium" style={{ color: "#fff" }}>
          {submitting ? "만드는 중..." : "여행 만들기"}
        </AppText>
      </Pressable>
    </View>
  );
}
