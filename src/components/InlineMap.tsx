import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { AppText } from "@/components/AppText";
import { buildKakaoMapHtml } from "@/lib/kakaoMapHtml";
import { colors } from "@/lib/theme";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "";

type Pin = { id: string; latitude: number; longitude: number };

export function InlineMap({ pins, height = 200 }: { pins: Pin[]; height?: number }) {
  const webviewRef = useRef<WebView>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMapLoaded || mapError || pins.length === 0) return;
    webviewRef.current?.postMessage(JSON.stringify(pins));
  }, [isMapLoaded, mapError, pins]);

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
