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
  // getMe()가 401이 아닌 이유(네트워크 끊김, 서버 오류)로 실패했을 때만 true —
  // 진짜 "로그인 안 됨"(401 → null)과 구분해서, 오프라인일 때 로그인 화면으로
  // 잘못 떨어지지 않고 재시도할 수 있게 한다.
  authError: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  handleAuthCallback: (url: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await getMe());
      setAuthError(false);
    } catch {
      // user는 건드리지 않는다 — 네트워크 오류로 세션이 있는 사용자를 로그아웃
      // 상태로 오해하게 만들지 않기 위함(RootNavigator가 authError를 보고
      // 재시도 화면을 보여준다).
      setAuthError(true);
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
    <AuthContext.Provider value={{ user, loading, authError, refresh, logout, handleAuthCallback }}>
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
