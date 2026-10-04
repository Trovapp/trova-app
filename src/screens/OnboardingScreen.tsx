import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { FeedToMapIllustration } from "@/components/onboarding/FeedToMapIllustration";
import {
  DEMO_STEP_MS,
  DEMO_STEPS,
  DemoProgress,
  LinkPasteDemo,
  PlatformTabs,
  type DemoPlatform,
} from "@/components/onboarding/LinkPasteDemo";
import { FitToSpace } from "@/components/onboarding/FitToSpace";
import { colors, fontSize, radius, space, motion } from "@/lib/theme";

// 로그인 전 온보딩(2026-10). 참고: ScreensDesign의 Plotline 온보딩 — 가입보다 먼저 "전과 후" 그림 한 장으로
// 앱이 하는 일을 보여주고(소개), 이어서 사용법을 움직이는 데모로 보여준다(따라하기). 이미 계정이 있는 사람은
// 첫 장에서 바로 로그인으로 건너뛸 수 있다.
// onDone은 끝까지 본 경우와 건너뛴 경우 모두 부른다(둘 다 다시 보여주지 않는다).
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<"intro" | "demo">("intro");

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
      {page === "intro" ? (
        <IntroPage onNext={() => setPage("demo")} onSkip={onDone} />
      ) : (
        <DemoPage onBack={() => setPage("intro")} onDone={onDone} />
      )}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      style={{ height: 52, borderRadius: radius.md, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }}
    >
      <AppText weight="medium" style={{ fontSize: fontSize.callout, color: colors.onAccent }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function IntroPage({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs }}>
        <Image source={require("../../assets/splash-icon.png")} resizeMode="contain" style={{ width: 28, height: 28 }} />
        <AppText weight="medium" style={{ fontSize: fontSize.title3 }}>
          Trova
        </AppText>
      </View>

      <FitToSpace>
        <FeedToMapIllustration />
      </FitToSpace>

      <Animated.View entering={FadeInDown.delay(motion.enter).duration(motion.enter)} style={{ gap: space.sm, marginBottom: space.xxl }}>
        <AppText weight="bold" style={{ fontSize: fontSize.title1, lineHeight: 36 }}>
          {"보기만 했던 여행 영상을\n내 지도로"}
        </AppText>
        <AppText style={{ fontSize: fontSize.subheadline, lineHeight: 22, color: colors.inkMuted }}>
          {"영상 링크만 넣으면 AI가 나온 장소를 찾아\n지도와 일정으로 정리해드려요"}
        </AppText>
      </Animated.View>

      <View style={{ gap: space.sm }}>
        <PrimaryButton label="시작하기" onPress={onNext} />
        <PressableScale onPress={onSkip} accessibilityRole="button" style={{ paddingVertical: space.xs, alignItems: "center" }}>
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
            이미 계정이 있어요 <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.ink }}>로그인</AppText>
          </AppText>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function DemoPage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [platform, setPlatform] = useState<DemoPlatform>("instagram");
  const [step, setStep] = useState(0);

  // 단계가 저절로 넘어가고 끝나면 처음부터 다시 보여준다. 단계나 플랫폼을 직접 고르면 그 자리에서 다시 센다.
  useEffect(() => {
    const timer = setTimeout(() => setStep((s) => (s + 1) % DEMO_STEPS.length), DEMO_STEP_MS);
    return () => clearTimeout(timer);
  }, [step, platform]);

  function choosePlatform(next: DemoPlatform) {
    setPlatform(next);
    setStep(0);
  }

  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={12}>
          <Feather name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
        <DemoProgress step={step} />
      </View>

      <View style={{ gap: space.xs, marginTop: space.xl }}>
        <AppText weight="bold" style={{ fontSize: fontSize.title2, lineHeight: 30 }}>
          {"링크만 넣으면\n장소를 찾아드려요"}
        </AppText>
        <AppText style={{ fontSize: fontSize.subheadline, color: colors.inkMuted }}>
          영상에서 링크를 복사해 Trova에 붙여넣으면 끝이에요
        </AppText>
      </View>

      <View style={{ marginTop: space.lg }}>
        <PlatformTabs value={platform} onChange={choosePlatform} />
      </View>

      <FitToSpace>
        <LinkPasteDemo platform={platform} step={step} onSelectStep={setStep} />
      </FitToSpace>

      <PrimaryButton label="로그인하고 시작하기" onPress={onDone} />
    </Animated.View>
  );
}
