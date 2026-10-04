import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Alert, Image, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { AppText } from "@/components/AppText";
import { PressableRow } from "@/components/PressableRow";
import { haptics } from "@/lib/haptics";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/lib/legal";
import { withdraw } from "@/lib/api/auth";
import { getBillingStatus } from "@/lib/api/billing";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors, fontSize, radius, space } from "@/lib/theme";
import type { RootStackParamList } from "@/navigation/types";
import appConfig from "../../app.json";

// 마이페이지(2026-09 신규): 로그아웃이 홈 화면 맨 아래 묻혀 있던 걸 계정 관리
// 전용 화면으로 분리했다. 회원 탈퇴(DELETE /api/users/me)는 백엔드에 이미
// 구현돼 있었는데 앱에서 아직 안 쓰고 있던 걸 여기서 연결한다.
export function MyPageScreen() {
  // 여행 패스 상태(2026-10-05). 불러오지 못해도 행은 그대로 두고 상태 글자만 비운다.
  const billingQuery = useQuery({ queryKey: ["billingStatus"], queryFn: getBillingStatus });
  const passLabel = !billingQuery.data
    ? null
    : billingQuery.data.plan === "PASS" && billingQuery.data.passExpiresAt
      ? `${new Date(billingQuery.data.passExpiresAt).getMonth() + 1}월 ${new Date(billingQuery.data.passExpiresAt).getDate()}일까지`
      : "무료 이용 중";
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const [withdrawing, setWithdrawing] = useState(false);
  // 카카오/구글 프로필 이미지 URL이 있어도 로드에 실패할 수 있다(만료된 URL,
  // 네트워크 차단 등) — 실패하면 빈 자리로 남기지 않고 기본 아이콘으로 대체한다.
  const [avatarFailed, setAvatarFailed] = useState(false);

  function confirmLogout() {
    Alert.alert("로그아웃", "로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => logout() },
    ]);
  }

  function confirmWithdraw() {
    Alert.alert(
      "회원 탈퇴",
      "탈퇴하면 저장한 장소와 여행 기록이 모두 사라지고 되돌릴 수 없어요. 정말 탈퇴할까요?",
      [
        { text: "취소", style: "cancel" },
        { text: "탈퇴하기", style: "destructive", onPress: handleWithdraw },
      ],
    );
  }

  async function handleWithdraw() {
    if (withdrawing) return;
    haptics.warning();
    setWithdrawing(true);
    try {
      await withdraw();
      await logout();
    } catch {
      Alert.alert("탈퇴 실패", "잠시 후 다시 시도해주세요.");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: space.xl }}>
      <View style={{ alignItems: "center", marginTop: space.sm, marginBottom: space.xxxl }}>
        {user?.profileImageUrl && !avatarFailed ? (
          <Image
            source={{ uri: user.profileImageUrl }}
            onError={() => setAvatarFailed(true)}
            style={{ width: 72, height: 72, borderRadius: radius.full, marginBottom: space.md }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.full,
              backgroundColor: colors.accentBg,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: space.md,
            }}
          >
            <Feather name="user" size={28} color={colors.accent} />
          </View>
        )}
        <AppText weight="bold" style={{ fontSize: fontSize.title3 }}>
          {user?.nickname ?? "여행자"}
        </AppText>
      </View>

      <View>
        <PressableRow
          onPress={() => navigation.navigate("Pass")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <AppText>여행 패스</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            {passLabel && <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{passLabel}</AppText>}
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </View>
        </PressableRow>
        {/* 앱스토어 심사·개인정보 보호법상 앱 안에서 방침을 볼 수 있어야 한다. 앱 안 브라우저로 연다. */}
        {[
          { label: "개인정보처리방침", url: PRIVACY_POLICY_URL },
          { label: "이용약관", url: TERMS_URL },
        ].map((link) => (
          <PressableRow
            key={link.label}
            onPress={() => WebBrowser.openBrowserAsync(link.url).catch(() => {})}
            accessibilityRole="link"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: space.md,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
            }}
          >
            <AppText>{link.label}</AppText>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </PressableRow>
        ))}
        <PressableRow
          onPress={() => navigation.navigate("Licenses")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <AppText>오픈소스 라이선스</AppText>
          <Feather name="chevron-right" size={18} color={colors.inkMuted} />
        </PressableRow>
        <PressableRow
          onPress={confirmLogout}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          {/* 화살표(>)는 다른 화면으로 간다는 뜻인데 이 행은 확인창을 띄운다(2026-10 QA) — 동작 행에는 두지 않는다 */}
          <AppText>로그아웃</AppText>
        </PressableRow>
        <PressableRow
          onPress={confirmWithdraw}
          disabled={withdrawing}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            opacity: withdrawing ? 0.6 : 1,
          }}
        >
          <AppText style={{ color: colors.inkMuted }}>회원 탈퇴</AppText>
        </PressableRow>
      </View>

      <AppText style={{ marginTop: "auto", textAlign: "center", fontSize: fontSize.caption1, color: colors.inkMuted }}>
        버전 {appConfig.expo.version}
      </AppText>
    </View>
  );
}
