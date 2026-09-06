import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import { useQueryClient } from "@tanstack/react-query";
import { getMe, type CurrentUser } from "@/lib/api/auth";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { clearToken, setToken } from "@/lib/tokenStorage";

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  handleAuthCallback: (url: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await getMe());
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // 카카오/구글 OAuth 콜백(trova://auth?token=...) 처리. 두 경로에서 호출된다:
  // 1) Android 및 콜드스타트/백그라운드 복귀 시 — Linking의 "url" 이벤트 리스너
  // 2) iOS의 openAuthSessionAsync 성공 콜백 — ASWebAuthenticationSession이
  //    리다이렉트를 가로채서 Linking "url" 이벤트를 발생시키지 않기 때문에
  //    LoginScreen에서 반환값을 받아 직접 호출해야 함
  // 두 경로 모두 동일한 멱등 함수를 호출하므로 중복 호출되어도 안전하다.
  const handleAuthCallback = useCallback(
    async (url: string) => {
      const { queryParams } = Linking.parse(url);
      const token = queryParams?.token;
      if (typeof token === "string") {
        await setToken(token);
        await refresh();
        return;
      }
      const error = queryParams?.error;
      if (typeof error === "string") {
        Alert.alert("로그인 실패", "로그인에 실패했어요. 다시 시도해주세요.");
      }
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      queryClient.clear();
    });
  }, [queryClient]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleAuthCallback(url);
    });
    return () => subscription.remove();
  }, [handleAuthCallback]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, handleAuthCallback }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
