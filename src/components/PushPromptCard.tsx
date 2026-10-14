import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { enablePush, isPushPromptVisible, snoozePushPrompt } from "@/lib/push";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 웹 푸시 권한 카드(백엔드 #185). 브라우저 권한 창은 [알림 받기]를 눌렀을 때만 — 아이폰은 사용자 동작 안에서만 물을 수 있고,
// 처음부터 띄우면 거절이 많고 한 번 거절하면 다시 물을 수 없다. 앱(네이티브)에서는 늘 숨는다(push.ts).
// 알림을 막아 둔 사람에게 켜는 곳 안내 — 아이폰은 PWA, 안드로이드는 앱 설정.
export const BLOCKED_GUIDE =
  Platform.OS === "android" ? "휴대폰 설정 → 애플리케이션 → Trova → 알림에서 켤 수 있어요." : "iPhone 설정 → 알림 → Trova에서 켤 수 있어요.";

export function PushPromptCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    isPushPromptVisible()
      .then((v) => alive && setVisible(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!visible) return null;

  async function accept() {
    setBusy(true);
    try {
      const status = await enablePush();
      if (status === "blocked") setBlocked(true);
      else setVisible(false);
    } catch {
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Feather name="bell" size={18} color={colors.accent} />
        <AppText weight="bold" style={{ flex: 1 }}>
          {blocked ? "알림이 꺼져 있어요" : "분석이 끝나고 일정이 준비되면 알려 드릴까요?"}
        </AppText>
      </View>
      {blocked ? (
        <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
          {BLOCKED_GUIDE}
        </AppText>
      ) : (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <PressableScale
            onPress={accept}
            disabled={busy}
            accessibilityRole="button"
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <AppText weight="medium" style={{ color: colors.onAccent }}>
              알림 받기
            </AppText>
          </PressableScale>
          <PressableScale
            onPress={() => {
              snoozePushPrompt();
              setVisible(false);
            }}
            accessibilityRole="button"
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText>나중에</AppText>
          </PressableScale>
        </View>
      )}
    </View>
  );
}
