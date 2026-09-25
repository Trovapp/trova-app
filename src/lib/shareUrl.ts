// 백엔드 SharesController의 호스트 화이트리스트와 같은 기준으로 미리 걸러서,
// 명백히 지원하지 않는 링크는 서버 왕복 없이 바로 안내한다(최종 판정은 여전히 서버).
const SUPPORTED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

export function isSupportedShareUrl(url: string): boolean {
  const match = /^https?:\/\/([^/?#:]+)/i.exec(url.trim());
  if (!match) return false;
  return SUPPORTED_HOSTS.has(match[1].toLowerCase().replace(/\.$/, ""));
}

// 제목을 못 얻은 영상(주로 추출 실패)은 긴 URL 대신 "쇼츠 · CXdphBD0"처럼 종류와 영상 ID만 보여준다.
// 플랫폼 이름(유튜브/인스타그램)은 카드 위에 따로 표시되므로 여기엔 넣지 않는다.
const SOURCE_PATTERNS: [RegExp, string, "yt" | "ig"][] = [
  [/youtube(?:-nocookie)?\.com\/shorts\/([\w-]+)/i, "쇼츠", "yt"],
  [/youtube(?:-nocookie)?\.com\/watch\?(?:.*&)?v=([\w-]+)/i, "영상", "yt"],
  [/youtu\.be\/([\w-]+)/i, "영상", "yt"],
  [/instagram\.com\/(?:reels?|tv)\/([\w-]+)/i, "릴스", "ig"],
  [/instagram\.com\/p\/([\w-]+)/i, "게시물", "ig"],
];

export function describeSourceUrl(url: string): string {
  for (const [pattern, kind] of SOURCE_PATTERNS) {
    const match = pattern.exec(url);
    if (match) return `${kind} · ${match[1]}`;
  }
  return url;
}

// 같은 영상인지 비교하는 키. 쇼츠/watch/youtu.be처럼 주소 모양이 달라도 영상 ID가 같으면 같은 키가 된다
// (공유할 때마다 붙는 ?si= 같은 추적 파라미터도 무시됨). 알 수 없는 형식은 주소 자체로 비교한다.
export function sourceVideoKey(url: string): string {
  for (const [pattern, , platform] of SOURCE_PATTERNS) {
    const match = pattern.exec(url);
    if (match) return `${platform}:${match[1]}`;
  }
  return url.trim();
}
