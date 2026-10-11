// 잠금화면 실시간 현황 원격 갱신 · 위젯 조용한 푸시(2026-10-11, B-4 · B-5).
// - 실시간 현황: 가방이 바뀌면 그 가방 팩을 잠금화면에 띄운 기기(deviceTokens.apnsLive.bagId)에 새 화면을 바로 보낸다.
//   content-state는 앱의 PackActivityAttributes.ContentState(ios/App/Shared/PIBActivity.swift)와 같은 모양이어야 한다
//   혼자 쓰는 가방도 보낸다(웹 · PC에서 고친 것이 잠금화면에 보이게)
// - 조용한 푸시: 함께 쓰는 가방이 바뀌면 pushSilent/{bagId}에 표시만 해 두고, 2분마다(flushSilent) 멤버 기기에 한 번씩 보낸다.
//   앱이 깨어나 서버 요약을 받아 위젯을 새로 그린다(AppDelegate didReceiveRemoteNotification). iOS가 횟수를 줄일 수 있다
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendApns } from "./apns";
import { DEVICE_TOKENS, devicesOf, sendToDevices } from "./devices";

export const PUSH_SILENT = "pushSilent";
// 앱 요약(lib/nativeSummary.ts)과 같은 제한, 잠금화면 줄 수는 PIBLiveActivity.maxItems와 같게
const MAX_ITEMS = 80;
const MAX_TEXT = 80;
const MAX_LIVE_ITEMS = 5;

interface RawItem {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  checked?: unknown;
}

interface RawBag {
  name?: unknown;
  memberIds?: unknown;
  packs?: { id?: unknown; name?: unknown; kind?: unknown; type?: unknown; items?: RawItem[] }[];
}

interface LiveState {
  bagName: string;
  packName: string;
  items: { id: string; text: string; checked: boolean }[];
  done: number;
  total: number;
  syncedAt: number;
}

const clip = (s: unknown) => (typeof s === "string" ? s : "").slice(0, MAX_TEXT);

export function liveState(bag: RawBag, packId: string): LiveState | null {
  const pack = (Array.isArray(bag.packs) ? bag.packs : []).find((p) => p && p.id === packId && p.kind !== "editor" && p.type !== "folder");
  if (!pack) return null;
  const items = (Array.isArray(pack.items) ? pack.items : [])
    .filter((i) => i && i.type !== "text" && typeof i.id === "string")
    .slice(0, MAX_ITEMS)
    .map((i) => ({ id: String(i.id), text: clip(i.text), checked: !!i.checked }));
  const ordered = [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)];
  return {
    bagName: clip(bag.name) || "가방",
    packName: clip(pack.name) || "팩",
    items: ordered.slice(0, MAX_LIVE_ITEMS),
    done: items.filter((i) => i.checked).length,
    total: items.length,
    syncedAt: Date.now() / 1000,
  };
}

// 가방이 바뀌었을 때(혹은 지워졌을 때 bag = null) 그 가방을 띄운 잠금화면을 고친다
export async function updateLiveActivities(p8: string, bagId: string, bag: RawBag | null): Promise<number> {
  const db = getFirestore();
  const snap = await db.collection(DEVICE_TOKENS).where("apnsLive.bagId", "==", bagId).get();
  let sent = 0;
  for (const doc of snap.docs) {
    const live = doc.data().apnsLive as { token?: string; packId?: string; env?: string } | undefined;
    if (!live?.token || !live.packId) continue;
    const now = Math.floor(Date.now() / 1000);
    const state = bag ? liveState(bag, live.packId) : null;
    const finished = !state || state.total === 0 || state.done === state.total;
    const contentState: LiveState = state ?? { bagName: "가방", packName: "", items: [], done: 0, total: 0, syncedAt: now };
    const aps: Record<string, unknown> = { timestamp: now, event: finished ? "end" : "update", "content-state": contentState };
    // 다 챙기면 5분 뒤 내려간다(앱과 같음). 팩이 사라졌으면 바로
    if (finished) aps["dismissal-date"] = state && state.total > 0 ? now + 5 * 60 : now;
    const result = await sendApns(p8, { token: live.token, env: live.env === "sandbox" ? "sandbox" : "production" }, {
      pushType: "liveactivity",
      payload: { aps },
    });
    if (result.ok) sent += 1;
    else console.warn("[push] 실시간 현황 실패", { device: doc.id.slice(0, 8), status: result.status, reason: result.reason });
    if (finished || result.dead) await doc.ref.update({ apnsLive: FieldValue.delete() }).catch(() => {});
  }
  return sent;
}

// ---- 조용한 푸시(위젯 갱신) ----------------------------------------------------------

export async function markSilent(bagId: string) {
  await getFirestore().collection(PUSH_SILENT).doc(bagId).set({ bagId, at: Date.now() });
}

export async function flushSilent(p8: string): Promise<number> {
  const db = getFirestore();
  const marks = await db.collection(PUSH_SILENT).limit(100).get();
  let sent = 0;
  for (const mark of marks.docs) {
    await mark.ref.delete();
    const bagSnap = await db.collection("bags").doc(mark.id).get();
    const members = (bagSnap.data()?.memberIds as string[] | undefined) ?? [];
    if (!bagSnap.exists || members.length === 0) continue;
    const devices = await devicesOf(members);
    if (devices.length === 0) continue;
    const result = await sendToDevices(p8, devices, {
      pushType: "background",
      payload: { aps: { "content-available": 1 }, kind: "refresh", bagId: mark.id },
      expiresInSec: 30 * 60,
    });
    sent += result.sent;
  }
  return sent;
}
