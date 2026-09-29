// 영상 분석 화면에 제목을 보여줄 때만 다듬는다 — 원본 제목은 서버에 그대로 저장된다.
// 쇼츠·릴스 제목엔 해시태그, 줄바꿈, 말머리([VLOG]), 채널명(| 뒤) 같은 게 섞여 있어 그대로 보여주면 어수선하다.
// 이모지는 제목의 분위기라서 남긴다.

// 인스타그램이 캡션이 없을 때 붙이는 자동 제목 — 사용자에게 의미가 없다.
const PLACEHOLDER_TITLE = /^(video|reel|post|photo) by\s|^instagram$/i;
const LEADING_TAG = /^\s*(\[[^\]]*\]|【[^】]*】|\([^)]*\))\s*/;
const TRAILING_TAG = /\s*(\[[^\]]*\]|【[^】]*】)\s*$/;

export function cleanVideoTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  let text = title.replace(/[\r\n]+/g, " ").replace(/#[^\s#]+/g, " ");
  // "김해 당일치기 | 여행채널"처럼 | 뒤는 보통 채널명이라 앞부분을 쓴다. 앞이 비었으면 처음 나오는 의미 있는 부분을 쓴다.
  const segments = text.split(/\s*[|｜]\s*/).filter((segment) => segment.trim().length >= 2);
  if (segments.length > 0) text = segments[0];
  let prev: string;
  do {
    prev = text;
    text = text.replace(LEADING_TAG, "").replace(TRAILING_TAG, "");
  } while (text !== prev);
  text = text.replace(/\s{2,}/g, " ").trim();
  if (text.length < 2 || PLACEHOLDER_TITLE.test(text)) return null;
  return text;
}
