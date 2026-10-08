import {
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { isPendingBag, savePendingBag } from "@/lib/v2/pendingCreates";
import { Bag } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { serializeBag, deserializeBag } from "@/lib/editorDocSerialize";
import { mergeBag, mergeEditorDocs } from "@/lib/syncMerge";
import { NOTES_VERSION, parseNoteData, rawOf, splitBagForSave, type NoteWrite } from "@/lib/bagNotesCore";
import { deleteAllBagNotes, noteRef } from "@/lib/bagNotesService";
import { PremiumLimitError, isOfflineEnvironment } from "@/lib/premiumLimits";
import { getApiUrl } from "@/lib/apiBase";
import {
  getLocalBags,
  saveLocalBag,
  deleteLocalBag,
  restoreLocalBag,
  permanentDeleteLocalBag,
} from "@/lib/localBagsService";

function bagsCol() {
  return collection(db, "bags");
}

// 초대코드 생성은 app/api/create-bag과 app/api/regenerate-invite-code(Admin SDK) 양쪽에서
// 각자 자체 로직으로 처리한다 - 이 파일에서는 더 이상 필요 없다.

// 로그인한 사람이 속한(memberIds에 자기 uid가 있는) 가방만 실시간 구독
export function subscribeToUserBags(
  uid: string,
  callback: (bags: Bag[]) => void
) {
  const q = query(
    bagsCol(),
    where("memberIds", "array-contains", uid),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => deserializeBag({ id: d.id, ...d.data() } as Bag)));
  });
}

// 가방 생성은 무료 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)을 서버에서 검증해야 해서
// 클라이언트가 직접 Firestore에 쓰지 않고 app/api/create-bag(Admin SDK)을 호출한다.
// firestore.rules에서도 bags의 client-side create를 막아둬서, 이 경로 말고는 생성이
// 안 되게 되어 있다 - devtools로 검사 로직을 건너뛰어도 서버가 다시 막는다.
export async function createBagRemote(
  user: User,
  bag: Bag,
  ownerProfile: { nickname: string; avatarId: string }
): Promise<Bag> {
  const idToken = await user.getIdToken();
  const res = await fetch(getApiUrl("/api/create-bag"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ bag, ownerProfile }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data?.error as string | undefined) ?? "가방 생성에 실패했어요";
    if (data?.code === "BAG_LIMIT_REACHED") {
      throw new PremiumLimitError(message);
    }
    throw new Error(message);
  }
  return deserializeBag(data.bag as Bag);
}

// 메모 본문 문서(bags/{bagId}/notes/{packId})에 쓸 내용
function noteData(raw: string) {
  return {
    doc: raw,
    rev: increment(1),
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.uid ?? null,
  };
}

/**
 * 가방 저장(혼자 쓰는 가방, 또는 공유 가방 트랜잭션이 실패했을 때).
 * 메모 본문은 떼어서 notes에 쓰고(바뀐 것만), 가방 문서에는 요약만 쓴다(lib/bagNotesCore splitBagForSave).
 * known: 열린 가방이 구독으로 받은 현재 본문(packId → raw). 없으면 본문이 붙어 있는 메모는 모두 쓰고 지우지는 않는다.
 * 돌려주는 값: 이번에 쓴 본문(packId → raw) - 호출한 쪽이 known을 갱신해 같은 본문을 다시 쓰지 않게.
 */
export async function saveBagRemote(bag: Bag, known: Map<string, string> | null = null): Promise<Map<string, string>> {
  const written = new Map<string, string>();
  // 끊겨 있을 때 만든 "만들기 대기" 가방은 서버에 아직 문서가 없다 → 이 기기 대기 목록에 저장(lib/v2/pendingCreates)
  const uid = auth.currentUser?.uid;
  if (isPendingBag(uid, bag.id)) {
    savePendingBag(uid!, bag);
    return written;
  }
  if (isOfflineEnvironment()) {
    saveLocalBag(bag);
    return written;
  }
  const { stripped, noteWrites, noteDeletes } = splitBagForSave(bag, known);
  const serialized = serializeBag(stripped) as unknown as Record<string, unknown>;
  const batch = writeBatch(db);
  batch.update(doc(bagsCol(), bag.id), {
    ...bagContentPatch(serialized),
    notesV: NOTES_VERSION,
    // 규칙: 메모를 분리한 가방(notesV 2)에서 packs를 바꾸려면 packsRev가 정확히 1 올라야 한다(옛 앱 차단)
    packsRev: increment(1),
  });
  noteWrites.forEach((w: NoteWrite) => {
    batch.set(noteRef(bag.id, w.packId), noteData(w.raw), { merge: true });
    written.set(w.packId, w.raw);
  });
  noteDeletes.forEach((id) => batch.delete(noteRef(bag.id, id)));
  await batch.commit();
  return written;
}

