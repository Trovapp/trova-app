import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 온보딩 따라하기 데모(2026-10). 참고: Plotline 온보딩의 "Share it. We'll grab the places." —
// 플랫폼 탭을 고르면 휴대폰 화면 안에서 단계가 저절로 넘어가며 사용법을 보여준다.
// Trova에는 공유 시트로 링크를 받는 기능이 없어서 "공유 → 링크 복사 → Trova에 붙여넣기"를 보여준다.
export type DemoPlatform = "instagram" | "youtube";

export const DEMO_STEPS = ["공유 누르기", "링크 복사", "Trova에 붙여넣기"] as const;
export const DEMO_STEP_MS = 2600;

const PLATFORM = {
  instagram: { label: "인스타그램", icon: "instagram" as const, shareIcon: "send" as const, url: "instagram.com/reel/C8x…" },
  youtube: { label: "유튜브", icon: "youtube" as const, shareIcon: "share" as const, url: "youtube.com/shorts/8vmp…" },
};

// 눌러야 할 곳을 알려주는 깜빡이는 고리. 둥근 아이콘은 size만, 넓은 버튼은 width/height/round로 모양을 맞춘다.
function TapRing({ size, width, height, round = radius.full }: { size?: number; width?: number | `${number}%`; height?: number; round?: number }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1);
  }, [pulse, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.9 : 1 - pulse.value,
    transform: [{ scale: reducedMotion ? 1 : 1 + pulse.value * (width ? 0.12 : 0.5) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: width ?? size, height: height ?? size, borderRadius: round, borderWidth: 2, borderColor: colors.accent },
        style,
      ]}
    />
  );
}

function ShareStep({ platform }: { platform: DemoPlatform }) {
  const p = PLATFORM[platform];
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, padding: space.sm, justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
        <Feather name={p.icon} size={12} color={colors.onAccent} />
        <AppText style={{ fontSize: fontSize.caption2, color: colors.onAccent }}>{platform === "instagram" ? "릴스" : "쇼츠"}</AppText>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ gap: space.xxxs, flex: 1 }}>
          <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.onAccent }}>
            부산 맛집 5곳
          </AppText>
          <AppText style={{ fontSize: fontSize.caption2, color: "rgba(255,255,255,0.6)" }}>여행 브이로그</AppText>
        </View>
        <View style={{ alignItems: "center", gap: space.md }}>
          <Feather name="heart" size={18} color={colors.onAccent} />
          <Feather name="message-circle" size={18} color={colors.onAccent} />
          <View style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center" }}>
            <TapRing size={36} />
            <Feather name={p.shareIcon} size={18} color={colors.onAccent} />
          </View>
        </View>
      </View>
    </View>
  );
}

function CopyLinkStep() {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(22,33,29,0.55)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.sm, gap: space.sm }}>
        <View style={{ alignSelf: "center", width: 28, height: 4, borderRadius: radius.full, backgroundColor: colors.border }} />
        <AppText weight="medium" style={{ fontSize: fontSize.caption1, textAlign: "center" }}>
          공유
        </AppText>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          {[
            { icon: "link" as const, label: "링크 복사", target: true },
            { icon: "message-square" as const, label: "메시지", target: false },
            { icon: "more-horizontal" as const, label: "더보기", target: false },
          ].map((item) => (
            <View key={item.label} style={{ alignItems: "center", gap: space.xxs }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: item.target ? colors.accentBg : colors.bgMuted,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {item.target && <TapRing size={36} />}
                <Feather name={item.icon} size={16} color={item.target ? colors.accent : colors.inkMuted} />
              </View>
              <AppText style={{ fontSize: fontSize.caption2, color: item.target ? colors.accent : colors.inkMuted }}>{item.label}</AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function PasteStep({ platform }: { platform: DemoPlatform }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.sm, gap: space.xs, justifyContent: "center" }}>
      <AppText weight="bold" style={{ fontSize: fontSize.footnote }}>
        어디로 떠나볼까요?
      </AppText>
      <View
        style={{
          height: 32,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.accent,
          paddingHorizontal: space.xs,
          justifyContent: "center",
        }}
      >
        <AppText style={{ fontSize: fontSize.caption2 }} numberOfLines={1}>
          {PLATFORM[platform].url}
        </AppText>
      </View>
      <View style={{ height: 32, borderRadius: radius.sm, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }}>
        <TapRing width="100%" height={32} round={radius.sm} />
        <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.onAccent }}>
          장소 추출하기
        </AppText>
      </View>
    </View>
  );
}

