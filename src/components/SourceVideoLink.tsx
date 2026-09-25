import { Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import type { Place } from "@/lib/api/places";
import { colors } from "@/lib/theme";

const PLATFORM_LABEL: Record<Place["sourcePlatform"], string> = {
  INSTAGRAM: "인스타그램",
  YOUTUBE: "유튜브",
};

// 장소를 뽑아낸 원본 영상으로 돌아가는 링크 — "이 장소가 영상 어디에 나왔지?"를 앱 밖에서
// 직접 찾지 않아도 되게 한다. https 링크를 그대로 열어서, 앱이 설치돼 있으면 유니버설 링크로
// 유튜브/인스타그램 앱이, 아니면 Safari가 열린다.
export function SourceVideoLink({ url, platform }: { url: string; platform: Place["sourcePlatform"] }) {
  return (
    <PressableScale
      onPress={() => Linking.openURL(url).catch(() => {})}
      hitSlop={10}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
    >
      <Feather name="external-link" size={13} color={colors.inkMuted} />
      <AppText style={{ fontSize: 13, color: colors.inkMuted }}>{PLATFORM_LABEL[platform]}에서 원본 보기</AppText>
    </PressableScale>
  );
}
