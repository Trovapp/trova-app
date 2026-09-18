import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

type Card = { icon: keyof typeof Feather.glyphMap; color: string };

const DEFAULT_CARDS: Card[] = [
  { icon: "compass", color: colors.accent },
  { icon: "map", color: "#3B7A6E" },
  { icon: "camera", color: "#D9A441" },
  { icon: "map-pin", color: "#4A6FA5" },
  { icon: "briefcase", color: "#8C5E58" },
];

const CARD_SIZE = 72;
const CARD_GAP = 12;
const MS_PER_CARD = 1800;
const CREEP_TICK_MS = 150;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function ProgressCard({ icon, color }: Card) {
  return (
    <View
      style={{
        width: CARD_SIZE,
        height: CARD_SIZE,
        marginRight: CARD_GAP,
        borderRadius: 18,
        backgroundColor: `${color}26`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Feather name={icon} size={28} color={color} />
    </View>
  );
}

// 실제 후보 장소 사진 대신, 여행 테마 아이콘 카드가 옆으로 끊임없이 흘러가는
// 연출로 대기 화면에 움직임을 준다 — 세트를 두 번 이어붙이고 첫 번째 세트
// 폭만큼 translateX를 반복시켜서 이음매 없이 무한히 흐르는 것처럼 보이게 한다.
//
// percent(백엔드가 실제로 확인해준 값)는 절대 밑돌지 않되, 다음 실제 값이 오기
// 전까지의 "정지 구간"을 ceiling까지 천천히 채워서 살아있는 느낌을 준다 — 절대
// ceiling을 넘어서지 않고, 새 percent가 도착하면 그 즉시 그 값으로 맞춘다.
export function ProgressHero({
  percent,
  ceiling,
  creepMs = 6000,
  cards = DEFAULT_CARDS,
}: {
  percent: number;
  ceiling?: number;
  creepMs?: number;
  cards?: Card[];
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [setWidth, setSetWidth] = useState(0);

  const effectiveCeiling = Math.max(ceiling ?? percent, percent);
  const [displayPercent, setDisplayPercent] = useState(percent);
  const floorRef = useRef(percent);
  const startRef = useRef(Date.now());

  useEffect(() => {
    floorRef.current = percent;
    startRef.current = Date.now();
    setDisplayPercent((prev) => Math.max(prev, percent));
  }, [percent]);

  useEffect(() => {
    if (effectiveCeiling <= floorRef.current) return;
    const id = setInterval(() => {
      const t = Math.min((Date.now() - startRef.current) / creepMs, 1);
      const value = floorRef.current + (effectiveCeiling - floorRef.current) * easeOutCubic(t);
      const capped = Math.min(Math.round(value), effectiveCeiling);
      // 새 floor가 기존에 이미 보여준 값보다 낮더라도(크리프가 앞서가 있던 상태에서
      // 실제 값이 도착한 경우) 화면상 숫자가 뒤로 가지 않도록 이전 값보다 낮게는 안 내림.
      setDisplayPercent((prev) => Math.max(prev, capped));
      if (t >= 1) clearInterval(id);
    }, CREEP_TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, effectiveCeiling, creepMs]);

  useEffect(() => {
    if (setWidth === 0) return;
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -setWidth,
        duration: cards.length * MS_PER_CARD,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [setWidth, cards.length, translateX]);

  return (
    <View style={{ width: "100%", alignItems: "center", gap: 20 }}>
      <AppText weight="medium" style={{ fontSize: 48, color: colors.accent }}>
        {displayPercent}%
      </AppText>
      <View style={{ width: "100%", height: CARD_SIZE, overflow: "hidden" }}>
        <Animated.View
          style={{ flexDirection: "row", transform: [{ translateX }] }}
          onLayout={(e) => {
            if (setWidth === 0) setSetWidth(e.nativeEvent.layout.width / 2);
          }}
        >
          {[...cards, ...cards].map((card, i) => (
            <ProgressCard key={i} icon={card.icon} color={card.color} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}
