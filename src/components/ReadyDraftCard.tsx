import { ActivityIndicator, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { hitSlopFor } from "@/lib/touch";
import type { AutoDraft } from "@/lib/api/tripDrafts";
import { cleanVideoTitle } from "@/lib/videoTitle";

// 영상 분석이 끝나면 서버가 알아서 일정 초안을 만들어 둔다(백엔드 auto-draft) — 사용자가 직접 "일정 짜기"를
// 누르지 않아도 홈에서 바로 결과를 보거나(READY), 짜는 중인 걸 알 수 있다(PENDING/PROCESSING).
// 닫기는 다시 묻지 않게 숨기기만 하고(dismiss), 승인된 초안은 화면 자체가 사라진다(홈에서 목록을 다시 불러옴).
// 달력 아이콘(18)과 ActivityIndicator(small, 약 20)를 같은 폭에 맞춘다.
const ICON_BOX = 20;

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
  // "#제주 #혼행" 같은 해시태그가 제목 뒤에 붙어 있으면 한 줄(numberOfLines=1)에서 일수가 잘려 안 보인다 —
  // 분석 화면과 같은 규칙(cleanVideoTitle)으로 정리한 뒤에 일수를 붙인다.
  const cleanTitle = cleanVideoTitle(draft.videoTitle);
  // 일수를 앞에 둔다 — 큰 글자에서 "보기 ›"까지 한 줄에 들어가면 제목 뒤의 일수가 잘렸다(디자인 QA 2026-10-07).
  const subtitleParts = [draft.days != null ? `${draft.days}일` : null, cleanTitle].filter(
    (part): part is string => Boolean(part),
  );
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null;

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
        // 디자인 QA(2026-10-07): 준비된 카드·짜는 중 카드·비 소식 배너가 모두 같은 연분홍이라 무엇을 누를 수 있는지
        // 구분되지 않았다 — 누를 수 있는 준비된 카드만 강조색 배경 + "보기 ›", 짜는 중은 차분한 회색으로 둔다.
        backgroundColor: ready ? colors.accentBg : colors.bgMuted,
      }}
    >
      {/* 달력 아이콘과 로딩 표시의 폭이 달라 두 카드의 글자 시작 위치가 어긋났다 — 같은 폭의 칸에 넣는다. */}
      <View style={{ width: ICON_BOX, alignItems: "center" }}>
        {ready ? (
          <Feather name="calendar" size={18} color={colors.accent} />
        ) : (
          <ActivityIndicator size="small" color={colors.inkMuted} />
        )}
      </View>
      <View style={{ flex: 1, gap: space.xxxs }}>
        <AppText weight="medium" style={{ fontSize: fontSize.footnote }}>
          {ready ? "일정이 준비됐어요" : "일정을 짜고 있어요"}
        </AppText>
        {/* 짜는 중일 때도 어떤 영상인지 알 수 있게 제목을 보여 준다(일수는 정해지기 전이면 빠진다). */}
        {subtitle && (
          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {ready && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxxs }}>
          <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.accent }}>
            보기
          </AppText>
          <Feather name="chevron-right" size={14} color={colors.accent} />
        </View>
      )}
      <PressableScale onPress={onDismiss} hitSlop={hitSlopFor(16)} accessibilityLabel="일정 초안 닫기">
        <Feather name="x" size={16} color={colors.inkMuted} />
      </PressableScale>
    </PressableScale>
  );
}
