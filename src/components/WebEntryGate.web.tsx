import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { FONT } from "@/components/AppText";
import {
  AndroidMenu,
  HomeIcon,
  PasteButtonArt,
  ShareSheet,
  type Palette,
} from "@/components/web/InstallIllustrations";
import { Shot } from "@/components/web/Shot";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 웹(PWA) 첫 화면(ADR 0013, 유니플 방식): 브라우저로 열면 소개 → 설치 안내(그림)로 유도하고,
// 홈 화면 아이콘으로 열면(standalone) 바로 앱을 보여준다. 로그인은 설치한 앱 안에서 한다 —
// 아이폰 홈 화면 앱은 Safari와 저장소가 따로라 브라우저에서 로그인해도 이어지지 않는다.

const DIRECT_KEY = "trova_web_direct";

type Os = "ios" | "android" | "other";
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detectOs(): Os {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** 인스타·카카오톡·페이스북·네이버 등 앱 안의 브라우저 — 여기서는 홈 화면에 추가가 안 된다. */
function detectInAppBrowser(): string | null {
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return "인스타그램";
  if (/KAKAOTALK/i.test(ua)) return "카카오톡";
  if (/FBAN|FBAV/i.test(ua)) return "페이스북";
  if (/NAVER\(inapp/i.test(ua)) return "네이버";
  if (/Line\//i.test(ua)) return "라인";
  if (/everytimeApp/i.test(ua)) return "에브리타임";
  return null;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function shouldShowApp(): boolean {
  const path = window.location.pathname;
  // 로그인 콜백·안드로이드 공유는 앱이 처리한다.
  if (path.startsWith("/auth/callback") || path.startsWith("/share")) return true;
  if (isStandalone()) return true;
  try {
    return window.localStorage.getItem(DIRECT_KEY) === "1";
  } catch {
    return false;
  }
}

export function WebEntryGate({ children }: { children: ReactNode }) {
  const [showApp, setShowApp] = useState(shouldShowApp);
  const [step, setStep] = useState<"intro" | "install">("intro");

  useEffect(() => {
    // 서비스 워커는 설치 조건만 맞추고 캐시하지 않는다(public/sw.js).
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  if (showApp) return <>{children}</>;

  function useInBrowser() {
    try {
      window.localStorage.setItem(DIRECT_KEY, "1");
    } catch {
      // 저장이 막혀도 이번 방문은 앱으로 들어간다.
    }
    setShowApp(true);
  }

  return (
    <div style={page()}>
      <div style={column()}>
        {step === "intro" ? (
          <Intro onStart={() => setStep("install")} onUseInBrowser={useInBrowser} />
        ) : (
          <Install onBack={() => setStep("intro")} onUseInBrowser={useInBrowser} />
        )}
      </div>
    </div>
  );
}

const palette = (): Palette => ({
  frame: colors.ink,
  screen: colors.bg,
  ink: colors.ink,
  muted: colors.inkMuted,
  line: colors.borderSubtle,
  accent: colors.accent,
  accentBg: colors.accentBg,
});

// 색은 그릴 때마다 읽는다 — 모듈에서 미리 만들면 다크 모드에서 라이트 색이 섞인다(theme.ts 규칙, 2026-10-12 카카오톡 다크 화면에서 발견).
const page = (): CSSProperties => ({ height: "100%", overflowY: "auto", background: colors.bgMuted, WebkitOverflowScrolling: "touch" });
const column = (): CSSProperties => ({
  maxWidth: 480,
  margin: "0 auto",
  padding: `${space.xl}px ${space.md}px ${space.xxxl}px`,
  fontFamily: FONT.regular,
  color: colors.ink,
});
const h1 = (): CSSProperties => ({ fontFamily: FONT.bold, fontSize: fontSize.title1, lineHeight: 1.3, margin: 0 });
const h2 = (): CSSProperties => ({ fontFamily: FONT.bold, fontSize: fontSize.title3, margin: `${space.xxl}px 0 ${space.sm}px` });
const muted = (): CSSProperties => ({ color: colors.inkMuted, fontSize: fontSize.subheadline, lineHeight: 1.6, margin: 0 });
const card = (): CSSProperties => ({ background: colors.bg, borderRadius: radius.lg, padding: space.md, border: `1px solid ${colors.borderSubtle}` });

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: `${space.md}px`,
        border: 0,
        borderRadius: radius.md,
        background: colors.accent,
        color: colors.onAccent,
        fontFamily: FONT.bold,
        fontSize: fontSize.body,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "none", border: 0, color: colors.inkMuted, fontFamily: FONT.medium, fontSize: fontSize.footnote, padding: space.sm, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

// 실제 앱 화면(iPhone 17 Pro 시뮬레이터, 로컬 서버 + 개발 DB 테스트 계정, 2026-10-12 qaflow로 캡처).
const SHOTS = [
  { src: "/landing/1-places.jpg", title: "공유 한 번이면", body: "릴스·유튜브 링크를 보내면 AI가 영상 속 장소를 찾아 지도에 표시해요." },
  { src: "/landing/2-home-draft-card.jpg", title: "일정 초안이 저절로", body: "찾은 장소로 며칠짜리 일정 초안을 미리 짜 둬요." },
  { src: "/landing/3-draft.jpg", title: "동선까지 정리", body: "가까운 곳끼리 묶어 날짜별로 정리해 드려요." },
  { src: "/landing/4-trip.jpg", title: "내 여행으로 저장", body: "마음에 들면 승인만 하면 여행이 돼요." },
];

function Intro({ onStart, onUseInBrowser }: { onStart: () => void; onUseInBrowser: () => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.xl }}>
        <img src="/icons/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: radius.md }} />
        <span style={{ fontFamily: FONT.bold, fontSize: fontSize.title3 }}>Trova</span>
      </div>
      <h1 style={h1()}>
        여행 릴스 하나 공유하면
        <br />
        일정이 생겨요
      </h1>
      <p style={{ ...muted(), marginTop: space.sm }}>저장만 해 두고 잊어버린 여행 영상, 이제 장소와 일정으로 바로 정리해요.</p>

      <div style={{ marginTop: space.xl }}>
        <PrimaryButton onClick={onStart}>앱 설치하고 시작하기</PrimaryButton>
        <p style={{ ...muted(), textAlign: "center", fontSize: fontSize.footnote, marginTop: space.xs }}>
          앱스토어 없이 무료 · 1분이면 설치돼요
        </p>
      </div>

      <h2 style={h2()}>이렇게 쓰여요</h2>
      <div style={{ display: "flex", gap: space.sm, overflowX: "auto", paddingBottom: space.xs, scrollSnapType: "x mandatory" }}>
        {SHOTS.map((shot, i) => (
          <figure key={shot.src} style={{ ...card(), margin: 0, flex: "0 0 72%", scrollSnapAlign: "start" }}>
            <img
              src={shot.src}
              alt={shot.title}
              loading="lazy"
              style={{ width: "100%", borderRadius: radius.md, border: `1px solid ${colors.borderSubtle}`, display: "block" }}
            />
            <figcaption style={{ marginTop: space.sm }}>
              <div style={{ fontFamily: FONT.bold, fontSize: fontSize.callout }}>
                {i + 1}. {shot.title}
              </div>
              <div style={{ ...muted(), fontSize: fontSize.footnote }}>{shot.body}</div>
            </figcaption>
          </figure>
        ))}
      </div>

      <div style={{ marginTop: space.xxl }}>
        <PrimaryButton onClick={onStart}>앱 설치하고 시작하기</PrimaryButton>
        <div style={{ textAlign: "center", marginTop: space.xs }}>
          <TextButton onClick={onUseInBrowser}>설치하지 않고 이 브라우저에서 쓰기</TextButton>
        </div>
      </div>
    </>
  );
}

function Step({ n, title, body, art }: { n: number; title: string; body?: ReactNode; art: ReactNode }) {
  return (
    <div style={{ ...card(), marginBottom: space.sm }}>
      <div style={{ display: "flex", gap: space.sm, alignItems: "baseline" }}>
        <span
          style={{
            flex: "0 0 auto",
            width: 24,
            height: 24,
            lineHeight: "24px",
            textAlign: "center",
            borderRadius: radius.full,
            background: colors.accent,
            color: colors.onAccent,
            fontFamily: FONT.bold,
            fontSize: fontSize.footnote,
          }}
        >
          {n}
        </span>
        <div>
          <div style={{ fontFamily: FONT.bold, fontSize: fontSize.callout }}>{title}</div>
          {body && <div style={{ ...muted(), fontSize: fontSize.footnote, marginTop: space.xxxs }}>{body}</div>}
        </div>
      </div>
      <div style={{ marginTop: space.md }}>{art}</div>
    </div>
  );
}

function Install({ onBack, onUseInBrowser }: { onBack: () => void; onUseInBrowser: () => void }) {
  const [os, setOs] = useState<Os>(detectOs);
  const inApp = detectInAppBrowser();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const p = palette();

  useEffect(() => {
    // 안드로이드 Chrome은 이 이벤트로 "설치" 버튼을 바로 띄울 수 있다(아이폰은 지원하지 않는다).
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const tab = (value: Os, label: string) => (
    <button
      type="button"
      onClick={() => setOs(value)}
      aria-pressed={os === value}
      style={{
        flex: 1,
        padding: space.sm,
        borderRadius: radius.md,
        border: `1.5px solid ${os === value ? colors.accent : colors.border}`,
        background: os === value ? colors.accentBg : colors.bg,
        color: os === value ? colors.accent : colors.inkMuted,
        fontFamily: FONT.bold,
        fontSize: fontSize.subheadline,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const browserName = os === "ios" ? "Safari" : "Chrome";
  return (
    <>
      <TextButton onClick={onBack}>← 소개로</TextButton>
      <h1 style={{ ...h1(), fontSize: fontSize.title2, marginTop: space.xs }}>마지막 설치 단계예요</h1>
      <p style={{ ...muted(), marginTop: space.xs }}>홈 화면에 추가하면 주소창 없이 앱처럼 열려요.</p>

      {inApp && (
        <div role="alert" style={{ ...card(), marginTop: space.md, background: colors.accentBg, borderColor: colors.accent }}>
          <div style={{ fontFamily: FONT.bold, fontSize: fontSize.callout }}>{inApp} 안에서는 설치가 안 돼요</div>
          <p style={{ ...muted(), fontSize: fontSize.footnote, marginTop: space.xxs }}>
            오른쪽 위(또는 아래) ⋯ 버튼에서 &lsquo;{browserName}로 열기&rsquo;를 누르거나, 주소를 복사해 {browserName}에 붙여넣어 주세요.
          </p>
          <div style={{ marginTop: space.sm }}>
            <PrimaryButton onClick={copyLink}>{copied ? "주소를 복사했어요" : "주소 복사하기"}</PrimaryButton>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: space.xs, margin: `${space.lg}px 0 ${space.md}px` }}>
        {tab("ios", "아이폰")}
        {tab("android", "안드로이드")}
      </div>

      {os === "android" && installEvent && (
        <div style={{ marginBottom: space.md }}>
          <PrimaryButton
            onClick={async () => {
              await installEvent.prompt();
              setInstallEvent(null);
            }}
          >
            바로 설치하기
          </PrimaryButton>
        </div>
      )}

      {os !== "android" ? (
        <>
          <Step n={1} title="Safari로 열기" body="인스타·카카오톡 안의 브라우저라면 Safari로 다시 열어 주세요." art={null} />
          <Step
            n={2}
            title="주소창 오른쪽 ⋯ 누르기"
            body="iOS 18 이하에서는 아래 가운데 공유 버튼(□↑)을 누르고 4번으로 가세요."
            art={<Shot src="/install/ios-1-more.jpg" alt="Safari 아래 주소창 오른쪽의 ⋯ 버튼" marks={[{ x: 85.5, y: 76.3 }]} />}
          />
          <Step n={3} title="‘공유’ 누르기" art={<Shot src="/install/ios-2-share.jpg" alt="⋯ 메뉴의 공유" marks={[{ x: 21, y: 12.4 }]} />} />
          <Step
            n={4}
            title="‘더 보기’ 누르기"
            body="공유 화면 아래쪽 줄 오른쪽 끝(⌄)이에요."
            art={<Shot src="/install/ios-3-more-actions.jpg" alt="공유 화면의 더 보기" marks={[{ x: 82.8, y: 36 }]} />}
          />
          <Step n={5} title="‘홈 화면에 추가’ 누르기" art={<Shot src="/install/ios-4-add-home.jpg" alt="홈 화면에 추가" marks={[{ x: 12, y: 83.8 }]} />} />
          <Step
            n={6}
            title="‘웹 앱으로 열기’ 켜 두고 ‘추가’"
            body="켜져 있어야 주소창 없이 앱처럼 열려요."
            art={<Shot src="/install/ios-5-add.jpg" alt="웹 앱으로 열기를 켜고 추가" marks={[{ x: 87.5, y: 82.6 }, { x: 88.2, y: 15.6 }]} />}
          />
          <Step
            n={7}
            title="홈 화면의 Trova로 열고 로그인"
            body="설치한 앱에서 한 번 더 로그인해야 해요(브라우저와 따로 저장돼요)."
            art={<Shot src="/install/ios-6-icon.jpg" alt="홈 화면에 생긴 Trova 아이콘" marks={[{ x: 30, y: 43, size: 64 }]} />}
          />
        </>
      ) : (
        <>
          <Step n={1} title="Chrome으로 열기" body="다른 앱 안의 브라우저라면 Chrome으로 다시 열어 주세요." art={null} />
          <Step n={2} title="오른쪽 위 ⋮ → ‘앱 설치’" body="‘홈 화면에 추가’로 보일 수도 있어요." art={<AndroidMenu p={p} />} />
          <Step n={3} title="홈 화면의 Trova로 열고 로그인" art={<HomeIcon p={p} iconSrc="/icons/icon-192.png" />} />
        </>
      )}

      <h2 style={h2()}>영상 링크 넣는 방법</h2>
      {os === "android" ? (
        <Step
          n={1}
          title="인스타·유튜브에서 공유 → Trova"
          body="설치하고 나면 공유 목록에 Trova가 생겨요. 누르면 바로 저장돼요."
          art={<ShareSheet p={p} label="Trova" />}
        />
      ) : (
        <Step
          n={1}
          title="공유 → ‘Trova에 저장’ (단축어)"
          body="앱을 열지 않고 공유 한 번에 저장돼요. 설치하고 로그인한 뒤 마이페이지 → ‘아이폰 공유 단축어’에서 단축어를 받아 주세요(받는 방법도 거기 있어요)."
          art={<Shot src="/install/sc-8-run.jpg" alt="공유 목록의 Trova에 저장" marks={[{ x: 50, y: 88.3, w: 93, h: 18 }]} />}
        />
      )}
      <Step
        n={2}
        title="링크 복사 → Trova 홈의 붙여넣기 버튼"
        body="단축어 없이도 돼요. 복사해 두고 앱을 열어 버튼 한 번이면 저장돼요."
        art={<PasteButtonArt p={p} />}
      />

      <div style={{ textAlign: "center", marginTop: space.lg }}>
        <TextButton onClick={onUseInBrowser}>설치하지 않고 이 브라우저에서 쓰기</TextButton>
      </div>
    </>
  );
}
