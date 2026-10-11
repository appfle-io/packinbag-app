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
  // 가방 전체(packId "*")일 때 아이템 id → 원래 팩 id(앱 ContentState.itemPacks와 같은 이름)
  itemPacks?: Record<string, string>;
}

const clip = (s: unknown) => (typeof s === "string" ? s : "").slice(0, MAX_TEXT);
export const WHOLE_BAG = "*";

type Lite = { id: string; text: string; checked: boolean };

function checkItems(items: RawItem[] | undefined): Lite[] {
  return (Array.isArray(items) ? items : [])
    .filter((i) => i && i.type !== "text" && typeof i.id === "string")
    .slice(0, MAX_ITEMS)
    .map((i) => ({ id: String(i.id), text: clip(i.text), checked: !!i.checked }));
}

export function liveState(bag: RawBag, packId: string): LiveState | null {
  const packs = (Array.isArray(bag.packs) ? bag.packs : []).filter((p) => p && p.kind !== "editor" && p.type !== "folder");
  if (packId === WHOLE_BAG) {
    // 가방 전체(10/11): 앱 요약과 같은 순서(미분류 먼저)로 잇는다. 제목 = 가방 이름, 옆 글 = "가방 전체"
    const ordered = [...packs].sort(
      (a, b) => Number(!!(b as { isInbox?: unknown }).isInbox) - Number(!!(a as { isInbox?: unknown }).isInbox),
    );
    const owner = new Map<string, string>();
    const items: Lite[] = [];
    for (const p of ordered) {
      for (const i of checkItems(p.items)) {
        if (owner.has(i.id)) continue;
        owner.set(i.id, String(p.id));
        items.push(i);
      }
    }
    if (items.length === 0) return null;
    const shown = [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)].slice(0, MAX_LIVE_ITEMS);
    return {
      bagName: "가방 전체",
      packName: clip(bag.name) || "가방",
      items: shown,
      done: items.filter((i) => i.checked).length,
      total: items.length,
      syncedAt: Date.now() / 1000,
      itemPacks: Object.fromEntries(shown.map((i) => [i.id, owner.get(i.id) ?? ""])),
    };
  }
  const pack = packs.find((p) => p.id === packId);
  if (!pack) return null;
  const items = checkItems(pack.items);
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
    // 팩이 사라졌거나 가방이 지워졌을 때만 내린다. 다 챙겨도 내리지 않고 doneAt만 적는다(10/11 - 끝낸 화면은
    // 다시 풀 수 없어서). 5분 뒤 내리는 건 앱(PIBLiveActivity.updateAll)이 한다
    const gone = !state || state.total === 0;
    const allDone = !!state && state.total > 0 && state.done === state.total;
    const contentState: LiveState & { doneAt?: number } = state
      ? { ...state, ...(allDone ? { doneAt: now } : {}) }
      : { bagName: "가방", packName: "", items: [], done: 0, total: 0, syncedAt: now };
    const aps: Record<string, unknown> = { timestamp: now, event: gone ? "end" : "update", "content-state": contentState };
    if (gone) aps["dismissal-date"] = now;
    const result = await sendApns(p8, { token: live.token, env: live.env === "sandbox" ? "sandbox" : "production" }, {
      pushType: "liveactivity",
      payload: { aps },
    });
    if (result.ok) sent += 1;
    else console.warn("[push] 실시간 현황 실패", { device: doc.id.slice(0, 8), status: result.status, reason: result.reason });
    if (gone || result.dead) await doc.ref.update({ apnsLive: FieldValue.delete() }).catch(() => {});
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
