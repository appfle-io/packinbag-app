// 햅틱(진동 피드백). iOS 네이티브 앱에서만 동작하고 웹·PC에서는 아무 일도 하지 않는다.
//
// @capacitor/haptics 패키지를 직접 import하지 않고 이미 설치된 @capacitor/core의 registerPlugin으로 부른다 -
// 그래서 웹 빌드는 이 패키지 없이도 통과하고, 네이티브 쪽에 플러그인이 아직 없으면 호출이 조용히 실패한다.
// 실제로 진동이 나오게 하려면(앱 바이너리 변경이라 앱스토어 재심사 필요):
//   npm i @capacitor/haptics && npx cap sync ios  ->  Xcode에서 다시 Archive
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
