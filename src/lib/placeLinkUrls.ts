// react-native 없이 테스트할 수 있게 링크 주소 만들기만 따로 둔다(여는 건 placeLinks.ts).
export type LinkablePlace = {
  placeName: string;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  kakaoPlaceUrl?: string | null;
};

// 카카오 장소 페이지가 있으면 그걸, 없으면 좌표로 카카오맵 공식 링크(/link/map/이름,위도,경도)를 만든다.
// 둘 다 https라 카카오맵 앱이 있으면 앱으로, 없으면 웹으로 열린다.
// 위치를 못 찾은 장소는 버튼이 숨겨져 누를 게 없었다 — "지역 이름"으로 카카오맵 검색을 연다(#31).
export function kakaoMapUrl(place: LinkablePlace): string {
  if (place.kakaoPlaceUrl) return place.kakaoPlaceUrl;
  if (place.latitude == null || place.longitude == null) {
    const query = [place.region, place.placeName].filter(Boolean).join(" ");
    return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
  }
  return `https://map.kakao.com/link/map/${encodeURIComponent(place.placeName)},${place.latitude},${place.longitude}`;
}

export function phoneUrl(place: LinkablePlace): string | null {
  const digits = place.phone?.replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : null;
}
