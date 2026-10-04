import { useState } from "react";
import { Image, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Place } from "@/lib/api/places";
import { youtubeThumbnailUrl } from "@/lib/shareUrl";
import { colors, radius } from "@/lib/theme";

export const PLATFORM_LABEL: Record<Place["sourcePlatform"], string> = {
  INSTAGRAM: "인스타그램",
  YOUTUBE: "유튜브",
};

// 영상 썸네일. 예전엔 모든 행 맨 위에 "유튜브" 글자만 반복돼 영상을 구분할 단서가 제목뿐이었다(2026-10 QA C4).
// 썸네일을 못 얻는 경우(인스타그램, 지워진 영상 등 불러오기 실패)는 플랫폼 아이콘 타일로 대신한다.
// 영상 기록과 "영상으로 일정 짜기"에서 같은 영상이 같게 보이도록 함께 쓴다(디자인 QA P1).
export function VideoThumb({ sourceUrl, platform, size = 56 }: { sourceUrl: string; platform: Place["sourcePlatform"]; size?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = platform === "YOUTUBE" ? youtubeThumbnailUrl(sourceUrl) : null;
  const box = { width: size, height: size, borderRadius: radius.sm, borderCurve: "continuous" as const };
  if (!uri || failed) {
    return (
      <View
        accessibilityLabel={PLATFORM_LABEL[platform]}
        style={{ ...box, backgroundColor: colors.borderSubtle, justifyContent: "center", alignItems: "center" }}
      >
        <Feather name={platform === "YOUTUBE" ? "youtube" : "instagram"} size={20} color={colors.inkMuted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel={`${PLATFORM_LABEL[platform]} 영상 썸네일`}
      style={{ ...box, backgroundColor: colors.borderSubtle }}
    />
  );
}
