import { Text, type TextProps } from "react-native";

// 별점/팁/리뷰 반응처럼 감성적인 콘텐츠 자리에만 쓴다 — 탭바·버튼 같은
// 기능성 아이콘은 Feather를 그대로 쓴다.
export function Emoji({ symbol, size = 14, style, ...props }: TextProps & { symbol: string; size?: number }) {
  return (
    <Text style={[{ fontFamily: "Tossface", fontSize: size }, style]} {...props}>
      {symbol}
    </Text>
  );
}
