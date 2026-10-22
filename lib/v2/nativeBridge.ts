// 웹(앱 화면) ↔ iOS 네이티브(위젯 · 단축어 · 실시간 현황) 다리(2026-10-10, 1.5 빌드부터).
//
// 네이티브 쪽은 ios/App/App/AppDelegate.swift의 PackInBagNativePlugin("PackInBagNative").
// - 로그인 상태면 기기 토큰(/api/native/device-token)을 받아 네이티브에 넘긴다 → App Group에 저장 → 위젯·단축어가 서버를 부를 때 사용
// - 가방이 바뀌면 요약(lib/nativeSummary.ts)을 넘긴다 → App Group에 저장하고 위젯 · 실시간 현황을 바로 새로 그린다
// - 로그아웃 · 오프라인 모드면 지운다(네이티브가 서버에서 토큰도 지운다)
// 플러그인이 없는 웹 · PC · 스토어 1.3 앱에서는 아무것도 하지 않는다.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { User } from "firebase/auth";
import type { Bag, Pack, PrivateLock, WidgetStyle } from "@/lib/types";
import { buildNativeLibrary, buildNativeSummary, type NativeSummaryProfile } from "@/lib/nativeSummary";
import { getApiUrl } from "@/lib/apiBase";
import { nativeLockFilter } from "@/lib/v2/privateLock";

interface PackInBagNativePlugin {
  getSession(): Promise<{ uid?: string; hasToken: boolean }>;
  setSession(options: { uid: string; token: string; apiBase: string }): Promise<void>;
  clearSession(): Promise<void>;
  saveSummary(options: { json: string }): Promise<void>;
  startLiveActivity(options: LiveActivityOptions): Promise<{ id: string }>;
  endLiveActivity(): Promise<void>;
  liveActivityState(): Promise<LiveActivityState>;
  pickColor(options: { color?: string; alpha?: number }): Promise<{ color: string; alpha: number }>;
  // 북마크 위젯 꾸미기(1.7, 2026-10-18). 사진은 네이티브가 photoUrl로 내려받는다
  saveWidgetStyles(options: { json: string }): Promise<void>;
}

// custom = 직접 고른 배경색(bgColor "#RRGGBB" + bgAlpha 0.2~1, 10/11)
export type LiveActivityTheme = "system" | "light" | "dark" | "custom";
export type LiveActivityFont = "system" | "pretendard" | "gmarket" | "gaegu" | "d2coding";
export type LiveActivitySize = "small" | "medium" | "large";
// 글자색(2026-10-12): auto = 배경에 맞춰(예전과 같음) / white / black / custom(textColor "#RRGGBB"). 1.6 네이티브부터 반영, 그 전 빌드는 무시
export type LiveActivityTextTone = "auto" | "white" | "black" | "custom";

export interface LiveActivityOptions {
  bagId: string;
  // "*" = 가방 전체(10/11)
  packId: string;
  theme: LiveActivityTheme;
  font: LiveActivityFont;
  size: LiveActivitySize;
  bgColor?: string;
  bgAlpha?: number;
  textTone?: LiveActivityTextTone;
  textColor?: string;
  // 완료된 항목 보이기(2026-10-13). false면 잠금화면에서 챙긴 것을 뺀다. 1.6 네이티브부터, 그 전 빌드는 무시(항상 보임)
  showDone?: boolean;
}

export interface LiveActivityState {
  supported: boolean;
  enabled: boolean;
  active: boolean;
  bagId?: string;
  packId?: string;
}

const Native = registerPlugin<PackInBagNativePlugin>("PackInBagNative");

export function isNativeBridgeAvailable(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PackInBagNative");
}

let sessionTask: Promise<void> | null = null;

