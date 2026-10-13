import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppText } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableScale } from "@/components/PressableScale";
import { setTripDates, type TripDetail } from "@/lib/api/trips";
import { toUserMessage } from "@/lib/api/client";
import { toDateString } from "@/lib/date";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 이미 만든 여행의 날짜를 정하거나 바꾸는 시트(백엔드 #181). 자동 초안으로 만든 여행은 날짜가 없어
// 날씨 확인·비 알림을 못 썼고 날짜를 정할 곳도 없었다(2026-10-13 PWA QA 2회차).
// 시작일만 고르고, 끝나는 날은 일차 수로 정해진다(일차 수 바꾸기는 범위 밖).
export function TripDatesSheet({
  visible,
  tripId,
  startDate,
  dayCount,
  onClose,
  onSaved,
}: {
  visible: boolean;
  tripId: number;
  startDate: string | null;
  dayCount: number;
  onClose: () => void;
  onSaved: (trip: TripDetail) => void;
}) {
  const [draft, setDraft] = useState<Date>(() => (startDate ? new Date(`${startDate}T00:00:00`) : new Date()));
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<BottomSheetModal>(null);
  // 열려 있지 않은 시트에 dismiss()를 부르면 뒤의 present()가 무시됐다(FolderPickerModal과 같은 처리).
  const presented = useRef(false);

  useEffect(() => {
    if (visible) {
      setDraft(startDate ? new Date(`${startDate}T00:00:00`) : new Date());
      setError(null);
      presented.current = true;
      ref.current?.present();
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss();
    }
  }, [visible, startDate]);

  const end = new Date(draft);
  end.setDate(end.getDate() + Math.max(1, dayCount) - 1);
  const label = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await setTripDates(tripId, toDateString(draft));
      onSaved(updated);
    } catch (e) {
      setError(toUserMessage(e, "날짜를 저장하지 못했어요. 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={() => {
        presented.current = false;
        onClose();
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}>
        <View style={{ gap: space.xxs }}>
          <AppText weight="medium" style={{ fontSize: fontSize.callout }}>
            {startDate ? "여행 날짜 바꾸기" : "여행 날짜 정하기"}
          </AppText>
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
            {dayCount > 1
              ? `출발일을 고르면 ${dayCount}일 일정에 맞춰 ${label(end)}까지로 정해져요.`
              : "가는 날을 골라 주세요."}
          </AppText>
        </View>

        {Platform.OS === "android" ? (
          <PressableScale
            onPress={() => setShowAndroidPicker(true)}
            accessibilityRole="button"
            style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
          >
            <AppText>{label(draft)}</AppText>
          </PressableScale>
        ) : (
          <DateTimePicker
            value={draft}
            mode="date"
            locale="ko-KR"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onValueChange={(_, selected) => setDraft(selected)}
          />
        )}
        {Platform.OS === "android" && showAndroidPicker && (
          <DateTimePicker
            value={draft}
            mode="date"
            onValueChange={(_, selected) => {
              setShowAndroidPicker(false);
              setDraft(selected);
            }}
            onDismiss={() => setShowAndroidPicker(false)}
          />
        )}

        {error && <ErrorText>{error}</ErrorText>}

        <PressableScale
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          style={{
            height: 48,
            borderRadius: radius.md,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <AppText weight="medium" style={{ color: colors.onAccent }}>
            {busy ? "저장하는 중..." : dayCount > 1 ? `${label(draft)} ~ ${label(end)}로 저장` : `${label(draft)}로 저장`}
          </AppText>
        </PressableScale>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
