import { useState, type ReactNode } from "react";
import { Pressable } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated";
import { colors } from "@/lib/theme";

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// 화면 끝까지 닿는 리스트 행 전용 프레스 피드백 — PressableScale(카드/버튼)처럼
// 스케일하면 행 하나가 아니라 "화면 전체가 눌리는" 것처럼 보여서, 배경 하이라이트로만
// 눌림을 표현한다. 제스처가 아니라 상태 전환이라 셰어드 값 없이 CSS 트랜지션만 쓴다.
export function PressableRow({ style, onPressIn, onPressOut, children, ...props }: Props) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
    >
      <Animated.View
        style={[
          style,
          {
            backgroundColor: pressed && !reducedMotion ? colors.bgMuted : "transparent",
            transitionProperty: "backgroundColor",
            transitionDuration: "120ms",
            transitionTimingFunction: EASE_OUT,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
