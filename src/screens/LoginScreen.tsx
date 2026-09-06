import { Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AppText } from "@/components/AppText";
import { oauthUrl } from "@/lib/api/auth";

export function LoginScreen() {
  async function handleLogin(provider: "kakao" | "google") {
    await WebBrowser.openAuthSessionAsync(oauthUrl(provider), "trova://auth");
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
