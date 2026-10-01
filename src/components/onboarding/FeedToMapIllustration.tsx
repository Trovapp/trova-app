import { useEffect } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 온보딩 첫 장의 "전과 후" 그림: 왼쪽 영상 카드에서 점선을 따라 오른쪽 지도 카드로 장소가 옮겨진다.
// 참고 앱(Plotline)의 "피드 카드 → 지도 카드" 구성만 빌려오고, 그림은 앱 컴포넌트 모양(핀 번호 원,
// 장소 행)으로 직접 그린다. 이미지 파일 없이 View로만 그려 다크 모드나 크기 변화에도 깨지지 않는다.
const CARD_WIDTH = 128;
const CARD_HEIGHT = 196;
const PINS = [
  { top: 46, left: 30 },
  { top: 78, left: 82 },
  { top: 112, left: 46 },
];

function Pin({ index, delay }: { index: number; delay: number }) {
  const reducedMotion = useReducedMotion();
  const drop = useSharedValue(reducedMotion ? 0 : -18);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    const easing = Easing.out(Easing.back(2));
    drop.value = withDelay(delay, withTiming(0, { duration: 420, easing }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
  }, [delay, drop, opacity, reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: drop.value }] }));
  const spot = PINS[index];
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: spot.top,
          left: spot.left,
          width: 22,
          height: 22,
          borderRadius: radius.full,
          backgroundColor: colors.accent,
          borderWidth: 2,
          borderColor: colors.onAccent,
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <AppText weight="medium" style={{ fontSize: fontSize.caption2, color: colors.onAccent }}>
        {index + 1}
      </AppText>
    </Animated.View>
  );
}

// 영상 카드에서 지도 카드로 이어지는 점선. 점 하나가 길을 따라 반복해서 지나가 "옮겨진다"는 느낌을 준다.
function DottedPath() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      600,
      withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })), -1),
    );
  }, [progress, reducedMotion]);

  const travel = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0 : progress.value < 0.05 || progress.value > 0.95 ? 0 : 1,
    transform: [{ translateX: progress.value * 48 }],
  }));

  return (
    <View style={{ width: 56, height: 12, justifyContent: "center", marginHorizontal: space.xxs, zIndex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ width: 5, height: 5, borderRadius: radius.full, backgroundColor: colors.accentBg }} />
        ))}
      </View>
      <Animated.View
        style={[
          { position: "absolute", left: 0, width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.accent },
          travel,
        ]}
      />
    </View>
  );
}

function VideoCard() {
  return (
    <View
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: radius.lg,
        backgroundColor: colors.ink,
        padding: space.sm,
        justifyContent: "space-between",
        transform: [{ rotate: "-5deg" }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
        <Feather name="film" size={12} color={colors.onAccent} />
        <AppText style={{ fontSize: fontSize.caption2, color: colors.onAccent }}>릴스 · 쇼츠</AppText>
      </View>
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: "rgba(255,255,255,0.18)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Feather name="play" size={18} color={colors.onAccent} />
        </View>
      </View>
      <View style={{ gap: space.xxxs }}>
        <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.onAccent }} numberOfLines={2}>
          부산 맛집 5곳
        </AppText>
        <AppText style={{ fontSize: fontSize.caption2, color: "rgba(255,255,255,0.6)" }}>저장만 한 영상</AppText>
      </View>
    </View>
  );
}

function MapCard() {
  return (
    <View
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: radius.lg,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: "hidden",
        transform: [{ rotate: "4deg" }],
      }}
    >
      {/* 지도 느낌의 바탕: 옅은 바탕에 길 두 줄 */}
      <View style={{ height: 140, backgroundColor: colors.bgMuted }}>
        <View style={{ position: "absolute", top: 60, left: -10, right: -10, height: 6, backgroundColor: colors.bg, transform: [{ rotate: "-12deg" }] }} />
        <View style={{ position: "absolute", top: -10, bottom: -10, left: 70, width: 6, backgroundColor: colors.bg, transform: [{ rotate: "8deg" }] }} />
        {PINS.map((_, i) => (
          <Pin key={i} index={i} delay={900 + i * 220} />
        ))}
      </View>
      <View style={{ padding: space.xs, gap: space.xxxs }}>
        <AppText weight="medium" style={{ fontSize: fontSize.caption1 }}>
          내 지도에 3곳
        </AppText>
        <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted }}>1일차 일정까지 정리</AppText>
      </View>
    </View>
  );
}

export function FeedToMapIllustration() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <VideoCard />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(400).duration(400)}>
        <DottedPath />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(250).duration(500)}>
        <MapCard />
      </Animated.View>
    </View>
  );
}
