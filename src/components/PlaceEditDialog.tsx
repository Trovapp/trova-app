import type { ComponentProps, ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { colors, fontSize, radius, space } from "@/lib/theme";
import { hitSlopFor } from "@/lib/touch";

// 여행 상세의 도착 시간·머무는 시간·이동수단 바꾸기 팝업. 예전엔 ⋮에서 고르면 장소 줄 아래에 선택지가 펼쳐져
// "어디서 바꾸라는 거지?" 하며 찾았다(2026-10-13 사용자) — 화면 가운데에 띄워 바로 고르게 한다. 바깥을 누르면 닫힌다.
export function PlaceEditDialog({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="닫기"
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: space.lg }}
      >
        {/* 안쪽을 눌러도 닫히지 않게 바깥 Pressable로 이벤트가 올라가지 않도록 막는다. */}
        <Pressable
          onPress={() => {}}
          accessibilityViewIsModal
          style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg, gap: space.md }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
            <View style={{ flex: 1, gap: space.xxxs }}>
              <AppText weight="bold" style={{ fontSize: fontSize.body }}>
                {title}
              </AppText>
              {subtitle && <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{subtitle}</AppText>}
            </View>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={hitSlopFor(20)}>
              <Feather name="x" size={20} color={colors.inkMuted} />
            </PressableScale>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// 팝업 안 선택지 버튼 — 고르면 바로 저장된다. 지금 값은 강조색으로.
export function DialogOption({
  label,
  icon,
  selected,
  disabled,
  grid = false,
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Feather>["name"];
  selected: boolean;
  disabled?: boolean;
  // 한 줄에 세 개씩 놓을 때(머무는 시간·이동수단). 세로 목록(장소 고르기)에서는 끈다.
  grid?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={{
        ...(grid ? { flexGrow: 1, flexBasis: "30%" } : {}),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        minHeight: 48,
        paddingHorizontal: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentBg : colors.bg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon && <Feather name={icon} size={16} color={selected ? colors.accent : colors.ink} />}
      <AppText weight={selected ? "medium" : "regular"} style={{ color: selected ? colors.accent : colors.ink }}>
        {label}
      </AppText>
    </PressableScale>
  );
}
