import { Text, type TextProps } from "react-native";
import { colors } from "@/lib/theme";

// 본문은 웹(trova-frontend globals.css)과 같은 Pretendard(SIL OFL 1.1, assets/fonts/pretendard/PRETENDARD_LICENSE.txt).
// 예전엔 Pretendard를 못 불러와 Noto Sans KR로 대신했는데, 폰트 파일을 앱에 넣고 expo-font로 불러오면 된다(2026-10-03 교체).
// 토스 전용 서체(Toss Product Sans)는 외부 공개가 안 돼 쓸 수 없고, Pretendard가 가장 가까운 공개 서체다.
// IBM Plex Mono는 주소/시간 같은 작은 메타 텍스트에만 좁게 쓴다 — 웹의 PlaceCard/VideoCard와 동일한 용도.
// bold(700)는 화면당 딱 한 곳(진짜 히어로 지점)에만 쓰는 굵기다 — 위계를
// 만드는 용도지 강조하고 싶은 곳마다 쓰는 기본값이 아니다.
// iOS "글자 크기"(Dynamic Type)를 따라 커지되 이 배수까지만 — 상한이 없으면 최대 접근성
// 크기에서 높이가 고정된 버튼/입력창(40~52pt) 안의 글자가 위아래로 잘린다(시뮬레이터 실측).
// 1.4배면 가장 큰 버튼 글자(16pt)도 22pt로 52pt 버튼 안에 들어간다. TextInput도 같은 값을 쓴다.
export const MAX_FONT_SCALE = 1.4;
// App.tsx의 useFonts 이름과 같아야 한다. 입력창(TextInput)처럼 AppText를 못 쓰는 곳도 이 값을 쓴다.
export const FONT = {
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  bold: "Pretendard-Bold",
} as const;
// 한글을 글자 단위가 아니라 단어(어절) 단위로 줄바꿈한다(iOS). 기본값은 "여행 영 / 상을", "찾 / 아"처럼
// 단어 중간에서 끊겼다(작은 화면·큰 글자에서 실측). 화면에서 따로 지정하면 그 값이 이긴다.
const LINE_BREAK = { lineBreakStrategyIOS: "hangul-word" } as const;

export function AppText({
  weight = "regular",
  mono = false,
  style,
  ...props
}: TextProps & { weight?: "regular" | "medium" | "bold"; mono?: boolean }) {
  const fontFamily = mono
    ? "IBMPlexMono_400Regular"
    : weight === "bold"
      ? FONT.bold
      : weight === "medium"
        ? FONT.medium
        : FONT.regular;
  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} {...LINE_BREAK} style={[{ fontFamily, color: colors.ink }, style]} {...props} />;
}