// 가방 문서에서 서버·멤버십이 관리하는 필드. 자동저장(saveBagRemote)은 이 필드를 쓰지 않는다.
// 예전에는 setDoc으로 문서를 통째 덮어써서, 혼자 쓰던 가방에 누가 들어온 직후 화면의 옛 memberIds(나 혼자)로
// 덮어써 방금 들어온 사람을 내보내거나, 휴지통·잠김이 바뀐 직후 저장이 규칙에 거부됐다(2026-10-07).
const BAG_MANAGED_KEYS = new Set([
  "id",
  "memberIds",
  "memberProfiles",
  "ownerId",
  "inviteCode",
  "publicShareToken",
  "locked",
  "trashedByOwnerAt",
  "createdAt",
  "notesV",
  "packsRev",
]);
// 화면에서 지울 수 있는 선택 필드. 값이 없으면 서버에서도 지운다(setDoc 통째 쓰기와 같은 결과)
const BAG_OPTIONAL_KEYS = [
  "notice",
  "travelDate",
  "reminderOffsets",
  "ddayCountTodayAsDayOne",
  "aiRecommendCache",
  "publicShareEnabled",
  "autoMoveDoneItems",
  "lastPackedAt",
  "lastPackedBy",
  "lastCheckedAt",
];
function bagContentPatch(serialized: Record<string, unknown>): Record<string, unknown> {
  const clean = stripUndefined(serialized) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clean)) {
    if (!BAG_MANAGED_KEYS.has(k)) patch[k] = v;
  }
  for (const k of BAG_OPTIONAL_KEYS) {
    if (!(k in patch)) patch[k] = deleteField();
  }
  patch.updatedAt = new Date().toISOString();
  return patch;
}

// 함께 쓰는 가방 저장(v2). 화면에 들고 있던 가방을 통째로 덮어쓰지 않고, 트랜잭션으로 서버 최신 버전을
// 읽어 base 대비 내가 바꾼 것만 얹는다(lib/syncMerge). 저장 1번당 읽기 1번이 더 든다 - 그래서 멤버가 2명 이상인
// 가방에만 쓴다(혼자 쓰는 가방은 이미 구독 중인 스냅샷으로 화면에서 병합하고 saveBagRemote로 바로 쓴다).
// - 그 사이 가방이 지워졌으면 다시 만들지 않는다.
// - 오프라인(비행기 모드 등)이라 트랜잭션이 실패하면 예전처럼 통째 저장으로 대신한다(로컬 캐시에 바로 반영, 온라인 복귀 시 전송).
export async function saveSharedBagMergedRemote(
  local: Bag,
  base: Bag,
  known: Map<string, string> | null = null,
): Promise<Map<string, string>> {
  const written = new Map<string, string>();
  if (isOfflineEnvironment()) {
    saveLocalBag(local);
    return written;
  }
  const ref = doc(bagsCol(), local.id);
  // 내가 본문을 고친 메모(화면 본문이 기준점과 다름). 이 메모는 서버 최신 본문과 문단 단위로 합친다
  const basePacks = new Map(base.packs.map((p) => [p.id, p]));
  const changedIds = local.packs
    .filter((p) => p.kind === "editor" && p.editorDoc !== undefined && rawOf(p.editorDoc) !== rawOf(basePacks.get(p.id)?.editorDoc))
    .map((p) => p.id);
  try {
    await runTransaction(db, async (tx) => {
      // 트랜잭션은 읽기를 모두 끝낸 뒤에 쓴다
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const noteSnaps = new Map<string, DocumentSnapshot>();
      for (const id of changedIds) noteSnaps.set(id, await tx.get(noteRef(local.id, id)));

      const server = deserializeBag({ id: snap.id, ...snap.data() } as Bag);
      const merged = mergeBag(base, local, server);
      const serverPacks = new Map(server.packs.map((p) => [p.id, p]));
      merged.packs = merged.packs.map((p) => {
        if (!changedIds.includes(p.id)) return p;
        const ns = noteSnaps.get(p.id);
        const serverDoc = ns?.exists() ? parseNoteData(ns.data()).doc : serverPacks.get(p.id)?.editorDoc;
        const localDoc = local.packs.find((x) => x.id === p.id)?.editorDoc;
        return { ...p, editorDoc: mergeEditorDocs(basePacks.get(p.id)?.editorDoc, localDoc, serverDoc) };
      });

      // 본문 분리. 본문이 붙어 있는 메모(내가 고친 것, 아직 이전 안 된 것)만 notes에 쓴다
      const { stripped, noteWrites } = splitBagForSave(merged, null);
      const mergedIds = new Set(merged.packs.map((p) => p.id));
      const deletes = known ? [...known.keys()].filter((id) => !mergedIds.has(id)) : [];

      tx.set(
        ref,
        stripUndefined({
          ...serializeBag(stripped),
          updatedAt: new Date().toISOString(),
          notesV: NOTES_VERSION,
          packsRev: (server.packsRev ?? 0) + 1,
        }),
      );
      noteWrites.forEach((w) => {
        tx.set(noteRef(local.id, w.packId), noteData(w.raw), { merge: true });
        written.set(w.packId, w.raw);
      });
      deletes.forEach((id) => tx.delete(noteRef(local.id, id)));
    });
    return written;
  } catch (err) {
    if ((err as { code?: string })?.code === "permission-denied") throw err;
    console.warn("[팩인백] 병합 저장 트랜잭션 실패, 통째 저장으로 대신:", err);
    return saveBagRemote(local, known);
  }
}

