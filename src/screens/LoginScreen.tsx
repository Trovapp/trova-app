import { useState } from "react";
import { Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AppText } from "@/components/AppText";
import { oauthUrl } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors } from "@/lib/theme";

export function LoginScreen() {
  const { handleAuthCallback } = useAuth();
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
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <AppText weight="medium" style={{ fontSize: 24, marginBottom: 24, textAlign: "center" }}>
        Trova에 로그인
      </AppText>
      <Pressable
        onPress={() => handleLogin("kakao")}
        disabled={isLoggingIn}
        style={{
          height: 48,
          borderRadius: 12,
          backgroundColor: colors.kakao,
          justifyContent: "center",
          alignItems: "center",
          opacity: isLoggingIn ? 0.6 : 1,
        }}
      >
        <AppText weight="medium">카카오로 시작하기</AppText>
      </Pressable>
      <Pressable
        onPress={() => handleLogin("google")}
        disabled={isLoggingIn}
        style={{
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: "center",
          alignItems: "center",
          opacity: isLoggingIn ? 0.6 : 1,
        }}
      >
        <AppText weight="medium">Google로 계속하기</AppText>
      </Pressable>
    </View>
  );
}
