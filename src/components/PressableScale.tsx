import { Pressable } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> };

// 토스 스타일 누름 피드백 — 눌리는 순간 살짝(0.97) 작아졌다가 스프링으로 복귀한다.
// "동작 줄이기"(reduce motion) 켜져 있으면 스케일 자체를 안 건드려서 접근성 설정을
// 존중한다. 버튼/리스트 행처럼 "누를 수 있다"는 걸 알려줘야 하는 곳에 Pressable
// 대신 이걸 쓴다.
export function PressableScale({ style, onPressIn, onPressOut, children, ...props }: Props) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        if (!reducedMotion) {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
