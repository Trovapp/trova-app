import { useCallback, useState } from "react";

// 당겨서 새로고침 — 스피너는 "사용자가 당겼을 때"만 돈다. query.isRefetching을 그대로
// 쓰면 폴링/포커스 복귀 같은 백그라운드 재조회 때마다 목록 위에 스피너가 튀어나온다.
export function usePullToRefresh(refetchAll: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

  return { refreshing, onRefresh };
}
