import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { FeedToMapIllustration } from "@/components/onboarding/FeedToMapIllustration";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 로그인 전 온보딩(2026-10). 참고: ScreensDesign의 Plotline 온보딩 — 가입보다 먼저 "전과 후" 그림 한 장으로
// 앱이 하는 일을 보여주고, 이미 계정이 있는 사람은 바로 로그인으로 건너뛸 수 있게 한다.
// onDone은 온보딩을 다 본 경우와 "이미 계정이 있어요"로 건너뛴 경우 모두 부른다(둘 다 다시 보여주지 않는다).
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + space.md,
        paddingBottom: insets.bottom + space.md,
        paddingHorizontal: space.xl,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs }}>
        <Image source={require("../../assets/splash-icon.png")} resizeMode="contain" style={{ width: 28, height: 28 }} />
        <AppText weight="medium" style={{ fontSize: fontSize.title3 }}>
          Trova
        </AppText>
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <FeedToMapIllustration />
      </View>

      <Animated.View entering={FadeInDown.delay(500).duration(500)} style={{ gap: space.sm, marginBottom: space.xxl }}>
        <AppText weight="bold" style={{ fontSize: fontSize.title1, lineHeight: 36 }}>
          {"보기만 했던 여행 영상을\n내 지도로"}
        </AppText>
        <AppText style={{ fontSize: fontSize.subheadline, lineHeight: 22, color: colors.inkMuted }}>
          {"영상 링크만 넣으면 AI가 나온 장소를 찾아\n지도와 일정으로 정리해드려요"}
        </AppText>
      </Animated.View>

      <View style={{ gap: space.sm }}>
        <PressableScale
          onPress={onDone}
          accessibilityRole="button"
          style={{ height: 52, borderRadius: radius.md, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }}
        >
          <AppText weight="medium" style={{ fontSize: fontSize.callout, color: colors.onAccent }}>
            시작하기
          </AppText>
        </PressableScale>
        <PressableScale onPress={onDone} accessibilityRole="button" style={{ paddingVertical: space.xs, alignItems: "center" }}>
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
            이미 계정이 있어요 <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.ink }}>로그인</AppText>
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}
