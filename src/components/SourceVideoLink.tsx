import { Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import type { Place } from "@/lib/api/places";
import { colors, fontSize, radius, space } from "@/lib/theme";

const PLATFORM_LABEL: Record<Place["sourcePlatform"], string> = {
  INSTAGRAM: "인스타그램",
  YOUTUBE: "유튜브",
};

const PLATFORM_ICON: Record<Place["sourcePlatform"], "instagram" | "youtube"> = {
  INSTAGRAM: "instagram",
  YOUTUBE: "youtube",
};

// 장소를 뽑아낸 원본 영상으로 돌아가는 링크 — "이 장소가 영상 어디에 나왔지?"를 앱 밖에서
// 직접 찾지 않아도 되게 한다. https 링크를 그대로 열어서, 앱이 설치돼 있으면 유니버설 링크로
// 유튜브/인스타그램 앱이, 아니면 Safari가 열린다.
// compact: 제목 옆에 붙는 작은 원형 버튼(플랫폼 아이콘만). 영상 시트 첫 높이에서 제목 아래 "원본 보기" 한 줄이
// 자리를 차지해 장소가 1곳 반만 보였다(2026-10 QA C3) — 글자 줄을 없애 장소 목록에 자리를 준다.
export function SourceVideoLink({
  url,
  platform,
  compact = false,
}: {
  url: string;
  platform: Place["sourcePlatform"];
  compact?: boolean;
}) {
  if (compact) {
    return (
      <PressableScale
        onPress={() => Linking.openURL(url).catch(() => {})}
        hitSlop={6}
        accessibilityRole="link"
        accessibilityLabel={`${PLATFORM_LABEL[platform]}에서 원본 보기`}
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: colors.borderSubtle,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather name={PLATFORM_ICON[platform]} size={16} color={colors.ink} />
      </PressableScale>
    );
  }
  return (
    <PressableScale
      onPress={() => Linking.openURL(url).catch(() => {})}
      hitSlop={10}
      style={{ flexDirection: "row", alignItems: "center", gap: space.xxs, alignSelf: "flex-start" }}
    >
      <Feather name="external-link" size={13} color={colors.inkMuted} />
      <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{PLATFORM_LABEL[platform]}에서 원본 보기</AppText>
    </PressableScale>
  );
}
