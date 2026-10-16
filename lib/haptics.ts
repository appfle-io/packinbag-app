// 햅틱(진동 피드백). iOS 네이티브 앱에서만 동작하고 웹·PC에서는 아무 일도 하지 않는다.
//
// @capacitor/haptics(package.json · capacitor.config.ts includePlugins에 들어 있음, 1.5 빌드부터 iOS 앱에 포함)를 직접 import하지 않고
// @capacitor/core의 registerPlugin으로 부른다 - 웹 빌드에 플러그인 웹 구현을 싣지 않으려고. 플러그인이 없는 옛 앱(스토어 1.3)에서는
// 호출이 조용히 실패한다(2026-10-16 주석 고침, native-ios.md 확인 필요 2).
import { Capacitor, registerPlugin } from "@capacitor/core";

interface HapticsPlugin {
  impact(options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }): Promise<void>;
  notification(options: { type: "SUCCESS" | "WARNING" | "ERROR" }): Promise<void>;
}

const Haptics = registerPlugin<HapticsPlugin>("Haptics");
const enabled = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

// 체크·해제처럼 자주 누르는 동작(가볍게)
export function tapHaptic() {
  if (!enabled()) return;
  Haptics.impact({ style: "LIGHT" }).catch(() => {});
}

// 가방을 다 쌌을 때처럼 한 번씩 축하할 때
export function successHaptic() {
  if (!enabled()) return;
  Haptics.notification({ type: "SUCCESS" }).catch(() => {});
}
