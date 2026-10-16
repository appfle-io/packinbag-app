// 공유 가방 알림(2026-10-11, B-3). bags/{bagId} 변경을 보고 다른 멤버에게 알린다.
// - 활동(추가 · 체크 · 다 쌌어요): pushQueue/{bagId}에 모았다가 한 번에. 묶음의 첫 활동 10분 뒤 Cloud Tasks 작업이 보낸다(tasks.ts).
//   다 싼 순간은 바로. 모을 때는 읽지 않고 merge로만 쓴다(2026-10-17 - 예전에는 저장마다 트랜잭션 읽기 1)
// - 담당 지정: 바로. 맡은 사람에게만
// - 새 멤버: 바로. 그룹장에게만
// - 내가 바꾼 것은 나에게 보내지 않는다. 누가 바꿨는지는 가방 문서의 editedBy(앱 · 위젯 저장이 자기 uid를 씀)
// - 받는 사람 설정: users/{uid}.pushPrefs { activity, assign, member }(없으면 켜짐) · pushMutedBagIds(가방별 모두 끄기)
//   · bagPushOff[bagId](가방별로 끈 종류, 10/11)
// - 보이는 알림은 알림 권한이 있는 기기에만(devices.ts)
// 체크 해제 · 삭제 · 이름 바꾸기 · 메모 수정은 알리지 않는다.
import { getFirestore, FieldValue, type DocumentData } from "firebase-admin/firestore";
import { devicesOf, sendToDevices } from "./devices";
import { enqueueBagTask } from "./tasks";

export const PUSH_QUEUE = "pushQueue";
export const BATCH_MS = 10 * 60 * 1000;

interface ItemLite {
  id: string;
  type?: string;
  text?: string;
  checked?: boolean;
  assigneeUid?: string;
}

interface BagLite {
  name?: string;
  memberIds?: string[];
  ownerId?: string;
  editedBy?: string;
  trashedByOwnerAt?: string | null;
  memberProfiles?: Record<string, { nickname?: string }>;
  packs?: { id?: string; kind?: string; type?: string; items?: ItemLite[] }[];
}

// ---- 변경 비교 ------------------------------------------------------------------

function checklistItems(bag: BagLite): ItemLite[] {
  return (bag.packs ?? [])
    .filter((p) => p && p.kind !== "editor" && p.type !== "folder")
    .flatMap((p) => (Array.isArray(p.items) ? p.items : []))
    .filter((i): i is ItemLite => !!i && typeof i.id === "string");
}

export function progressOf(bag: BagLite): { done: number; total: number } {
  const checks = checklistItems(bag).filter((i) => i.type !== "text");
  return { done: checks.filter((i) => i.checked).length, total: checks.length };
}

const isPacked = (bag: BagLite) => {
  const p = progressOf(bag);
  return p.total > 0 && p.done === p.total;
};

export interface BagDiff {
  checked: number;
  added: string[];
  packed: boolean;
  // 맡은 사람 uid → 맡긴 아이템 이름
  assigned: Map<string, string[]>;
  newMembers: string[];
}

export function diffBag(before: BagLite, after: BagLite, actor: string | undefined): BagDiff {
  const prev = new Map(checklistItems(before).map((i) => [i.id, i]));
  const added: string[] = [];
  const assigned = new Map<string, string[]>();
  let checked = 0;
  const members = new Set(after.memberIds ?? []);
  for (const item of checklistItems(after)) {
    const old = prev.get(item.id);
    if (!old) {
      added.push((item.text ?? "").trim());
    } else if (item.type !== "text" && item.checked && !old.checked) {
      checked += 1;
    }
    const to = item.assigneeUid;
    if (to && to !== old?.assigneeUid && to !== actor && members.has(to)) {
      assigned.set(to, [...(assigned.get(to) ?? []), (item.text ?? "").trim()]);
    }
  }
  const beforeMembers = new Set(before.memberIds ?? []);
  return {
    checked,
    added: added.filter(Boolean),
    packed: !isPacked(before) && isPacked(after),
    assigned,
    newMembers: (after.memberIds ?? []).filter((uid) => !beforeMembers.has(uid)),
  };
}

// ---- 받는 사람 설정 -------------------------------------------------------------

type PrefKind = "activity" | "assign" | "member";

// 받는 사람 + 그 사람이 이 가방을 개인 잠금했는지(2026-10-16, native-ios.md 확인 필요 1).
// 잠금은 users/{uid}.privateLock(앱 lib/v2/privateLock.ts) - PIN이 있고 bags에 이 가방이 있을 때만.
// 잠근 사람에게는 제목을 "잠근 가방"으로, 본문에서 아이템 이름을 빼고 보낸다(잠금화면에 내용이 보이지 않게)
export interface PushTarget {
  uid: string;
  locked: boolean;
}

export const LOCKED_TITLE = "잠근 가방";

