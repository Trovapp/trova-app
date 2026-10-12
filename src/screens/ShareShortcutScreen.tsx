import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { ShortcutGuide } from "@/components/ShortcutGuide";
import { getShareKeyStatus, issueShareKey, revokeShareKey } from "@/lib/api/shareKey";
import { toUserMessage } from "@/lib/api/client";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { downloadShortcut } from "@/lib/web/shortcut";

// 아이폰 홈 화면 앱(PWA)은 공유 목록에 뜨지 않아, iOS 단축어 "Trova에 저장"으로 공유 한 번에 저장하게 한다(ADR 0013).
// 단축어가 쓸 공유 전용 키를 여기서 받는다. 키로는 링크 저장만 되고, 다시 받으면 이전 키는 바로 무효가 된다.

function formatTime(value: string | null): string {
  if (!value) return "아직 없음";
  const d = new Date(value);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ShareShortcutScreen() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["share-key"], queryFn: getShareKeyStatus });
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      setKey(await issueShareKey());
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["share-key"] });
    } catch (err) {
      setError(toUserMessage(err, "키를 받지 못했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  function confirmIssue() {
    if (!status.data?.exists) {
      issue();
      return;
    }
    Alert.alert("키를 다시 받을까요?", "지금 단축어에 넣어 둔 키는 바로 쓸 수 없게 돼요. 새 키로 바꿔 넣어야 해요.", [
      { text: "취소", style: "cancel" },
      { text: "다시 받기", style: "destructive", onPress: issue },
    ]);
  }

  function confirmRevoke() {
    Alert.alert("키를 없앨까요?", "단축어로 더는 저장할 수 없게 돼요.", [
      { text: "취소", style: "cancel" },
      {
        text: "없애기",
        style: "destructive",
        onPress: async () => {
          try {
            await revokeShareKey();
            setKey(null);
            queryClient.invalidateQueries({ queryKey: ["share-key"] });
          } catch (err) {
            setError(toUserMessage(err, "키를 없애지 못했어요."));
          }
        },
      },
    ]);
  }

  async function copy() {
    if (!key) return;
    // 이 화면은 웹(PWA)에서만 열린다 — expo-clipboard를 위에서 불러오면 그 모듈이 없는 예전 앱 빌드가 시작하자마자 멈춘다(lib/clipboard.ts).
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setError("복사하지 못했어요. 키를 길게 눌러 직접 복사해 주세요.");
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <AppText weight="bold" style={{ fontSize: fontSize.title3 }}>
          공유 한 번에 Trova에 저장
        </AppText>
        <AppText style={{ fontSize: fontSize.subheadline, color: colors.inkMuted }}>
          아이폰 단축어를 한 번 연결해 두면, 앱을 열지 않고 공유 버튼만으로 영상을 저장할 수 있어요.
        </AppText>
      </View>

      <View style={{ padding: space.md, borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderSubtle, gap: space.sm }}>
        {key ? (
          <>
            <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
              이 화면을 벗어나면 다시 볼 수 없어요. 지금 복사해 단축어에 넣어 주세요.
            </AppText>
            <AppText selectable style={{ fontSize: fontSize.footnote, fontFamily: "IBMPlexMono_400Regular" }}>
              {key}
            </AppText>
            <PressableScale
              accessibilityRole="button"
              onPress={copy}
              style={{ padding: space.sm, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center" }}
            >
              <AppText weight="medium" style={{ color: colors.onAccent }}>
                {copied ? "복사했어요" : "키 복사하기"}
              </AppText>
            </PressableScale>
          </>
        ) : (
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
            {status.data?.exists
              ? `연결된 키가 있어요 · 마지막 사용 ${formatTime(status.data.lastUsedAt)}`
              : "아직 받은 키가 없어요."}
          </AppText>
        )}
        <PressableScale
          accessibilityRole="button"
          onPress={confirmIssue}
          disabled={busy}
          style={{ padding: space.sm, borderRadius: radius.md, backgroundColor: colors.accentBg, alignItems: "center", opacity: busy ? 0.6 : 1 }}
        >
          <AppText weight="medium" style={{ color: colors.accent }}>
            {status.data?.exists ? "키 다시 받기" : "키 받기"}
          </AppText>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          onPress={downloadShortcut}
          style={{ padding: space.sm, borderRadius: radius.md, backgroundColor: colors.bgMuted, alignItems: "center" }}
        >
          <AppText weight="medium">단축어 받기</AppText>
        </PressableScale>
        {error && <AppText style={{ fontSize: fontSize.footnote, color: colors.accent }}>{error}</AppText>}
      </View>

      {status.data?.exists && (
        <PressableScale accessibilityRole="button" onPress={confirmRevoke} style={{ alignSelf: "center", padding: space.xs }}>
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>키 없애기</AppText>
        </PressableScale>
      )}

      <ShortcutGuide />
    </ScrollView>
  );
}
