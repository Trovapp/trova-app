import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import { useQueryClient } from "@tanstack/react-query";
import { exchangeWebLoginCode, getMe, type CurrentUser } from "@/lib/api/auth";
import { takeWebLoginCallback } from "@/lib/auth/webLoginCallback";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { clearToken, setToken } from "@/lib/tokenStorage";
import { disablePush } from "@/lib/push";

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  // getMe()가 401이 아닌 이유(네트워크 끊김, 서버 오류)로 실패했을 때만 true —
  // 진짜 "로그인 안 됨"(401 → null)과 구분해서, 오프라인일 때 로그인 화면으로
  // 잘못 떨어지지 않고 재시도할 수 있게 한다.
  authError: boolean;
  // 로그인해 둔 세션이 만료(401)돼서 로그인 화면으로 돌아온 경우에만 true — 로그인 화면에서 이유를 알려준다.
  // 첫 실행(토큰 없음)이나 직접 로그아웃은 해당하지 않는다.
  sessionExpired: boolean;
  // 웹(PWA) 로그인이 실패해 돌아온 경우 — 로그인 화면에서 이유를 알려준다(앱은 Alert로 알린다).
  webLoginFailed: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  handleAuthCallback: (url: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [webLoginFailed, setWebLoginFailed] = useState(false);
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
    // 이 기기 웹 푸시 구독을 서버에서 먼저 지운다(토큰이 필요) — 다른 사람이 이 기기로 로그인해도 앞사람 알림이 오지 않게(#185).
    await disablePush().catch(() => {});
    await clearToken();
    setSessionExpired(false);
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
        setSessionExpired(false);
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
    // 웹(PWA): 로그인하고 돌아온 1회용 코드가 있으면 먼저 토큰으로 바꾼다. 앱에서는 항상 null.
    const callback = takeWebLoginCallback();
    if (callback && "code" in callback) {
      exchangeWebLoginCode(callback.code)
        .then((token) => setToken(token))
        .catch(() => setWebLoginFailed(true))
        .finally(() => refresh());
      return;
    }
    if (callback) setWebLoginFailed(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(({ hadToken }) => {
      if (hadToken) setSessionExpired(true);
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
    <AuthContext.Provider value={{ user, loading, authError, sessionExpired, webLoginFailed, refresh, logout, handleAuthCallback }}>
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