export async function wantsPush(uids: string[], bagId: string, kind: PrefKind): Promise<PushTarget[]> {
  if (uids.length === 0) return [];
  const db = getFirestore();
  const snaps = await db.getAll(...uids.map((uid) => db.collection("users").doc(uid)));
  return snaps
    .filter((s) => {
      if (!s.exists) return false;
      const d = s.data() as {
        pushPrefs?: Partial<Record<PrefKind, boolean>>;
        pushMutedBagIds?: string[];
        bagPushOff?: Record<string, PrefKind[]>;
      };
      if (d.pushPrefs?.[kind] === false) return false;
      const off = d.bagPushOff?.[bagId];
      if (Array.isArray(off) && off.includes(kind)) return false;
      return !(Array.isArray(d.pushMutedBagIds) && d.pushMutedBagIds.includes(bagId));
    })
    .map((s) => {
      const lock = (s.data() as { privateLock?: { pinHash?: string; bags?: string[] } }).privateLock;
      return { uid: s.id, locked: !!lock?.pinHash && Array.isArray(lock.bags) && lock.bags.includes(bagId) };
    });
}

// ---- 문구 -----------------------------------------------------------------------

export const nick = (bag: BagLite, uid: string) => (bag.memberProfiles?.[uid]?.nickname || "멤버").trim();

export function namesLine(names: string[], unit = "개"): string {
  const shown = names.slice(0, 2).map((n) => (n.length > 14 ? `${n.slice(0, 14)}…` : n));
  return names.length > 2 ? `${shown.join(", ")} 외 ${names.length - 2}${unit}` : shown.join(", ");
}

function alert(bagId: string, title: string, body: string, kind: string) {
  return {
    pushType: "alert" as const,
    payload: { aps: { alert: { title, body }, sound: "default", "thread-id": `bag-${bagId}` }, kind, bagId },
    expiresInSec: 6 * 3600,
  };
}

// ---- 바로 보내는 알림(담당 · 새 멤버) ---------------------------------------------

export async function sendImmediate(p8: string, bagId: string, after: BagLite, diff: BagDiff, actor: string | undefined) {
  const title = after.name || "가방";
  if (actor && diff.assigned.size > 0) {
    const targets = await wantsPush([...diff.assigned.keys()], bagId, "assign");
    console.log("[push] 담당 지정", { bagId, assignees: [...diff.assigned.keys()].map((u) => u.slice(0, 6)), wants: targets.length });
    for (const { uid, locked } of targets) {
      const names = diff.assigned.get(uid) ?? [];
      const devices = await devicesOf([uid]);
      if (devices.length === 0) {
        console.log("[push] 담당 지정: 기기 없음", uid.slice(0, 6));
        continue;
      }
      const body = locked
        ? `${nick(after, actor)}님이 ${names.length}개를 맡겼어요`
        : `${nick(after, actor)}님이 ${names.length}개를 맡겼어요: ${namesLine(names)}`;
      const result = await sendToDevices(p8, devices, { ...alert(bagId, locked ? LOCKED_TITLE : title, body, "assign"), collapseId: `assign-${bagId}` });
      console.log("[push] 담당 지정 보냄", { to: uid.slice(0, 6), devices: devices.length, alerts: devices.filter((d) => d.alerts).length, ...result });
    }
  }
  const owner = after.ownerId;
  const joined = diff.newMembers.filter((uid) => uid !== owner);
  if (owner && joined.length > 0) {
    const [target] = await wantsPush([owner], bagId, "member");
    if (target) {
      const devices = await devicesOf([owner]);
      const who = joined.length === 1 ? `${nick(after, joined[0])}님이` : `${nick(after, joined[0])}님 외 ${joined.length - 1}명이`;
      const body = `${who} 가방에 참여했어요 (${(after.memberIds ?? []).length}명)`;
      if (devices.length > 0) await sendToDevices(p8, devices, alert(bagId, target.locked ? LOCKED_TITLE : title, body, "member"));
    }
  }
}

// ---- 활동 모으기 ------------------------------------------------------------------

interface QueueActor {
  checked: number;
  added: number;
  names: string[];
}

// 읽지 않고 쌓는다(increment · arrayUnion). 보낼 작업은 10분 칸마다 하나(같은 칸의 두 번째부터는 이미 있음 → 무시)
export async function enqueueActivity(bagId: string, actor: string, diff: BagDiff) {
  if (diff.checked === 0 && diff.added.length === 0 && !diff.packed) return;
  const now = Date.now();
  const mine: Record<string, unknown> = {};
  if (diff.checked > 0) mine.checked = FieldValue.increment(diff.checked);
  if (diff.added.length > 0) {
    mine.added = FieldValue.increment(diff.added.length);
    mine.names = FieldValue.arrayUnion(...diff.added.slice(0, 5));
  }
  await getFirestore()
    .collection(PUSH_QUEUE)
    .doc(bagId)
    .set({ bagId, actors: { [actor]: mine }, ...(diff.packed ? { packedBy: actor } : {}), updatedAt: now }, { merge: true });
  // 다 싼 순간은 기다리지 않는다. 그 밖에는 이 10분 칸의 첫 활동 10분 뒤
  if (diff.packed) await enqueueBagTask({ kind: "activity", bagId }, `p${now}`, 0);
  else await enqueueBagTask({ kind: "activity", bagId }, `w${Math.floor(now / BATCH_MS)}`, BATCH_MS / 1000);
}

