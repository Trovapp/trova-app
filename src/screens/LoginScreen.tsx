import { Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AppText } from "@/components/AppText";
import { oauthUrl } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthContext";

export function LoginScreen() {
  const { handleAuthCallback } = useAuth();

  async function handleLogin(provider: "kakao" | "google") {
    // iOS는 ASWebAuthenticationSession이 trova:// 리다이렉트를 가로채서
    // Linking의 "url" 이벤트가 발생하지 않으므로, 반환값을 직접 처리해야 한다.
    // Android는 Linking 리스너(AuthContext)가 별도로 처리하므로 여기서 결과가
    // 없어도 무방하다.
    const result = await WebBrowser.openAuthSessionAsync(oauthUrl(provider), "trova://auth");
    if (result.type === "success") {
      await handleAuthCallback(result.url);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <AppText weight="medium" style={{ fontSize: 24, marginBottom: 24, textAlign: "center" }}>
        Trova에 로그인
      </AppText>
      <Pressable
        onPress={() => handleLogin("kakao")}
        style={{ height: 48, borderRadius: 12, backgroundColor: "#FEE500", justifyContent: "center", alignItems: "center" }}
      >
        <AppText weight="medium">카카오로 시작하기</AppText>
      </Pressable>
      <Pressable
        onPress={() => handleLogin("google")}
        style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#DEDED8", justifyContent: "center", alignItems: "center" }}
      >
        <AppText weight="medium">Google로 계속하기</AppText>
      </Pressable>
    </View>
  );
}
