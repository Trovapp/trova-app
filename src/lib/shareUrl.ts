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
