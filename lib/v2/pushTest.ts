// 서버 푸시 테스트(2026-10-11, 1.5 빌드부터). 설정 > 정보 > "테스트 알림 보내기"
// Cloud Functions sendTestPush(functions/src/index.ts)가 5초 뒤 이 계정의 기기에 알림을 보낸다.
// 앱을 보는 중에는 배너가 안 뜨므로(capacitor.config PushNotifications.presentationOptions: []) 홈 화면으로 나가서 확인한다.
// 알림 권한은 로컬 알림과 같은 것이라 LocalNotifications로 묻는다. B-3(설정 > 알림)이 생기면 그쪽으로 옮긴다.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";
import { isNativeBridgeAvailable } from "@/lib/v2/nativeBridge";

type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";
interface LocalNotificationsPermissions {
  checkPermissions(): Promise<{ display: Permission }>;
  requestPermissions(): Promise<{ display: Permission }>;
}
const LocalNotifications = registerPlugin<LocalNotificationsPermissions>("LocalNotifications");

export function isPushTestAvailable(): boolean {
  return isNativeBridgeAvailable() && Capacitor.isPluginAvailable("PushNotifications") && Capacitor.isPluginAvailable("LocalNotifications");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 화면에 띄울 문구를 돌려준다
export async function sendTestPush(): Promise<string> {
  let { display } = await LocalNotifications.checkPermissions();
  if (display === "prompt" || display === "prompt-with-rationale") {
    display = (await LocalNotifications.requestPermissions()).display;
    // 허용 직후 네이티브가 바뀐 권한을 서버에 올릴 시간(앱으로 돌아올 때 PIBPush.upload)
    if (display === "granted") await sleep(1500);
  }
  if (display !== "granted") return "설정 앱 > 팩인백 > 알림에서 알림을 허용해 주세요";
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
