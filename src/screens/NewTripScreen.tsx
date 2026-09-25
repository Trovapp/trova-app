import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { AppText, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import { createTrip, TRIP_TITLE_MAX_LENGTH } from "@/lib/api/trips";
import { formatDateLabel, toDateString } from "@/lib/date";
import { colors } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "NewTrip">;

export function NewTripScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이름을 입력한 채로 뒤로 가면(버튼·스와이프 모두) 입력이 말없이 사라지므로 한 번 확인한다.
  // 제출에 성공하면 submitting이 true인 채로 replace되므로 그때는 막지 않는다.
  usePreventRemove(title.trim() !== "" && !submitting, ({ data }) => {
    Alert.alert("작성을 그만둘까요?", "입력한 여행 이름이 사라져요.", [
      { text: "계속 작성", style: "cancel" },
      { text: "나가기", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const trip = await createTrip(title.trim(), toDateString(startDate), toDateString(endDate));
      haptics.success();
      // replace는 아래에 깔린 여행 목록 화면을 unmount하지 않는다 — 무효화해두지 않으면
      // 뒤로 가기로 돌아왔을 때 방금 만든 여행이 목록에 없다.
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      navigation.replace("TripDetail", { id: trip.id });
    } catch {
      setError("여행을 만들지 못했어요. 날짜를 확인하고 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
      <TextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        value={title}
        onChangeText={setTitle}
        placeholder="예: 김해 당일치기"
        maxLength={TRIP_TITLE_MAX_LENGTH}
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
          <PressableScale
            onPress={() => {
              setShowEndPicker(false);
              setShowStartPicker(true);
            }}
            style={{ height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, justifyContent: "center", paddingHorizontal: 12 }}
          >
            <AppText>{formatDateLabel(startDate)}</AppText>
          </PressableScale>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText style={{ fontSize: 12, color: colors.inkMuted }}>도착일</AppText>
          <PressableScale
            onPress={() => {
              setShowStartPicker(false);
              setShowEndPicker(true);
            }}
            style={{ height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, justifyContent: "center", paddingHorizontal: 12 }}
          >
            <AppText>{formatDateLabel(endDate)}</AppText>
          </PressableScale>
        </View>
      </View>

      {showStartPicker && (
        <View style={{ gap: 4 }}>
          <DateTimePicker
            value={startDate}
            mode="date"
            locale="ko-KR"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            // onChange는 라이브러리 9.x에서 deprecated(개발 빌드 경고) — 선택은 onValueChange, 취소는 onDismiss.
            onValueChange={(_, selected) => {
              // iOS 인라인 스피너는 스스로 닫히지 않는다 — 아래 "확인"으로만 닫는다.
              if (Platform.OS !== "ios") setShowStartPicker(false);
              setStartDate(selected);
              // 출발일이 도착일보다 늦어지면 도착일도 함께 밀어준다(웹과 동일한 보정).
              if (selected > endDate) setEndDate(selected);
            }}
            onDismiss={() => setShowStartPicker(false)}
          />
          {Platform.OS === "ios" && (
            <PressableScale onPress={() => setShowStartPicker(false)} style={{ alignSelf: "flex-end" }}>
              <AppText weight="medium" style={{ fontSize: 13, color: colors.accent }}>
                확인
              </AppText>
            </PressableScale>
          )}
        </View>
      )}
      {showEndPicker && (
        <View style={{ gap: 4 }}>
          <DateTimePicker
            value={endDate}
            mode="date"
            locale="ko-KR"
            minimumDate={startDate}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onValueChange={(_, selected) => {
              if (Platform.OS !== "ios") setShowEndPicker(false);
              setEndDate(selected);
            }}
            onDismiss={() => setShowEndPicker(false)}
          />
          {Platform.OS === "ios" && (
            <PressableScale onPress={() => setShowEndPicker(false)} style={{ alignSelf: "flex-end" }}>
              <AppText weight="medium" style={{ fontSize: 13, color: colors.accent }}>
                확인
              </AppText>
            </PressableScale>
          )}
        </View>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <PressableScale
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
        <AppText weight="medium" style={{ color: colors.onAccent }}>
          {submitting ? "만드는 중..." : "여행 만들기"}
        </AppText>
      </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
