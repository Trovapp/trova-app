// 백엔드 ShareUrl(#50)과 같은 기준으로 미리 걸러서, 영상이 아닌 링크(채널·계정 페이지, 리다이렉트 주소 등)는
// 서버 왕복 없이 바로 안내한다(최종 판정은 여전히 서버).
export const UNSUPPORTED_SHARE_URL_MESSAGE = "유튜브 영상·쇼츠 또는 인스타그램 릴스·게시물 링크만 등록할 수 있어요.";

const VIDEO_ID = "[A-Za-z0-9_-]{1,64}";
// 호스트가 스킴 바로 뒤에 와야 한다 — "user@evil.com" 같은 형태는 여기서 걸러진다.
const VIDEO_URL_PATTERNS = [
  new RegExp(`^https?://youtu\\.be\\.?/${VIDEO_ID}(?:[/?#]|$)`, "i"),
  new RegExp(`^https?://(?:www\\.|m\\.)?youtube(?:-nocookie)?\\.com\\.?/(?:shorts|live|embed)/${VIDEO_ID}(?:[/?#]|$)`, "i"),
  new RegExp(`^https?://(?:www\\.|m\\.)?youtube(?:-nocookie)?\\.com\\.?/watch\\?(?:[^#]*&)?v=${VIDEO_ID}(?:[&#]|$)`, "i"),
  new RegExp(`^https?://(?:www\\.|m\\.)?instagram\\.com\\.?/(?:reels?|p|tv)/${VIDEO_ID}(?:[/?#]|$)`, "i"),
];

/** 복사한 글에서 첫 링크만 꺼낸다 — 인스타 공유 문구처럼 링크 앞뒤에 글이 붙어 있을 수 있다. 링크가 없으면 글 그대로. */
export function extractFirstUrl(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  return (match ? match[0] : text).trim();
}

export function isSupportedShareUrl(url: string): boolean {
  const trimmed = url.trim();
  return VIDEO_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
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

// 제목을 쓸 수 없을 때(없거나 인스타 자동 제목) 대신 보여줄 영상 종류 이름. 예: "유튜브 쇼츠", "인스타그램 릴스".
export function sourceKindLabel(url: string): string {
  for (const [pattern, kind, platform] of SOURCE_PATTERNS) {
    if (pattern.test(url)) return `${platform === "yt" ? "유튜브" : "인스타그램"} ${kind}`;
  }
  return "영상";
}

// 영상 기록 목록의 썸네일(2026-10 QA C4). 유튜브는 API 키 없이 쓰는 공개 썸네일 주소가 있어 비용이 들지 않는다.
// hqdefault(480x360, 약 20KB)를 쓴다 — 쇼츠도 가운데에 세로 화면, 양옆은 흐린 배경이라 정사각형으로 잘라도 자연스럽다.
// 인스타그램은 키 없이 받을 수 있는 썸네일 주소가 없어 null(호출부가 아이콘 타일로 대신한다).
export function youtubeThumbnailUrl(url: string): string | null {
  for (const [pattern, , platform] of SOURCE_PATTERNS) {
    if (platform !== "yt") continue;
    const match = pattern.exec(url);
    if (match) return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}
