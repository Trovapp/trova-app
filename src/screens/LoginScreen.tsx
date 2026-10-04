import { useState } from "react";
import { Image, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { oauthUrl } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/lib/legal";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 디자인(2026-09): 로그인 전 첫 화면인데도 브랜드 요소가 하나도 없던 걸
// 고쳤다 — 앱 아이콘 마크(핀+재생버튼) + Trova 워드마크(이 화면의 유일한
// bold 지점) + 한 줄 가치 설명으로 첫인상을 만든다. 버튼은 각 로그인
// 제공자 브랜드 색(카카오 노랑)/아웃라인(구글)을 그대로 유지 — 이건
// OAuth 버튼의 정석 관례라 바꿀 이유가 없다.
export function LoginScreen() {
  const { handleAuthCallback, sessionExpired } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleLogin(provider: "kakao" | "google") {
    // openAuthSessionAsync는 세션이 하나만 열려있을 수 있어, 버튼을 연타하거나
    // 두 버튼을 빠르게 번갈아 누르면 WebBrowserAlreadyOpenException이 던져진다 —
    // isLoggingIn으로 진행 중에는 두 버튼 모두 눌리지 않게 막는다.
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      // iOS는 ASWebAuthenticationSession이 trova:// 리다이렉트를 가로채서
      // Linking의 "url" 이벤트가 발생하지 않으므로, 반환값을 직접 처리해야 한다.
      // Android는 Linking 리스너(AuthContext)가 별도로 처리하므로 여기서 결과가
      // 없어도 무방하다.
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl(provider), "trova://auth");
      if (result.type === "success") {
        await handleAuthCallback(result.url);
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: space.xl }}>
      <View style={{ alignItems: "center", marginBottom: space.xxxl }}>
        <Image
          source={require("../../assets/splash-icon.png")}
          resizeMode="contain"
          style={{ width: 96, height: 96, marginBottom: space.lg }}
        />
        <AppText weight="bold" style={{ fontSize: fontSize.largeTitle }}>
          Trova
        </AppText>
        <AppText style={{ marginTop: space.xs, fontSize: fontSize.subheadline, color: colors.inkMuted, textAlign: "center" }}>
          여행 영상 속 장소를 지도로 옮겨드려요
        </AppText>
      </View>

      {/* 세션 만료로 튕겨 나온 경우 이유 없이 로그인 화면만 보이면 앱이 초기화된 것처럼 느껴진다. */}
      {sessionExpired && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
            padding: space.sm,
            marginBottom: space.md,
            borderRadius: radius.md,
            backgroundColor: colors.bgMuted,
          }}
        >
          <Feather name="info" size={15} color={colors.inkMuted} />
          <AppText style={{ flexShrink: 1, fontSize: fontSize.footnote, color: colors.inkMuted }}>
            로그인이 만료됐어요. 다시 로그인해주세요.
          </AppText>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <PressableScale
          onPress={() => handleLogin("kakao")}
          disabled={isLoggingIn}
          style={{
            height: 48,
            borderRadius: radius.md,
            backgroundColor: colors.kakao,
            justifyContent: "center",
            alignItems: "center",
            opacity: isLoggingIn ? 0.6 : 1,
          }}
        >
          <AppText weight="medium">카카오로 시작하기</AppText>
        </PressableScale>
        <PressableScale
          onPress={() => handleLogin("google")}
          disabled={isLoggingIn}
          style={{
            height: 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: "center",
            alignItems: "center",
            opacity: isLoggingIn ? 0.6 : 1,
          }}
        >
          <AppText weight="medium">Google로 시작하기</AppText>
        </PressableScale>
        {/* 가입 전에 약관·방침을 볼 수 있게 한다(2026-10-04 공개). 링크는 앱 안 브라우저로 연다. */}
        <AppText style={{ marginTop: space.xs, textAlign: "center", fontSize: fontSize.caption1, color: colors.inkMuted }}>
          시작하면{" "}
          <AppText
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {})}
            style={{ fontSize: fontSize.caption1, color: colors.inkMuted, textDecorationLine: "underline" }}
          >
            이용약관
          </AppText>
          과{" "}
          <AppText
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() => {})}
            style={{ fontSize: fontSize.caption1, color: colors.inkMuted, textDecorationLine: "underline" }}
          >
            개인정보처리방침
          </AppText>
          에 동의하는 것으로 봐요.
        </AppText>
      </View>
    </View>
  );
}
