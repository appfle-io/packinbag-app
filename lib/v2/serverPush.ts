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
import type { Bag, BagPushKind, UserProfile } from "@/lib/types";
import { isNativeBridgeAvailable } from "@/lib/v2/nativeBridge";
import { ensureNotificationPermission, getNotificationPermission } from "@/lib/v2/bagReminders";
import { notificationSettingsPath } from "@/lib/v2/platform";

export type PushKind = BagPushKind;

export const PUSH_KINDS: { kind: PushKind; label: string; description: string }[] = [
  { kind: "activity", label: "함께 쓰는 가방 소식", description: "다른 사람이 추가하거나 챙기면 10분마다 모아서" },
  { kind: "assign", label: "나에게 맡긴 아이템", description: "다른 사람이 아이템을 맡기면 바로" },
  { kind: "member", label: "새 멤버 참여", description: "내가 만든 가방에 누가 들어오면" },
];

// ---- 가방 하나의 소식 설정(가방 더보기 > 알림, 2026-10-11) -------------------------------------
// "이 가방 소식 받기"(pushMutedBagIds) + 종류별(bagPushOff[bagId]). 설정 > 알림에서 끈 종류(pushPrefs)는 여기서는 못 켠다.
// 새 멤버 참여는 그룹장에게만 가므로 내가 만든 가방에서만 보인다
const BAG_PUSH_TEXT: Record<PushKind, { label: string; description: string }> = {
  activity: { label: "추가 · 체크 · 다 쌌어요", description: "다른 사람이 바꾸면 10분마다 모아서" },
  assign: { label: "나에게 맡긴 아이템", description: "누가 아이템을 맡기면 바로" },
  member: { label: "새 멤버 참여", description: "내가 만든 가방에 누가 들어오면" },
};

interface BagPushKindView {
  kind: PushKind;
  label: string;
  description: string;
  on: boolean;
  // 설정 > 알림에서 끈 종류(여기서는 못 켬)
  locked: boolean;
}

export interface BagPushView {
  // "이 가방 소식 받기"가 켜진 것으로 보일지(모두 끄기 아님 + 켜진 종류가 하나 이상)
  master: boolean;
  muted: boolean;
  kinds: BagPushKindView[];
  onCount: number;
  usable: number;
  off: PushKind[];
}

export function bagPushView(profile: UserProfile | null | undefined, bag: Bag, uid: string | undefined): BagPushView {
  const muted = (profile?.pushMutedBagIds ?? []).includes(bag.id);
  const off = profile?.bagPushOff?.[bag.id] ?? [];
  const kinds = (Object.keys(BAG_PUSH_TEXT) as PushKind[])
    .filter((kind) => kind !== "member" || (!!uid && bag.ownerId === uid))
    .map((kind) => {
      const locked = profile?.pushPrefs?.[kind] === false;
      return { kind, ...BAG_PUSH_TEXT[kind], locked, on: !locked && !off.includes(kind) };
    });
  const onCount = kinds.filter((k) => k.on).length;
  const usable = kinds.filter((k) => !k.locked).length;
  return { master: !muted && onCount > 0, muted, kinds, onCount, usable, off };
}

// 더보기 "알림" 줄 오른쪽에 붙는 소식 부분. 꺼져 있으면 null
export function bagPushSummary(view: BagPushView): string | null {
  if (!view.master) return null;
  return view.onCount === view.usable ? "소식" : "소식 일부";
}

// 이 가방에서 서버 푸시 설정을 보여 줄지(함께 쓰는 가방 · 계정 모드 · iOS 1.5 앱)
export function showsBagPush(bag: Bag, isOfflineMode: boolean): boolean {
  return !isOfflineMode && bag.memberIds.length > 1 && isServerPushAvailable();
}

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
      return `알림이 꺼져 있어 함께 쓰는 사람 소식을 받지 않아요. ${notificationSettingsPath()}에서 켤 수 있어요`;
    }
  } catch {
    // localStorage를 못 쓰면 묻지 않는다
  }
  return null;
}

// 테스트 알림(5초 뒤 이 계정 기기로). sent = 애플에 보냈는지, message = 화면에 띄울 문구.
// 서버는 5초 기다렸다 보낸 뒤에 응답한다 - 응답이 왔을 때는 알림이 이미 도착해 있다(앱을 보는 중이면 배너 없이 사라짐).
// 그래서 "홈으로 나가라"는 안내는 부르는 쪽이 누르는 즉시 띄운다(2026-10-17)
export async function sendTestPush(): Promise<{ sent: boolean; message: string }> {
  const state = await getNotificationPermission();
  if (state !== "granted" && !(await askNotificationPermission())) {
    return { sent: false, message: `${notificationSettingsPath()}에서 알림을 허용해 주세요` };
  }
  const call = httpsCallable<unknown, { devices: number; sent: number; reason?: string; reasons?: string[] }>(
    getFunctions(firebaseApp, "asia-northeast3"),
    "sendTestPush",
    { timeout: 30_000 },
  );
  const { data } = await call({});
  if (data.reason === "no-device") return { sent: false, message: "이 기기가 아직 등록되지 않았어요. 앱을 껐다 켠 뒤 다시 해 주세요" };
  if (data.reason === "no-permission") return { sent: false, message: "알림 권한이 아직 서버에 반영되지 않았어요. 잠시 뒤 다시 해 주세요" };
  if (data.sent > 0) return { sent: true, message: "알림을 보냈어요" };
  return { sent: false, message: `알림을 보내지 못했어요 (${(data.reasons ?? []).join(", ") || "알 수 없음"})` };
}
