// 설치·링크 넣기 안내 그림(웹 전용, ADR 0013). 아이폰 설치는 실제 화면 캡처(WebEntryGate의 Shot)로 바꿨고, 안드로이드·링크 넣기만 그림. 실제 OS 화면 캡처 대신 단순화한 휴대폰 그림 —
// iOS·안드로이드 버전마다 화면이 달라 캡처는 금방 낡는다. 강조할 곳은 accent 색 테두리와 손가락 표시로 보여준다.
import type { ReactNode } from "react";

type Palette = { frame: string; screen: string; ink: string; muted: string; line: string; accent: string; accentBg: string };

function Phone({ p, children }: { p: Palette; children: ReactNode }) {
  return (
    <svg viewBox="0 0 160 300" width="100%" style={{ maxWidth: 170, display: "block", margin: "0 auto" }} aria-hidden="true">
      <rect x="2" y="2" width="156" height="296" rx="26" fill={p.frame} />
      <rect x="9" y="9" width="142" height="282" rx="20" fill={p.screen} />
      <rect x="58" y="15" width="44" height="10" rx="5" fill={p.frame} />
      {children}
    </svg>
  );
}

function Tap({ x, y, p }: { x: number; y: number; p: Palette }) {
  return (
    <g>
      <circle cx={x} cy={y} r="13" fill="none" stroke={p.accent} strokeWidth="2.5" />
      <circle cx={x} cy={y} r="5" fill={p.accent} />
    </g>
  );
}

function Lines({ y, p, n = 3 }: { y: number; p: Palette; n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x="22" y={y + i * 16} width={i % 2 ? 90 : 116} height="7" rx="3.5" fill={p.line} />
      ))}
    </g>
  );
}

/** 아이폰 ③ / 안드로이드: 홈 화면에 생긴 Trova 아이콘 */
export function HomeIcon({ p, iconSrc }: { p: Palette; iconSrc: string }) {
  const cells = [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => ({ r, c })));
  return (
    <Phone p={p}>
      {cells.map(({ r, c }) =>
        r === 2 && c === 1 ? null : <rect key={`${r}-${c}`} x={22 + c * 30} y={50 + r * 40} width="22" height="22" rx="6" fill={p.line} />,
      )}
      <image href={iconSrc} x="50" y="128" width="26" height="26" />
      <rect x="50" y="128" width="26" height="26" rx="7" fill="none" stroke={p.accent} strokeWidth="2.5" />
      <text x="63" y="166" fontSize="8" textAnchor="middle" fill={p.ink}>Trova</text>
      <Tap x={63} y={141} p={p} />
    </Phone>
  );
}

/** 안드로이드: Chrome 오른쪽 위 ⋮ → "앱 설치" / "홈 화면에 추가" */
export function AndroidMenu({ p }: { p: Palette }) {
  return (
    <Phone p={p}>
      <rect x="18" y="34" width="104" height="16" rx="8" fill={p.line} />
      <circle cx="138" cy="38" r="1.8" fill={p.accent} />
      <circle cx="138" cy="43" r="1.8" fill={p.accent} />
      <circle cx="138" cy="48" r="1.8" fill={p.accent} />
      <rect x="62" y="58" width="84" height="104" rx="8" fill={p.screen} stroke={p.line} strokeWidth="2" />
      <rect x="70" y="68" width="66" height="8" rx="4" fill={p.line} />
      <rect x="70" y="84" width="58" height="8" rx="4" fill={p.line} />
      <rect x="66" y="98" width="76" height="20" rx="5" fill={p.accentBg} stroke={p.accent} strokeWidth="2" />
      <text x="104" y="111" fontSize="8.5" fontWeight="700" textAnchor="middle" fill={p.ink}>앱 설치</text>
      <rect x="70" y="128" width="62" height="8" rx="4" fill={p.line} />
      <Lines y={180} p={p} n={4} />
      <Tap x={128} y={108} p={p} />
    </Phone>
  );
}

/** 링크 넣기: 인스타·유튜브 공유 → (아이폰) "Trova에 저장" 단축어 / (안드로이드) Trova */
export function ShareSheet({ p, label }: { p: Palette; label: string }) {
  return (
    <Phone p={p}>
      <rect x="22" y="38" width="116" height="110" rx="10" fill={p.frame} opacity="0.85" />
      <path d="M72 80 l22 13 -22 13 z" fill={p.screen} />
      <rect x="9" y="160" width="142" height="131" rx="16" fill={p.frame} opacity="0.06" />
      <text x="22" y="182" fontSize="9" fill={p.muted}>공유</text>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={22 + i * 30} y="190" width="22" height="22" rx="11" fill={p.line} />
      ))}
      <rect x="20" y="226" width="120" height="26" rx="6" fill={p.accentBg} stroke={p.accent} strokeWidth="2" />
      <text x="28" y="243" fontSize="10" fontWeight="700" fill={p.ink}>{label}</text>
      <Tap x={133} y={239} p={p} />
    </Phone>
  );
}

/** 링크 넣기: 앱 홈의 붙여넣기 버튼 */
export function PasteButtonArt({ p }: { p: Palette }) {
  return (
    <Phone p={p}>
      <text x="22" y="56" fontSize="11" fontWeight="700" fill={p.ink}>영상 링크를 넣어 주세요</text>
      <rect x="20" y="66" width="88" height="26" rx="8" fill={p.screen} stroke={p.line} strokeWidth="2" />
      <text x="28" y="83" fontSize="8" fill={p.muted}>instagram.com/reel/…</text>
      <rect x="114" y="66" width="26" height="26" rx="8" fill={p.accentBg} stroke={p.accent} strokeWidth="2" />
      <rect x="121" y="72" width="12" height="15" rx="2" fill="none" stroke={p.accent} strokeWidth="1.8" />
      <rect x="124" y="70" width="6" height="4" rx="1" fill={p.accent} />
      <Lines y={110} p={p} n={5} />
      <Tap x={127} y={79} p={p} />
    </Phone>
  );
}

export type { Palette };
