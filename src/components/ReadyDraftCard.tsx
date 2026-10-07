import { ActivityIndicator, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { hitSlopFor } from "@/lib/touch";
import type { AutoDraft } from "@/lib/api/tripDrafts";

// 영상 분석이 끝나면 서버가 알아서 일정 초안을 만들어 둔다(백엔드 auto-draft) — 사용자가 직접 "일정 짜기"를
// 누르지 않아도 홈에서 바로 결과를 보거나(READY), 짜는 중인 걸 알 수 있다(PENDING/PROCESSING).
// 닫기는 다시 묻지 않게 숨기기만 하고(dismiss), 승인된 초안은 화면 자체가 사라진다(홈에서 목록을 다시 불러옴).
export function ReadyDraftCard({
  draft,
  onPress,
  onDismiss,
}: {
  draft: AutoDraft;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const ready = draft.status === "READY";
  const subtitleParts = [draft.videoTitle, draft.days != null ? `${draft.days}일` : null].filter(
    (part): part is string => Boolean(part),
  );
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" ") : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={!ready}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.sm,
        borderRadius: radius.md,
        backgroundColor: colors.accentBg,
      }}
    >
      {ready ? (
        <Feather name="calendar" size={18} color={colors.accent} />
      ) : (
        <ActivityIndicator size="small" color={colors.accent} />
      )}
      <View style={{ flex: 1, gap: space.xxxs }}>
        <AppText weight="medium" style={{ fontSize: fontSize.footnote }}>
          {ready ? "일정이 준비됐어요" : "일정을 짜고 있어요"}
        </AppText>
        {ready && subtitle && (
          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      <PressableScale onPress={onDismiss} hitSlop={hitSlopFor(16)} accessibilityLabel="일정 초안 닫기">
        <Feather name="x" size={16} color={colors.inkMuted} />
      </PressableScale>
    </PressableScale>
  );
}
