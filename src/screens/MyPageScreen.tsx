import { useState } from "react";
import { Alert, Image, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableRow } from "@/components/PressableRow";
import { haptics } from "@/lib/haptics";
import { withdraw } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors } from "@/lib/theme";

// 마이페이지(2026-09 신규): 로그아웃이 홈 화면 맨 아래 묻혀 있던 걸 계정 관리
// 전용 화면으로 분리했다. 회원 탈퇴(DELETE /api/users/me)는 백엔드에 이미
// 구현돼 있었는데 앱에서 아직 안 쓰고 있던 걸 여기서 연결한다.
export function MyPageScreen() {
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
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
      <View style={{ alignItems: "center", marginTop: 12, marginBottom: 36 }}>
        {user?.profileImageUrl && !avatarFailed ? (
          <Image
            source={{ uri: user.profileImageUrl }}
            onError={() => setAvatarFailed(true)}
            style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 14 }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.accentBg,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Feather name="user" size={28} color={colors.accent} />
          </View>
        )}
        <AppText weight="bold" style={{ fontSize: 20 }}>
          {user?.nickname ?? "여행자"}
        </AppText>
      </View>

      <View>
        <PressableRow
          onPress={confirmLogout}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <AppText>로그아웃</AppText>
          <Feather name="chevron-right" size={18} color={colors.inkMuted} />
        </PressableRow>
        <PressableRow
          onPress={confirmWithdraw}
          disabled={withdrawing}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            opacity: withdrawing ? 0.6 : 1,
          }}
        >
          <AppText style={{ color: colors.inkMuted }}>회원 탈퇴</AppText>
          <Feather name="chevron-right" size={18} color={colors.inkMuted} />
        </PressableRow>
      </View>
    </View>
  );
}
