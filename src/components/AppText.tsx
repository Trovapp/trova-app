import { Text, type TextProps } from "react-native";
import { colors } from "@/lib/theme";

// 본문은 웹과 동일하게 Noto Sans KR(Pretendard 대체 — 아티팩트/Expo에서
// Pretendard 자체 폰트를 못 불러와 가장 가까운 구글 폰트로 대체했고,
// 여기서도 같은 이유로 이 폰트를 쓴다). IBM Plex Mono는 주소/시간 같은
// 작은 메타 텍스트에만 좁게 쓴다 — 웹의 PlaceCard/VideoCard와 동일한 용도.
// bold(700)는 화면당 딱 한 곳(진짜 히어로 지점)에만 쓰는 굵기다 — 위계를
// 만드는 용도지 강조하고 싶은 곳마다 쓰는 기본값이 아니다.
export function AppText({
  weight = "regular",
  mono = false,
  style,
  ...props
}: TextProps & { weight?: "regular" | "medium" | "bold"; mono?: boolean }) {
  const fontFamily = mono
    ? "IBMPlexMono_400Regular"
    : weight === "bold"
      ? "NotoSansKR_700Bold"
      : weight === "medium"
        ? "NotoSansKR_500Medium"
        : "NotoSansKR_400Regular";
  return <Text style={[{ fontFamily, color: colors.ink }, style]} {...props} />;
}
