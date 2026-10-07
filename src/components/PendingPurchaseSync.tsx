import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { recordAppleTransaction } from "@/lib/api/billing";
import { useAuth } from "@/lib/auth/AuthContext";
import { iap, TRAVEL_PASS_PRODUCT_ID } from "@/lib/iap";

// 결제는 됐는데 서버 기록이 실패한 여행 패스를 이어서 붙인다(2026-10-07 QA).
// 결제 페이지는 서버 기록이 성공해야 거래를 마무리(finish)하므로, 실패한 거래는 StoreKit에 "마무리 안 됨"으로 남는다.
// 예전에는 결제 페이지를 다시 열어야만 그 거래가 넘어와서, "앱을 다시 열면 다시 시도해요" 안내와 달랐다 —
// 로그인한 채 앱이 열리거나 앞으로 돌아올 때마다 마무리 안 된 패스 거래를 찾아 기록하고, 성공한 것만 마무리한다.
export function PendingPurchaseSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!iap || !user) return;
    let running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        await iap!.initConnection();
        const pending = await iap!.getPendingTransactionsIOS();
        let recorded = 0;
        for (const p of pending) {
          if (p.productId !== TRAVEL_PASS_PRODUCT_ID || !p.purchaseToken) continue;
          try {
            await recordAppleTransaction(p.purchaseToken);
            await iap!.finishTransaction({ purchase: p, isConsumable: false });
            recorded++;
          } catch {
            // 아직 서버에 못 붙였다 — 마무리하지 않고 다음에 다시 시도한다.
          }
        }
        if (recorded > 0) await queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
      } catch {
        // 결제 연결이 안 되는 환경(시뮬레이터 설정 등)에서는 조용히 넘어간다.
      } finally {
        running = false;
      }
    };
    sync();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") sync();
    });
    return () => sub.remove();
  }, [user, queryClient]);

  return null;
}
