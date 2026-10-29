// 잠금화면 실시간 현황 원격 갱신 · 위젯 조용한 푸시(2026-10-11, B-4 · B-5).
// - 실시간 현황: 가방이 바뀌면 그 가방 팩을 잠금화면에 띄운 기기(deviceTokens.apnsLive.bagId)에 새 화면을 바로 보낸다.
//   content-state는 앱의 PackActivityAttributes.ContentState(ios/App/Shared/PIBActivity.swift)와 같은 모양이어야 한다
//   혼자 쓰는 가방도 보낸다(웹 · PC에서 고친 것이 잠금화면에 보이게)
// - 조용한 푸시: 함께 쓰는 가방이 바뀌면 2분 칸마다 한 번 Cloud Tasks 작업을 예약해(tasks.ts) 멤버 기기에 보낸다.
//   앱이 깨어나 서버 요약을 받아 위젯을 새로 그린다(AppDelegate didReceiveRemoteNotification). iOS가 횟수를 줄일 수 있다
//   (2026-10-17 - 예전에는 pushSilent 문서에 표시하고 2분마다 조회해서, 아무도 안 써도 읽기가 나갔다)
// - 실시간 현황을 띄운 가방에는 서버가 bags/{bagId}.liveOn = true를 적는다(app/api/native/live-token).
//   트리거는 이 표시가 있을 때만 deviceTokens를 조회하고, 띄운 기기가 하나도 없으면 표시를 지운다(2026-10-17 - 예전에는 모든 저장마다 조회 1)
import { getFirestore, FieldValue, type Timestamp } from "firebase-admin/firestore";
import { sendApns } from "./apns";
import { DEVICE_TOKENS, devicesOf, sendToDevices } from "./devices";

export const SILENT_BATCH_MS = 2 * 60 * 1000;
// 앱 요약(lib/nativeSummary.ts)과 같은 제한, 잠금화면 줄 수는 PIBLiveActivity.maxItems와 같게
const MAX_ITEMS = 80;
const MAX_TEXT = 80;
const MAX_LIVE_ITEMS = 5;
// iOS가 실시간 현황을 띄운 지 8시간 뒤 끝낸다. 그 5분 전부터 "멈췄어요"(앱 PIBLiveActivity.staleAfter와 같게, 10/27).
// 원격 갱신에 stale-date가 없으면 앱이 붙여 둔 멈춤 시각이 지워지므로 같이 보낸다
const STALE_AFTER_SEC = 8 * 3600 - 5 * 60;

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

// 가방이 바뀌었을 때(혹은 지워졌을 때 bag = null) 그 가방을 띄운 잠금화면을 고친다.
// 띄운 기기가 하나도 남지 않으면 liveOn 표시를 지운다. bagUpdateTime을 주면 그 뒤로 가방이 바뀌지 않았을 때만(방금 다시 띄운 것을 지우지 않게)
export async function updateLiveActivities(p8: string, bagId: string, bag: RawBag | null, bagUpdateTime?: Timestamp): Promise<number> {
  const db = getFirestore();
  const snap = await db.collection(DEVICE_TOKENS).where("apnsLive.bagId", "==", bagId).get();
  // 지금 멤버가 아닌 기기(나갔거나 내보낸 사람)에는 새 내용을 보내지 않고 내린다(2026-10-12 보안 점검).
  // 예전에는 등록할 때만 멤버를 확인해서, 내보낸 뒤에도 잠금화면으로 아이템 이름이 계속 갔다
  const members: string[] = bag && Array.isArray(bag.memberIds) ? (bag.memberIds as string[]) : [];
  let sent = 0;
  let alive = 0;
  for (const doc of snap.docs) {
    const live = doc.data().apnsLive as { token?: string; packId?: string; env?: string; startedAt?: number } | undefined;
    if (!live?.token || !live.packId) continue;
    const now = Math.floor(Date.now() / 1000);
    const isMember = members.includes(String(doc.data().uid ?? ""));
    const state = bag && isMember ? liveState(bag, live.packId) : null;
    // 팩이 사라졌거나 가방이 지워졌을 때만 내린다. 다 챙겨도 내리지 않고 doneAt만 적는다(10/11 - 끝낸 화면은
    // 다시 풀 수 없어서). 5분 뒤 내리는 건 앱(PIBLiveActivity.updateAll)이 한다
    const gone = !state || state.total === 0;
    const allDone = !!state && state.total > 0 && state.done === state.total;
    const contentState: LiveState & { doneAt?: number } = state
      ? { ...state, ...(allDone ? { doneAt: now } : {}) }
      : { bagName: "가방", packName: "", items: [], done: 0, total: 0, syncedAt: now };
    const aps: Record<string, unknown> = { timestamp: now, event: gone ? "end" : "update", "content-state": contentState };
    if (gone) aps["dismissal-date"] = now;
    else if (typeof live.startedAt === "number") aps["stale-date"] = Math.floor(live.startedAt + STALE_AFTER_SEC);
    const result = await sendApns(p8, { token: live.token, env: live.env === "sandbox" ? "sandbox" : "production" }, {
      pushType: "liveactivity",
      payload: { aps },
    });
    if (result.ok) sent += 1;
    else console.warn("[push] 실시간 현황 실패", { device: doc.id.slice(0, 8), status: result.status, reason: result.reason });
    if (gone || result.dead) await doc.ref.update({ apnsLive: FieldValue.delete() }).catch(() => {});
    else alive += 1;
  }
  if (bag && alive === 0) {
    const ref = db.collection("bags").doc(bagId);
    await (bagUpdateTime ? ref.update({ liveOn: FieldValue.delete() }, { lastUpdateTime: bagUpdateTime }) : ref.update({ liveOn: FieldValue.delete() })).catch(() => {});
  }
  return sent;
}

// ---- 조용한 푸시(위젯 갱신) ----------------------------------------------------------

// Cloud Tasks 작업에서 부른다. 멤버는 예약할 때 값이라 가방은 다시 읽지 않는다(기기 조회만)
export async function sendSilent(p8: string, bagId: string, members: string[]): Promise<number> {
  if (members.length === 0) return 0;
  const devices = await devicesOf(members);
  if (devices.length === 0) return 0;
  const result = await sendToDevices(p8, devices, {
    pushType: "background",
    payload: { aps: { "content-available": 1 }, kind: "refresh", bagId },
    expiresInSec: 30 * 60,
  });
  return result.sent;
}
