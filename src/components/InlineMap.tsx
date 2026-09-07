import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { AppText } from "@/components/AppText";
import { buildKakaoMapHtml } from "@/lib/kakaoMapHtml";
import { colors } from "@/lib/theme";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "";

type Pin = { id: string; latitude: number; longitude: number };

export function InlineMap({
  pins,
  height = 200,
  selectedId = null,
}: {
  pins: Pin[];
  height?: number;
  // 있으면 해당 핀으로 지도를 이동시키고 하이라이트 링을 보여준다(웹 KakaoMap.tsx와 동일).
  selectedId?: string | null;
}) {
  const webviewRef = useRef<WebView>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // 호출부는 매 렌더마다 pins 배열을 새로 만든다(메모이제이션 없음). 배열 참조를
  // 의존성으로 쓰면 부모가 리렌더될 때마다(예: 검색어 한 글자 입력) WebView에
  // postMessage가 다시 나가 카카오 지도가 통째로 다시 만들어진다.
  // 그래서 참조가 아니라 "핀 내용"을 직렬화한 문자열을 의존성으로 쓴다 —
  // 내용이 실제로 바뀔 때만 새 메시지가 나간다.
  const pinsKey = JSON.stringify(
    pins.map((pin) => ({ id: pin.id, latitude: pin.latitude, longitude: pin.longitude }))
  );
  const payload = JSON.stringify({ pins: JSON.parse(pinsKey), selectedId });

  useEffect(() => {
    if (!isMapLoaded || mapError || pinsKey === "[]") return;
    webviewRef.current?.postMessage(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapLoaded, mapError, pinsKey, selectedId]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "sdk-load-error" || data?.type === "render-error") {
        setMapError("지도를 불러오지 못했어요.");
      }
    } catch {
      // 무시 — 지도 쪽에서 보낸 다른 형식의 메시지일 수 있음
    }
  }

  if (pins.length === 0) return null;

  if (!KAKAO_MAP_JS_KEY) {
    return (
      <View style={{ height, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgMuted }}>
        <AppText style={{ color: colors.inkMuted }}>지도 키가 설정되지 않았어요.</AppText>
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={{ height, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgMuted }}>
        <AppText style={{ color: colors.inkMuted }}>{mapError}</AppText>
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: buildKakaoMapHtml(KAKAO_MAP_JS_KEY), baseUrl: "https://localhost" }}
      style={{ height, borderRadius: 12, overflow: "hidden" }}
      onLoadEnd={() => setIsMapLoaded(true)}
      onMessage={handleMessage}
      onError={() => {
        setIsMapLoaded(false);
        setMapError("지도를 불러오지 못했어요.");
      }}
      onHttpError={() => {
        setIsMapLoaded(false);
        setMapError("지도를 불러오지 못했어요.");
      }}
    />
  );
}
