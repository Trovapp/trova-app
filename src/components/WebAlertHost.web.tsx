import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, View, type AlertButton } from "react-native";
import { AppText } from "@/components/AppText";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 웹(PWA)에서는 react-native-web의 Alert.alert가 아무것도 하지 않아, "삭제할까요?" 같은 확인 창이 그냥 무시됐다(ADR 0013).
// 앱 전체에서 쓰는 Alert.alert를 이 확인 창으로 바꿔 끼운다 — 화면 코드는 그대로. 버튼 3개(취소·새로 분석·보러 가기)도 된다.
type Dialog = { title: string; message?: string; buttons: AlertButton[] };

export function WebAlertHost() {
  const [queue, setQueue] = useState<Dialog[]>([]);

  useEffect(() => {
    const original = Alert.alert;
    Alert.alert = (title, message, buttons) => {
      setQueue((q) => [...q, { title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: "확인" }] }]);
    };
    return () => {
      Alert.alert = original;
    };
  }, []);

  const dialog = queue[0];
  if (!dialog) return null;

  function choose(button: AlertButton) {
    setQueue((q) => q.slice(1));
    button.onPress?.();
  }

  const cancel = dialog.buttons.find((b) => b.style === "cancel");
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => choose(cancel ?? { text: "" })}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          accessibilityRole="alert"
          style={{ width: "100%", maxWidth: 340, borderRadius: radius.lg, backgroundColor: colors.bg, padding: space.lg, gap: space.xs }}
        >
          <AppText weight="bold" style={{ fontSize: fontSize.body, textAlign: "center" }}>
            {dialog.title}
          </AppText>
          {dialog.message ? (
            <AppText style={{ fontSize: fontSize.subheadline, color: colors.inkMuted, textAlign: "center" }}>{dialog.message}</AppText>
          ) : null}
          <View style={{ marginTop: space.sm, gap: space.xs }}>
            {dialog.buttons.map((button, i) => {
              const isCancel = button.style === "cancel";
              const isDestructive = button.style === "destructive";
              return (
                <Pressable
                  key={`${button.text}-${i}`}
                  accessibilityRole="button"
                  onPress={() => choose(button)}
                  style={{
                    paddingVertical: space.sm,
                    borderRadius: radius.md,
                    alignItems: "center",
                    backgroundColor: isCancel ? colors.bgMuted : isDestructive ? colors.accent : colors.accentBg,
                  }}
                >
                  <AppText
                    weight="medium"
                    style={{ fontSize: fontSize.callout, color: isCancel ? colors.ink : isDestructive ? colors.onAccent : colors.accent }}
                  >
                    {button.text}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