// 이 기기의 네이티브 세션을 지금 로그인한 계정에 맞춘다. 이미 같은 계정 토큰이 있으면 아무것도 안 한다
export function syncNativeSession(user: User | null, offlineMode: boolean): Promise<void> {
  if (!isNativeBridgeAvailable()) return Promise.resolve();
  const run = async () => {
    if (!user || offlineMode) {
      await Native.clearSession();
      // 네이티브가 꾸미기도 지우므로 다음 로그인 때 다시 넘기게
      lastWidgetStyles = "";
      lastWidgetStylesValue = null;
      return;
    }
    const current = await Native.getSession();
    if (current.hasToken && current.uid === user.uid) return;
    const idToken = await user.getIdToken();
    const res = await fetch(getApiUrl("/api/native/device-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ platform: Capacitor.getPlatform() }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string };
    if (!res.ok || !data.token) throw new Error(`device-token ${res.status}`);
    await Native.setSession({ uid: user.uid, token: data.token, apiBase: window.location.origin });
    // 다른 계정으로 바뀌면 네이티브가 App Group을 비운다 → 이 계정 꾸미기를 이미 넘겼으면 다시(순서가 엇갈려도 남게)
    if (lastWidgetStylesValue) {
      lastWidgetStyles = "";
      void pushWidgetStyles(lastWidgetStylesValue);
    }
  };
  const prev = sessionTask ?? Promise.resolve();
  sessionTask = prev.then(run).catch((err) => console.error("[팩인백] 위젯 연결 실패:", err));
  return sessionTask;
}

let lastSummary = "";
let lastBags: Bag[] = [];
let lastUid = "";
let lastProfile: NativeSummaryProfile = {};
// 보관함 팩(1.6 Siri · Spotlight 검색, 10/12). 휴지통 · 빠른팩은 AppShell이 빼고 넘긴다. 아직 안 받았으면 null(요약에 키를 넣지 않음)
let lastLibrary: Pack[] | null = null;
let lockProfile: Pick<NativeSummaryProfile, "lockedBagIds" | "lockedPackKeys" | "lockedLibraryIds"> = {};

// 개인 잠금(2026-10-12): 잠근 가방 · 팩은 위젯 · 잠금화면 요약에서 뺀다. AuthProvider가 잠금 설정이 바뀔 때마다 부른다
export function setNativeSummaryLocks(lock: PrivateLock | null) {
  lockProfile = nativeLockFilter(lock);
  if (lastUid) void pushNativeSummary(lastBags, lastUid, lastProfile);
}

// 잠금화면 미리 보기가 실제로 뜨는 것과 같은 요약을 만들 때 쓴다
export function nativeSummaryLockProfile(): NativeSummaryProfile {
  return { ...lockProfile };
}

// 가방 요약을 네이티브에 넘긴다(같은 내용이면 건너뜀). 위젯 · 실시간 현황이 바로 새로 그려진다.
// profile: 보관함 가방은 빼고 고정 가방은 표시(10/11, 서버 /api/native/summary와 같은 기준)
// library: 보관함 팩(검색 색인용). 서버 요약에는 없고 앱이 열려 있을 때만 넘긴다(1.6, 10/12 A안)
export function pushNativeSummary(
  bags: Bag[],
  uid: string,
  profile: NativeSummaryProfile = lastProfile,
  library: Pack[] | null = lastLibrary,
): Promise<void> {
  if (!isNativeBridgeAvailable()) return Promise.resolve();
  lastBags = bags;
  lastUid = uid;
  lastProfile = profile;
  lastLibrary = library;
  const summary = buildNativeSummary(bags, uid, new Date(), { ...profile, ...lockProfile });
  if (library) summary.library = buildNativeLibrary(library, lockProfile.lockedLibraryIds);
  const json = JSON.stringify([summary.bags, summary.library ?? null]);
  if (json === lastSummary) return Promise.resolve();
  lastSummary = json;
  return Native.saveSummary({ json: JSON.stringify(summary) }).catch((err) => {
    lastSummary = "";
    console.error("[팩인백] 위젯 요약 저장 실패:", err);
  });
}

// 실시간 현황을 띄우기 직전: 지금 화면의 가방을 요약에 곧바로 반영한다(AppShell의 묶음 반영을 기다리지 않게)
function pushWithBag(bag: Bag, uid: string): Promise<void> {
  const base = lastUid === uid ? lastBags : [];
  const list = base.some((b) => b.id === bag.id) ? base.map((b) => (b.id === bag.id ? bag : b)) : [bag, ...base];
  return pushNativeSummary(list, uid);
}

export async function startLiveActivity(bag: Bag, uid: string, options: Omit<LiveActivityOptions, "bagId">): Promise<void> {
  await pushWithBag(bag, uid);
  await Native.startLiveActivity({ ...options, bagId: bag.id });
}

export async function endLiveActivity(): Promise<void> {
  if (!isNativeBridgeAvailable()) return;
  await Native.endLiveActivity();
}

export async function getLiveActivityState(): Promise<LiveActivityState | null> {
  if (!isNativeBridgeAvailable()) return null;
  try {
    return await Native.liveActivityState();
  } catch {
    return null;
  }
}

// iOS 기본 색 고르기 창(격자 · 스펙트럼 · 슬라이더 + 불투명도). 앱이 예전 빌드라 없으면 null
export async function pickNativeColor(color: string, alpha: number): Promise<{ color: string; alpha: number } | null> {
  if (!isNativeBridgeAvailable()) return null;
  try {
    return await Native.pickColor({ color, alpha });
  } catch {
    return null;
  }
}

// ---- 북마크 위젯 꾸미기(1.7, 2026-10-18) ----
// 네이티브가 saveWidgetStyles를 아는지(1.7 빌드부터). 설정 > 위젯 꾸미기 줄을 이때만 보인다.
// 처음 한 번 "__probe__"로 불러 보고 결과를 기억한다(1.7 네이티브는 아무것도 안 하고 끝내고, 예전 빌드는 메서드가 없어 거절)
let widgetStylesSupport: Promise<boolean> | null = null;
let lastWidgetStyles = "";
let lastWidgetStylesValue: WidgetStyle[] | null = null;

export function supportsBookmarkWidget(): Promise<boolean> {
  if (!isNativeBridgeAvailable()) return Promise.resolve(false);
  if (!widgetStylesSupport) {
    widgetStylesSupport = Native.saveWidgetStyles({ json: "__probe__" })
      .then(() => true)
      .catch(() => false);
  }
  return widgetStylesSupport;
}

// 저장한 꾸미기를 위젯에 넘긴다(같은 내용이면 건너뜀). 무료면 부르는 쪽이 effectiveWidgetStyles로 줄여 넘긴다
export async function pushWidgetStyles(styles: WidgetStyle[]): Promise<void> {
  lastWidgetStylesValue = styles;
  if (!(await supportsBookmarkWidget())) return;
  const json = JSON.stringify({ v: 1, styles });
  if (json === lastWidgetStyles) return;
  lastWidgetStyles = json;
  try {
    await Native.saveWidgetStyles({ json });
  } catch (err) {
    lastWidgetStyles = "";
    console.error("[팩인백] 위젯 꾸미기 저장 실패:", err);
  }
}