// 가방에서 팩 여러 개를 빼낸다(보관함 팩을 지울 때 "가방 속 사본도 같이 지우기"). 가방은 여러 명이 동시에 고칠 수
// 있어서, 화면에 들고 있던 가방을 통째로 저장하지 않고 runTransaction으로 방금 읽은 최신 packs에서 대상만 뺀다.
export async function removePacksFromBagRemote(bagId: string, packIds: string[]) {
  const ids = new Set(packIds);
  if (ids.size === 0) return;
  if (isOfflineEnvironment()) {
    const bag = getLocalBags().find((b) => b.id === bagId);
    if (!bag) return;
    saveLocalBag({ ...bag, packs: bag.packs.filter((p) => !ids.has(p.id)) });
    return;
  }
  const ref = doc(bagsCol(), bagId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Bag;
    const packs = (data.packs ?? []).filter((p) => !ids.has(p.id));
    if (packs.length === (data.packs ?? []).length) return;
    tx.update(ref, { packs: stripUndefined(packs), updatedAt: new Date().toISOString(), packsRev: (data.packsRev ?? 0) + 1 });
    // 빠진 메모의 본문 문서도 지운다(없으면 아무 일 없음)
    (data.packs ?? [])
      .filter((p) => ids.has(p.id) && p.kind === "editor")
      .forEach((p) => tx.delete(noteRef(bagId, p.id)));
  });
}

