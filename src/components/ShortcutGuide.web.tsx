import type { ReactNode } from "react";
import { FONT } from "@/components/AppText";
import { Shot, type Mark } from "@/components/web/Shot";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 아이폰 단축어 받기·쓰기 안내(ADR 0013). 캡처는 iOS 26 Safari·단축어 앱 실제 화면(2026-10-12, 로컬 서버로 끝까지 저장되는 것 확인).
// 키가 보이는 화면은 쓰지 않는다.

type GuideStep = { title: string; body?: ReactNode; shots: { src: string; alt: string; marks?: Mark[] }[] };

const SETUP: GuideStep[] = [
  { title: "위에서 키를 받아 복사하기", body: "단축어를 추가할 때 붙여넣어요.", shots: [] },
  {
    title: "‘단축어 받기’ → ‘다운로드’",
    shots: [{ src: "/install/sc-1-download.jpg", alt: "Trova에 저장 파일 다운로드 묻는 창", marks: [{ x: 82.6, y: 74.5, w: 20, h: 24 }] }],
  },
  {
    title: "주소창 왼쪽 ⤓ → ‘다운로드’",
    body: "Safari 아래 주소창 왼쪽의 다운로드 표시를 눌러요.",
    shots: [
      { src: "/install/sc-2-icon.jpg", alt: "주소창 왼쪽 다운로드 표시", marks: [{ x: 28.3, y: 47 }] },
      { src: "/install/sc-3-menu.jpg", alt: "메뉴의 다운로드", marks: [{ x: 50, y: 59.7, w: 93, h: 19 }] },
    ],
  },
  {
    title: "‘Trova에 저장’ 누르기",
    shots: [{ src: "/install/sc-4-file.jpg", alt: "다운로드 항목의 Trova에 저장", marks: [{ x: 50, y: 70.6, w: 96, h: 44 }] }],
  },
  {
    title: "‘단축어 설정’ 누르기",
    shots: [{ src: "/install/sc-5-setup.jpg", alt: "단축어 설정 버튼", marks: [{ x: 50, y: 77.5, w: 93, h: 28 }] }],
  },
  {
    title: "빈칸을 눌러 ‘붙여넣기’ → ‘단축어 추가’",
    body: "복사한 키가 들어가요. 키는 내 단축어에만 저장돼요.",
    shots: [{ src: "/install/sc-6-paste.jpg", alt: "키 붙여넣기", marks: [{ x: 15.5, y: 85.3, w: 25, h: 19 }] }],
  },
];

const USE: GuideStep[] = [
  {
    title: "영상에서 공유 → ‘더 보기’",
    body: "인스타·유튜브 앱에서는 공유 → ‘더 보기’ 또는 ‘공유…’를 누르면 이 목록이 나와요.",
    shots: [{ src: "/install/sc-7-more.jpg", alt: "공유 화면의 더 보기", marks: [{ x: 82.8, y: 40 }] }],
  },
  {
    title: "‘Trova에 저장’ 누르기",
    body: "처음 한 번은 연결·알림을 물어요. ‘항상 허용’과 ‘허용’을 눌러 주세요.",
    shots: [{ src: "/install/sc-8-run.jpg", alt: "공유 목록의 Trova에 저장", marks: [{ x: 50, y: 88.3, w: 93, h: 18 }] }],
  },
  {
    title: "알림이 뜨면 끝",
    body: "분석이 끝나면 앱에서 장소를 볼 수 있어요.",
    shots: [{ src: "/install/sc-9-done.jpg", alt: "Trova에 보냈어요 알림" }],
  },
];

function Steps({ steps, start }: { steps: GuideStep[]; start: number }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: space.md }}>
      {steps.map((step, i) => (
        <li key={step.title} style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
          <div style={{ display: "flex", gap: space.sm, alignItems: "baseline" }}>
            <span
              style={{
                flex: "0 0 auto",
                width: 22,
                height: 22,
                lineHeight: "22px",
                textAlign: "center",
                borderRadius: radius.full,
                background: colors.accent,
                color: colors.onAccent,
                fontFamily: FONT.bold,
                fontSize: fontSize.caption1,
              }}
            >
              {start + i}
            </span>
            <div>
              <div style={{ fontFamily: FONT.bold, fontSize: fontSize.subheadline, color: colors.ink }}>{step.title}</div>
              {step.body && (
                <div style={{ fontFamily: FONT.regular, fontSize: fontSize.footnote, color: colors.inkMuted, marginTop: space.xxxs }}>
                  {step.body}
                </div>
              )}
            </div>
          </div>
          {step.shots.map((shot) => (
            <Shot key={shot.src} src={shot.src} alt={shot.alt} marks={shot.marks} />
          ))}
        </li>
      ))}
    </ol>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 style={{ fontFamily: FONT.bold, fontSize: fontSize.callout, color: colors.ink, margin: `${space.sm}px 0` }}>{children}</h2>;
}

/** 단축어 받기(한 번)와 쓰기 안내. 아이폰 공유 단축어 화면에서 쓴다. */
export function ShortcutGuide() {
  return (
    <div>
      <Heading>단축어 받기 (한 번만)</Heading>
      <Steps steps={SETUP} start={1} />
      <div style={{ height: space.lg }} />
      <Heading>영상 저장하기</Heading>
      <Steps steps={USE} start={1} />
    </div>
  );
}
