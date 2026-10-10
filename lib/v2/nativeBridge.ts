// 웹(앱 화면) ↔ iOS 네이티브(위젯 · 단축어 · 실시간 현황) 다리(2026-10-10, 1.5 빌드부터).
//
// 네이티브 쪽은 ios/App/App/AppDelegate.swift의 PackInBagNativePlugin("PackInBagNative").
// - 로그인 상태면 기기 토큰(/api/native/device-token)을 받아 네이티브에 넘긴다 → App Group에 저장 → 위젯·단축어가 서버를 부를 때 사용
// - 가방이 바뀌면 요약(lib/nativeSummary.ts)을 넘긴다 → App Group에 저장하고 위젯 · 실시간 현황을 바로 새로 그린다
// - 로그아웃 · 오프라인 모드면 지운다(네이티브가 서버에서 토큰도 지운다)
// 플러그인이 없는 웹 · PC · 스토어 1.3 앱에서는 아무것도 하지 않는다.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { User } from "firebase/auth";
import type { Bag } from "@/lib/types";
import { buildNativeSummary } from "@/lib/nativeSummary";
import { getApiUrl } from "@/lib/apiBase";

interface PackInBagNativePlugin {
  getSession(): Promise<{ uid?: string; hasToken: boolean }>;
  setSession(options: { uid: string; token: string; apiBase: string }): Promise<void>;
  clearSession(): Promise<void>;
  saveSummary(options: { json: string }): Promise<void>;
  startLiveActivity(options: LiveActivityOptions): Promise<{ id: string }>;
  endLiveActivity(): Promise<void>;
  liveActivityState(): Promise<LiveActivityState>;
}

export type LiveActivityTheme = "system" | "light" | "dark";
export type LiveActivityFont = "system" | "pretendard" | "gmarket" | "gaegu" | "d2coding";
export type LiveActivitySize = "small" | "medium" | "large";
export type LiveActivityOpacity = "p100" | "p80" | "p60" | "p40";

export interface LiveActivityOptions {
  bagId: string;
  packId: string;
  theme: LiveActivityTheme;
  font: LiveActivityFont;
  size: LiveActivitySize;
  opacity: LiveActivityOpacity;
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
      return;
    }
    const current = await Native.getSession();
    if (current.hasToken && current.uid === user.uid) return;
    const idToken = await user.getIdToken();
    const res = await fetch(getApiUrl("/api/native/device-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ platform: "ios" }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string };
    if (!res.ok || !data.token) throw new Error(`device-token ${res.status}`);
    await Native.setSession({ uid: user.uid, token: data.token, apiBase: window.location.origin });
  };
  const prev = sessionTask ?? Promise.resolve();
  sessionTask = prev.then(run).catch((err) => console.error("[팩인백] 위젯 연결 실패:", err));
  return sessionTask;
}

let lastSummary = "";
let lastBags: Bag[] = [];
let lastUid = "";

// 가방 요약을 네이티브에 넘긴다(같은 내용이면 건너뜀). 위젯 · 실시간 현황이 바로 새로 그려진다
export function pushNativeSummary(bags: Bag[], uid: string): Promise<void> {
  if (!isNativeBridgeAvailable()) return Promise.resolve();
  lastBags = bags;
  lastUid = uid;
  const summary = buildNativeSummary(bags, uid);
  const json = JSON.stringify(summary.bags);
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
