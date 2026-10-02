import { useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { space as spacing } from "@/lib/theme";

// 그림 위아래 여백. 소개 그림의 카드는 기울어져 있어 실제로 보이는 범위가 잰 크기보다 조금 크다 —
// 여백 없이 꽉 맞추면 큰 글자에서 위 로고·아래 제목에 닿았다(SE 실측).
const INSET = spacing.md;

// 고정 크기 그림(소개 그림, 따라하기 휴대폰 미리보기)이 남은 공간보다 크면 비율을 유지한 채 통째로 줄인다.
// 작은 화면(iPhone SE)·큰 글자에서 가운데 정렬된 그림이 위아래로 넘쳐 위의 탭을 덮고(유튜브 탭이 안 눌림)
// 아래 버튼 뒤로 숨던 문제를 막는다. 공간이 충분하면 그대로(1배) — 키우지는 않는다.
// transform으로 줄이므로 안쪽 레이아웃은 그대로고, 누르는 위치도 줄어든 모습에 맞게 따라간다.
export function FitToSpace({ children }: { children: ReactNode }) {
  const [space, setSpace] = useState<{ width: number; height: number } | null>(null);
  const [content, setContent] = useState<{ width: number; height: number } | null>(null);

  const scale =
    space && content && content.width > 0 && content.height > 0
      ? Math.min(1, space.width / content.width, (space.height - INSET * 2) / content.height)
      : 1;

  return (
    <View
      style={{ flex: 1, alignSelf: "stretch", justifyContent: "center", alignItems: "center" }}
      onLayout={(e: LayoutChangeEvent) => setSpace(e.nativeEvent.layout)}
    >
      {/* 크기를 재기 전 첫 프레임에 넘친 모습이 보이지 않게 잴 때까지 감춘다 */}
      <View
        style={{ transform: [{ scale }], opacity: space && content ? 1 : 0 }}
        onLayout={(e: LayoutChangeEvent) => setContent(e.nativeEvent.layout)}
      >
        {children}
      </View>
    </View>
  );
}
