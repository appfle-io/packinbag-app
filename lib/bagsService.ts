import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { Bag, BagMemberProfile } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { PremiumLimitError } from "@/lib/premiumLimits";

function bagsCol() {
  return collection(db, "bags");
}

// 초대코드 생성은 이제 서버(app/api/create-bag)에서 하지만, 다른 곳(초대코드 재발급 등)에서도
// 같은 형식이 필요해서 그대로 남겨둔다.
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bag)));
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
  const res = await fetch("/api/create-bag", {
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
  return data.bag as Bag;
}

export async function saveBagRemote(bag: Bag) {
  await setDoc(
    doc(bagsCol(), bag.id),
    stripUndefined({ ...bag, updatedAt: new Date().toISOString() })
  );
}

// 가방 하나를 실시간 구독 (다른 멤버의 변경을 편집 화면에서 바로 반영하기 위함).
// 목록 구독(subscribeToUserBags)과 별개로, 지금 열어본 가방 하나만 가볍게 구독한다.
export function subscribeToBag(
  bagId: string,
  callback: (bag: Bag | null) => void
) {
  return onSnapshot(doc(bagsCol(), bagId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Bag) : null);
  });
}

// 실시간 구독 없이 한 번만 조회 (회원탈퇴 등 일괄 처리용)
export async function getUserBagsOnce(uid: string): Promise<Bag[]> {
  const q = query(bagsCol(), where("memberIds", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bag));
}

// 가방 자체와 초대코드 매핑까지 함께 삭제 (이미지는 호출하는 쪽에서 별도 삭제)
export async function deleteBagWithInviteCodeRemote(bag: Bag) {
  if (bag.inviteCode) {
    try {
      await deleteDoc(doc(db, "inviteCodes", bag.inviteCode));
    } catch {
      // 이미 없거나 권한 문제면 무시 (가방 삭제 자체는 계속 진행)
    }
  }
  await deleteDoc(doc(bagsCol(), bag.id));
}

export async function deleteBagRemote(bagId: string) {
  await deleteDoc(doc(bagsCol(), bagId));
}

// 완전삭제 대신 휴지통으로 보낸다(소유자 전용). 이미지/문서는 그대로 두고 trashedByOwnerAt만
// 채운다 - 30일 뒤 자동 영구삭제되거나, 그 전에 복구/영구삭제할 수 있다.
// firestore.rules에서 소유자만 이 필드를 null->값으로 바꿀 수 있게 막아둔다(다른 그룹원은
// 이 필드와 무관하게 가방을 그대로 볼 수 있다).
export async function trashBagRemote(bagId: string) {
  await updateDoc(doc(bagsCol(), bagId), { trashedByOwnerAt: new Date().toISOString() });
}

// 휴지통에서 복구. 무료 동시 진행 개수 제한(FREE_MAX_ACTIVE_BAGS)을 서버에서 다시 검증해야
// 하고(firestore.rules가 클라이언트의 직접 복구를 막아둔다) app/api/restore-bag를 거친다.
export async function restoreBagRemote(user: User, bagId: string) {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/restore-bag", {
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

// 가방 초대코드로 참여하기 (최대 10명)
// 주의: 참여 전에는 아직 멤버가 아니라서 bags/{bagId} 문서를 직접 읽을 수 없다
// (firestore.rules상 read는 멤버만 허용). 그래서 여기서는 가방을 미리 조회해
// "인원이 가득 찼는지"등을 클라이언트에서 먼저 확인하지 않고, 곧바로 updateDoc을
// 시도한 뒤 규칙 위반(가득 참/존재하지 않음 등)을 catch에서 안내 문구로 변환한다.
export async function joinBagByCode(
  uid: string,
  rawCode: string,
  joinerProfile: { nickname: string; avatarId: string }
) {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error("초대 코드를 입력해주세요.");

  const codeDoc = await getDoc(doc(db, "inviteCodes", code));
  if (!codeDoc.exists()) throw new Error("해당 코드의 가방을 찾을 수 없어요.");
  const bagId = codeDoc.data().bagId as string;

  const profileEntry: BagMemberProfile = {
    nickname: joinerProfile.nickname,
    avatarId: joinerProfile.avatarId,
    joinedAt: new Date().toISOString(),
  };

  try {
    // 이미 멤버인 경우 arrayUnion은 아무 변화 없이 성공하고(멱등), memberProfiles의
    // joinedAt만 갱신된다 - 별도 사전 체크 없이도 안전하게 재시도 가능.
    await updateDoc(doc(bagsCol(), bagId), {
      memberIds: arrayUnion(uid),
      [`memberProfiles.${uid}`]: profileEntry,
    });
  } catch {
    throw new Error("참여할 수 없어요. 가방이 삭제되었거나 인원이 가득 찼을 수 있어요.");
  }
  return bagId;
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

// 기존 초대코드를 무효화하고 새 코드를 발급 (기존 코드로는 더 이상 참여 불가)
export async function regenerateInviteCodeRemote(bag: Bag): Promise<string> {
  const newCode = generateInviteCode();
  await setDoc(doc(db, "inviteCodes", newCode), { bagId: bag.id });
  await updateDoc(doc(bagsCol(), bag.id), { inviteCode: newCode });
  if (bag.inviteCode) {
    try {
      await deleteDoc(doc(db, "inviteCodes", bag.inviteCode));
    } catch {
      // 이미 없으면 무시
    }
  }
  return newCode;
}
