import { Linking } from "react-native";

type LinkablePlace = {
  placeName: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  kakaoPlaceUrl?: string | null;
};

// 카카오 장소 페이지가 있으면 그걸, 없으면 좌표로 카카오맵 공식 링크(/link/map/이름,위도,경도)를 만든다.
// 둘 다 https라 카카오맵 앱이 있으면 앱으로, 없으면 웹으로 열린다.
export function kakaoMapUrl(place: LinkablePlace): string | null {
  if (place.kakaoPlaceUrl) return place.kakaoPlaceUrl;
  if (place.latitude == null || place.longitude == null) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(place.placeName)},${place.latitude},${place.longitude}`;
}

export function phoneUrl(place: LinkablePlace): string | null {
  const digits = place.phone?.replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function openExternal(url: string) {
  Linking.openURL(url).catch(() => {});
}
