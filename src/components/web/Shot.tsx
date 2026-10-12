import { colors, radius } from "@/lib/theme";

/** 동그라미(size px) 또는 w·h(%)를 주면 그 크기의 테두리 상자 — 글자가 있는 버튼·줄은 상자로 감싸 글자를 가리지 않는다. */
export type Mark = { x: number; y: number; size?: number; w?: number; h?: number };

/**
 * 실제 화면 캡처(iOS 26, iPhone 17 Pro 시뮬레이터, 2026-10-12)에 누를 곳을 덧그린다(웹 전용). 표시는 이미지에 그려 넣지 않고
 * 위에 얹어서 선명하고 다크 모드에서도 보인다. x·y는 이미지 안 위치(%).
 */
export function Shot({ src, alt, marks = [] }: { src: string; alt: string; marks?: Mark[] }) {
  return (
    <div style={{ position: "relative", borderRadius: radius.md, overflow: "hidden", border: `1px solid ${colors.borderSubtle}` }}>
      <img src={src} alt={alt} loading="lazy" style={{ width: "100%", display: "block" }} />
      {marks.map((m) => {
        const size = m.size ?? 44;
        const box = m.w !== undefined && m.h !== undefined;
        return (
          <span
            key={`${m.x}-${m.y}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: box ? `${m.w}%` : size,
              height: box ? `${m.h}%` : size,
              transform: "translate(-50%, -50%)",
              borderRadius: box ? radius.md : radius.full,
              border: `3px solid ${colors.accent}`,
              boxShadow: "0 0 0 3px rgba(255,255,255,0.8)",
            }}
          />
        );
      })}
    </div>
  );
}