// 활동 묶음 하나를 받는 사람별 문구로 만든다(그 사람 자신의 활동은 빼고). 보낼 게 없으면 null
export function activityBody(
  bag: BagLite,
  recipient: string,
  actors: Record<string, QueueActor>,
  packedBy: string | undefined,
  hideNames = false,
): string | null {
  const others = Object.entries(actors).filter(([uid]) => uid !== recipient);
  const { done, total } = progressOf(bag);
  const progress = total > 0 ? ` (${done}/${total})` : "";
  if (packedBy && packedBy !== recipient && total > 0 && done === total) {
    return `다 쌌어요! ${nick(bag, packedBy)}님이 마지막 아이템을 챙겼어요${progress}`;
  }
  if (others.length === 0) return null;
  const checked = others.reduce((n, [, a]) => n + a.checked, 0);
  const added = others.reduce((n, [, a]) => n + a.added, 0);
  if (checked === 0 && added === 0) return null;
  const [lead] = [...others].sort((a, b) => b[1].checked + b[1].added - (a[1].checked + a[1].added));
  const who = others.length === 1 ? `${nick(bag, lead[0])}님이` : `${nick(bag, lead[0])}님 외 ${others.length - 1}명이`;
  if (checked > 0 && added > 0) return `${who} ${checked}개 챙기고 ${added}개 추가했어요${progress}`;
  if (checked > 0) return `${who} ${checked}개 챙겼어요${progress}`;
  const names = others.flatMap(([, a]) => a.names);
  return !hideNames && names.length > 0 && names.length === added
    ? `${who} ${added}개 추가했어요: ${namesLine(names)}`
    : `${who} ${added}개 추가했어요`;
}

// 가방 하나의 활동 묶음을 보낸다(Cloud Tasks 작업 · 1시간 안전망). 문서를 먼저 지우고(트랜잭션) 보내서 두 번 보내지 않는다.
// 다 싼 순간 작업이 먼저 보냈으면 나중 10분 작업은 빈 문서를 보고 끝난다(읽기 1). 보냈으면 true
export async function flushActivity(p8: string, bagId: string): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection(PUSH_QUEUE).doc(bagId);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as DocumentData;
  });
  if (!claimed) return false;
  const bagSnap = await db.collection("bags").doc(bagId).get();
  if (!bagSnap.exists) return false;
  const bag = bagSnap.data() as BagLite;
  const members = bag.memberIds ?? [];
  if (members.length < 2 || bag.trashedByOwnerAt) return false;
  // increment · arrayUnion으로 쌓여 빈 칸이 있을 수 있다. 예전 모양(숫자 · 배열)도 그대로 읽힌다
  const rawActors = (claimed.actors ?? {}) as Record<string, Partial<QueueActor>>;
  const actors: Record<string, QueueActor> = Object.fromEntries(
    Object.entries(rawActors).map(([uid, a]) => [
      uid,
      { checked: Number(a?.checked ?? 0), added: Number(a?.added ?? 0), names: (Array.isArray(a?.names) ? a!.names : []).slice(0, 5) },
    ]),
  );
  const packedBy = typeof claimed.packedBy === "string" ? claimed.packedBy : undefined;
  const recipients = await wantsPush(members, bagId, "activity");
  if (recipients.length === 0) return true;
  const devices = await devicesOf(recipients.map((r) => r.uid));
  const title = bag.name || "가방";
  for (const { uid, locked } of recipients) {
    const body = activityBody(bag, uid, actors, packedBy, locked);
    const mine = devices.filter((d) => d.uid === uid);
    if (!body || mine.length === 0) continue;
    await sendToDevices(p8, mine, { ...alert(bagId, locked ? LOCKED_TITLE : title, body, "activity"), collapseId: `activity-${bagId}` });
  }
  return true;
}

// 안전망(1시간마다): 예약이 실패해 20분 넘게 남은 묶음만 보낸다. 빈 조회도 읽기 1건이라 하루 24건
export async function sweepActivity(p8: string): Promise<number> {
  const db = getFirestore();
  const stale = await db.collection(PUSH_QUEUE).where("updatedAt", "<=", Date.now() - 20 * 60 * 1000).limit(50).get();
  let sent = 0;
  for (const doc of stale.docs) {
    if (await flushActivity(p8, doc.id).catch(() => false)) sent += 1;
  }
  return sent;
}