// 가방 속 팩을 다른 가방으로 통채 이동(모바일 "다른 가방으로 이동" 버튼 전용 -
// 데스크톱은 DesktopSidebar.tsx의 드래그앤드롭으로 이미 동일한 일을 한다). 두 가방 문서를
// 한 번에 읽고 쓰는 runTransaction으로 처리해서, 그 사이에 다른 멤버가 어느 쪽이든 가방을
// 동시 편집해도 안전하다. 대상 가방이 이미 10개를 다 채우면 이동을 거부한다.
export async function movePackBetweenBagsRemote(
  fromBagId: string,
  toBagId: string,
  packId: string
): Promise<{ ok: true } | { ok: false; reason: "not-found" | "target-full" }> {
  if (isOfflineEnvironment()) {
    const list = getLocalBags();
    const fromBag = list.find((b) => b.id === fromBagId);
    const toBag = list.find((b) => b.id === toBagId);
    if (!fromBag || !toBag) return { ok: false, reason: "not-found" as const };
    const movingPack = fromBag.packs.find((p) => p.id === packId);
    if (!movingPack) return { ok: false, reason: "not-found" as const };
    if (toBag.packs.length >= 10) return { ok: false, reason: "target-full" as const };
    fromBag.packs = fromBag.packs.filter((p) => p.id !== packId);
    toBag.packs = [...toBag.packs, movingPack];
    saveLocalBag(fromBag);
    saveLocalBag(toBag);
    return { ok: true as const };
  }
  const fromRef = doc(bagsCol(), fromBagId);
  const toRef = doc(bagsCol(), toBagId);
  const fromNote = noteRef(fromBagId, packId);
  const toNote = noteRef(toBagId, packId);
  return await runTransaction(db, async (tx) => {
    const [fromSnap, toSnap, noteSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef), tx.get(fromNote)]);
    if (!fromSnap.exists() || !toSnap.exists()) {
      return { ok: false, reason: "not-found" as const };
    }
    const fromData = fromSnap.data() as Bag;
    const toData = toSnap.data() as Bag;
    const movingPack = fromData.packs.find((p) => p.id === packId);
    if (!movingPack) {
      return { ok: false, reason: "not-found" as const };
    }
    if (toData.packs.length >= 10) {
      return { ok: false, reason: "target-full" as const };
    }
    const now = new Date().toISOString();
    tx.update(fromRef, {
      packs: stripUndefined(fromData.packs.filter((p) => p.id !== packId)),
      updatedAt: now,
      packsRev: (fromData.packsRev ?? 0) + 1,
    });
    tx.update(toRef, {
      packs: stripUndefined([...toData.packs, movingPack]),
      updatedAt: now,
      packsRev: (toData.packsRev ?? 0) + 1,
      ...(noteSnap.exists() ? { notesV: NOTES_VERSION } : {}),
    });
    // 메모 본문 문서도 같이 옮긴다
    if (noteSnap.exists()) {
      tx.set(toNote, noteSnap.data());
      tx.delete(fromNote);
    }
    return { ok: true as const };
  });
}

// 실시간 구독 없이 한 번만 조회 (회원탈퇴 등 일괄 처리용)
export async function getUserBagsOnce(uid: string): Promise<Bag[]> {
  const q = query(bagsCol(), where("memberIds", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => deserializeBag({ id: d.id, ...d.data() } as Bag));
}

// 가방 자체와 초대코드 매핑까지 함께 삭제 (이미지는 호출하는 쪽에서 별도 삭제)
export async function deleteBagWithInviteCodeRemote(bag: Bag) {
  if (isOfflineEnvironment()) {
    permanentDeleteLocalBag(bag.id);
    return;
  }
  if (bag.inviteCode) {
    try {
      await deleteDoc(doc(db, "inviteCodes", bag.inviteCode));
    } catch {
      // 이미 없거나 권한 문제면 무시 (가방 삭제 자체는 계속 진행)
    }
  }
  // 메모 본문 문서를 먼저 지운다(가방 문서가 없으면 규칙의 멤버 확인이 안 돼 못 지운다)
  await deleteAllBagNotes(bag.id).catch(() => {});
  await deleteDoc(doc(bagsCol(), bag.id));
}

// 완전삭제 대신 휴지통으로 보낸다(소유자 전용). 이미지/문서는 그대로 두고 trashedByOwnerAt만
// 채운다 - 30일 뒤 자동 영구삭제되거나, 그 전에 복구/영구삭제할 수 있다.
// firestore.rules에서 소유자만 이 필드를 null->값으로 바꿀 수 있게 막아둔다(다른 그룹원은
// 이 필드와 무관하게 가방을 그대로 볼 수 있다).
export async function trashBagRemote(bagId: string) {
  if (isOfflineEnvironment()) {
    deleteLocalBag(bagId);
    return;
  }
  await updateDoc(doc(bagsCol(), bagId), { trashedByOwnerAt: new Date().toISOString() });
}

// 휴지통에서 복구. 무료 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)을 서버에서 다시 검증해야
// 하고(firestore.rules가 클라이언트의 직접 복구를 막아둔다) app/api/restore-bag를 거친다.
export async function restoreBagRemote(user: User, bagId: string) {
  if (isOfflineEnvironment()) {
    restoreLocalBag(bagId);
    return;
  }
  const idToken = await user.getIdToken();
  const res = await fetch(getApiUrl("/api/restore-bag"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ bagId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data?.error as string | undefined) ?? "가방을 복구하지 못했어요";
    if (data?.code === "BAG_LIMIT_REACHED") {
      throw new PremiumLimitError(message);
    }
    throw new Error(message);
  }
}

// 가방 초대코드로 참여하기 (서버 검증 API 라우트 경유)
// 무료 사용자의 초대 참여 슬롯(최대 3개) 및 가방 정원(최대 10명)을 서버에서 안전하게 검증한다.
export async function joinBagByCode(
  user: User,
  rawCode: string,
  joinerProfile: { nickname: string; avatarId: string }
): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error("초대 코드를 입력해주세요.");

  const idToken = await user.getIdToken();
  const res = await fetch(getApiUrl("/api/join-bag"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      inviteCode: code,
      joinerProfile,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data?.error as string | undefined) ?? "가방에 참여하지 못했어요";
    if (data?.code === "JOIN_LIMIT_REACHED") {
      throw new PremiumLimitError(message);
    }
    throw new Error(message);
  }

  return (data?.bagId as string) || "";
}

