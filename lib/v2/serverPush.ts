// 서버 푸시(2026-10-11, iOS 1.5 앱부터). 보내는 쪽은 Cloud Functions(functions/src/bagEvents.ts),
// 기기 등록은 네이티브(AppDelegate PIBPush). 여기에는 웹 화면에서 쓰는 것만 있다.
// - 설정 > 알림(종류별 켜기 · 알림 권한 · 테스트 알림), 가방 더보기 > 알림(이 가방 끄기)
// - 공유 가방을 처음 열 때 iOS 알림 허용 창을 한 번 띄운다(서비스 알림이라 앱 안 기본값은 켜짐, iOS 창이 옵트인).
//   이미 거절돼 있으면 한 번만 토스트로 알린다
// 알림 권한은 로컬 알림과 같은 것이라 lib/v2/bagReminders의 LocalNotifications 도우미를 쓴다.
// 웹 · PC · 스토어 1.3 앱에서는 아무것도 하지 않는다(isServerPushAvailable).
import { Capacitor } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";
import { isNativeBridgeAvailable } from "@/lib/v2/nativeBridge";
import { ensureNotificationPermission, getNotificationPermission } from "@/lib/v2/bagReminders";

export type PushKind = "activity" | "assign" | "member";

export const PUSH_KINDS: { kind: PushKind; label: string; description: string }[] = [
  { kind: "activity", label: "함께 쓰는 가방 소식", description: "다른 사람이 추가하거나 챙기면 10분마다 모아서" },
  { kind: "assign", label: "나에게 맡긴 아이템", description: "다른 사람이 아이템을 맡기면 바로" },
  { kind: "member", label: "새 멤버 참여", description: "내가 만든 가방에 누가 들어오면" },
];

export function isServerPushAvailable(): boolean {
  return isNativeBridgeAvailable() && Capacitor.isPluginAvailable("PushNotifications") && Capacitor.isPluginAvailable("LocalNotifications");
}

export { getNotificationPermission };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 알림 허용 창. 허용하면 네이티브가 앱으로 돌아올 때 권한을 서버에 올린다(PIBPush.upload)
export async function askNotificationPermission(): Promise<boolean> {
  const ok = await ensureNotificationPermission();
  if (ok) await sleep(1500);
  return ok;
}

const ASKED_KEY = "pib_push_asked_v1";
const DENIED_TOLD_KEY = "pib_push_denied_told_v1";

// 공유 가방을 열 때 부른다. 처음이면 허용 창, 거절돼 있으면 한 번만 안내 문구를 돌려준다(토스트용)
export async function promptForSharedBag(): Promise<string | null> {
  if (!isServerPushAvailable()) return null;
  const state = await getNotificationPermission();
  try {
    if ((state === "prompt" || state === "prompt-with-rationale") && !localStorage.getItem(ASKED_KEY)) {
      localStorage.setItem(ASKED_KEY, "1");
      const ok = await askNotificationPermission();
      return ok ? null : "알림을 허용하지 않아 함께 쓰는 사람 소식을 받지 않아요. 설정 > 알림에서 바꿀 수 있어요";
    }
    if (state === "denied" && !localStorage.getItem(DENIED_TOLD_KEY)) {
      localStorage.setItem(DENIED_TOLD_KEY, "1");
      return "알림이 꺼져 있어 함께 쓰는 사람 소식을 받지 않아요. 아이폰 설정 > 팩인백 > 알림에서 켤 수 있어요";
    }
  } catch {
    // localStorage를 못 쓰면 묻지 않는다
  }
  return null;
}

// 테스트 알림(5초 뒤 이 계정 기기로). 화면에 띄울 문구를 돌려준다
export async function sendTestPush(): Promise<string> {
  const state = await getNotificationPermission();
  if (state !== "granted" && !(await askNotificationPermission())) {
    return "아이폰 설정 > 팩인백 > 알림에서 알림을 허용해 주세요";
  }
  const call = httpsCallable<unknown, { devices: number; sent: number; reason?: string; reasons?: string[] }>(
    getFunctions(firebaseApp, "asia-northeast3"),
    "sendTestPush",
    { timeout: 30_000 },
  );
  const { data } = await call({});
  if (data.reason === "no-device") return "이 기기가 아직 등록되지 않았어요. 앱을 껐다 켠 뒤 다시 해 주세요";
  if (data.reason === "no-permission") return "알림 권한이 아직 서버에 반영되지 않았어요. 잠시 뒤 다시 해 주세요";
  if (data.sent > 0) return "알림을 보냈어요";
  return `알림을 보내지 못했어요 (${(data.reasons ?? []).join(", ") || "알 수 없음"})`;
}