// 위쪽 단계 막대: 지금 단계 칸이 DEMO_STEP_MS 동안 채워진다(인스타 스토리 진행 막대처럼).
function StepBar({ index, active }: { index: number; active: number }) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(0);
  useEffect(() => {
    if (index < active) fill.value = 1;
    else if (index > active) fill.value = 0;
    else {
      fill.value = 0;
      fill.value = reducedMotion ? 1 : withTiming(1, { duration: DEMO_STEP_MS, easing: Easing.linear });
    }
  }, [active, fill, index, reducedMotion]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: colors.borderSubtle, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", backgroundColor: colors.accent }, style]} />
    </View>
  );
}

export function DemoProgress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: "row", gap: space.xxs, flex: 1 }}>
      {DEMO_STEPS.map((_, i) => (
        <StepBar key={i} index={i} active={step} />
      ))}
    </View>
  );
}

export function LinkPasteDemo({
  platform,
  step,
  onSelectStep,
}: {
  platform: DemoPlatform;
  step: number;
  onSelectStep: (step: number) => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: space.lg }}>
      {/* 휴대폰 화면 미리보기 */}
      <View
        style={{
          width: 212,
          height: 340,
          borderRadius: 28 /* 토큰 예외: 휴대폰 모서리를 흉내 낸 그림 */,
          borderWidth: 6,
          borderColor: colors.ink,
          overflow: "hidden",
          backgroundColor: colors.ink,
        }}
      >
        <Animated.View key={`${platform}-${step}`} entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
          {step === 0 && <ShareStep platform={platform} />}
          {step === 1 && <CopyLinkStep />}
          {step === 2 && <PasteStep platform={platform} />}
        </Animated.View>
      </View>

      {/* 단계 이름: 누르면 그 단계로 간다 */}
      <View style={{ flexDirection: "row", gap: space.xs }}>
        {DEMO_STEPS.map((label, i) => (
          <Pressable
            key={label}
            onPress={() => onSelectStep(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === step }}
            style={{
              paddingVertical: space.xxs,
              paddingHorizontal: space.sm,
              borderRadius: radius.full,
              backgroundColor: i === step ? colors.accentBg : colors.bgMuted,
            }}
          >
            <AppText weight={i === step ? "medium" : "regular"} style={{ fontSize: fontSize.caption1, color: i === step ? colors.accent : colors.inkMuted }}>
              {i + 1}. {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function PlatformTabs({ value, onChange }: { value: DemoPlatform; onChange: (p: DemoPlatform) => void }) {
  return (
    <View style={{ flexDirection: "row", padding: space.xxs, borderRadius: radius.full, backgroundColor: colors.bgMuted }}>
      {(Object.keys(PLATFORM) as DemoPlatform[]).map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              flexDirection: "row",
              gap: space.xxs,
              paddingVertical: space.xs,
              borderRadius: radius.full,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: selected ? colors.bg : "transparent",
            }}
          >
            <Feather name={PLATFORM[key].icon} size={14} color={selected ? colors.ink : colors.inkMuted} />
            <AppText weight={selected ? "medium" : "regular"} style={{ fontSize: fontSize.footnote, color: selected ? colors.ink : colors.inkMuted }}>
              {PLATFORM[key].label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