export async function fetchBagRemote(bagId: string): Promise<Bag | null> {
  try {
    const snap = await getDoc(doc(bagsCol(), bagId));
    if (!snap.exists()) return null;
    return deserializeBag({ id: snap.id, ...snap.data() } as Bag);
  } catch {
    return null;
  }
}

export async function leaveBagRemote(uid: string, bagId: string) {
  await updateDoc(doc(bagsCol(), bagId), {
    memberIds: arrayRemove(uid),
    [`memberProfiles.${uid}`]: deleteField(),
  });
}

// 소유자가 다른 멤버를 가방에서 내보내기
export async function removeMemberRemote(bagId: string, memberUid: string) {
  await updateDoc(doc(bagsCol(), bagId), {
    memberIds: arrayRemove(memberUid),
    [`memberProfiles.${memberUid}`]: deleteField(),
  });
}

// 프로필(닉네임/아바타)을 수정했거나, 예전에 참여한 뒤 한 번도 갱신 안 된 경우를 대비해
// 특정 가방 하나의 내 memberProfiles 스냅샷만 최신 값으로 고쳐쓴다. memberProfiles는 참여
// 시점에 한 번 찍어두는 스냅샷이라, 갱신해주지 않으면 초대코드/그룹원 목록 화면에 예전
// 닉네임·아바타가 계속 남아있게 된다.
// 매 프로필 수정마다 가입된 모든 가방을 쿼리해서 한꺼번에 덮어쓰는 대신, 이미 화면에 실시간
// 구독 중인 가방 목록(bags state)을 기준으로 실제로 값이 달라진 가방에만 호출하는 방식을
// 쓴다 (AppShell의 자동 점검 로직 참고) - 추가 쿼리 없이 가볍게 처리 가능.
export async function updateMemberProfileSnapshot(
  bagId: string,
  uid: string,
  profile: { nickname: string; avatarId: string }
) {
  await updateDoc(doc(bagsCol(), bagId), {
    [`memberProfiles.${uid}.nickname`]: profile.nickname,
    [`memberProfiles.${uid}.avatarId`]: profile.avatarId,
  });
}

// 초대코드 재발급은 이제 app/api/regenerate-invite-code(Admin SDK)만 한다. firestore.rules의
// inviteCodes는 `allow update, delete: if false`라서 클라이언트가 이전 코드 문서를
// 직접 지울 수가 없기 때문이다(예전에 클라이언트 deleteDoc을 시도하던 버전은 항상
// permission-denied로 조용히 실패해서, 재발급해도 이전 코드로 계속 참여가 되는 버그가
// 있었다).
export async function regenerateInviteCodeRemote(user: User, bag: Bag): Promise<string> {
  const idToken = await user.getIdToken();
  const res = await fetch(getApiUrl("/api/regenerate-invite-code"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ bagId: bag.id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "초대코드 재발급에 실패했어요");
  }
  return data.inviteCode as string;
}

// 그룹장(소유자) 위임. ownerId를 바꾸는 건 firestore.rules로 안전하게 클라이언트에 열어주기
// 까다로워서(누가 "지금 소유자"인지, 대상이 진짜 멤버인지 등 검증이 필요) 반드시
// app/api/transfer-bag-ownership(Admin SDK)을 거친다.
export async function transferBagOwnershipRemote(
  user: User,
  bagId: string,
  targetUid: string
): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch(getApiUrl("/api/transfer-bag-ownership"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ bagId, targetUid }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "그룹장 위임에 실패했어요");
  }
}

