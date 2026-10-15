import { test } from "node:test";
import assert from "node:assert/strict";
import { kakaoMapUrl } from "../src/lib/placeLinkUrls.ts";

test("카카오 장소 페이지가 있으면 그 주소로 연다", () => {
  assert.equal(kakaoMapUrl({ placeName: "청연루", kakaoPlaceUrl: "http://place.map.kakao.com/1" }), "http://place.map.kakao.com/1");
});

test("좌표만 있으면 좌표 지도 링크로 연다", () => {
  assert.equal(
    kakaoMapUrl({ placeName: "청연루", latitude: 35.8, longitude: 127.1 }),
    "https://map.kakao.com/link/map/%EC%B2%AD%EC%97%B0%EB%A3%A8,35.8,127.1",
  );
});

test("위치를 못 찾은 장소는 지역과 이름으로 카카오맵 검색을 연다", () => {
  assert.equal(
    kakaoMapUrl({ placeName: "해란전망대", region: "동해시", latitude: null, longitude: null }),
    "https://map.kakao.com/link/search/" + encodeURIComponent("동해시 해란전망대"),
  );
});

test("지역이 없으면 이름만으로 검색한다", () => {
  assert.equal(
    kakaoMapUrl({ placeName: "Project D", region: null }),
    "https://map.kakao.com/link/search/" + encodeURIComponent("Project D"),
  );
});
