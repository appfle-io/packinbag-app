import { doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  getUserBagsOnce,
  leaveBagRemote,
  deleteBagWithInviteCodeRemote,
  transferBagOwnershipRemote,
} from "@/lib/bagsService";
import { getLibraryPacksOnce, deleteLibraryPackRemote } from "@/lib/packsService";
import { bagFileUrls, deleteUnusedFiles, packFileUrls, urlsInUse } from "@/lib/storageCleanup";
import type { Bag } from "@/lib/types";

// 함께 쓰는 가방을 넘겨받을 사람: 가장 먼저 들어온 다른 멤버
function nextOwner(bag: Bag, uid: string): string | null {
  const others = bag.memberIds.filter((m) => m !== uid);
  if (others.length === 0) return null;
  const joined = (m: string) => bag.memberProfiles?.[m]?.joinedAt ?? "9999";
  return [...others].sort((a, b) => joined(a).localeCompare(joined(b)))[0];
}

// 회원탈퇴 시 Firestore/Storage에 남아있는 이 사용자의 데이터를 정리한다.
// - 나만 있는 가방(memberIds가 1명, 곧 나 자신)은 첨부(가방 사진·메모 첨부)까지 포함해서 완전히 삭제
// - 다른 사람과 함께 쓰는 가방은 나만 빠져나오기 (다른 멤버는 계속 사용 가능).
//   내가 만든 가방이면 먼저 가장 오래된 멤버에게 그룹장을 넘긴다 - 안 그러면 ownerId가 탈퇴한 계정으로 남아
//   남은 멤버가 휴지통·초대코드 재발급·멤버 관리를 못 한다(2026-10-07)
// - 팩 보관함(개인 전용 공간)은 전부 삭제. 첨부는 남는 공유 가방이 쓰는 것만 빼고 지운다(lib/storageCleanup.ts)
// - users/{uid} 프로필 문서 삭제
// Firebase Auth 계정 자체 삭제는 이 함수를 호출한 쪽(AuthProvider)에서 이어서 처리한다.
export async function deleteAllUserData(uid: string) {
  // 다른 그룹원이 옛 댓글 작성자를 "그룹만 나갔다/강퇴됐다"와 "진짜로 회원탈퇴했다"를
  // 구별할 수 있게, 계정이 아직 살아있는(=본인 인증 상태) 지금 가벼운 마커를 남겨둔다.
  // 단순히 그룹을 나가거나 강퇴된 것만으로는 계정이 여전히 존재하므로 익명화하면 안 되고,
  // 이 마커가 있어야만(=실제로 계정을 삭제) 익명화 대상이 된다. 이후 어떤 경로로도
  // 수정/삭제가 안 되게 firestore.rules에서 막아둔다(deletedAccounts/{uid} 참고).
  await setDoc(doc(db, "deletedAccounts", uid), { deletedAt: new Date().toISOString() });

  const bags = await getUserBagsOnce(uid);
  const packs = await getLibraryPacksOnce(uid);
  const soloBags = bags.filter((b) => b.memberIds.length <= 1);
  const sharedBags = bags.filter((b) => b.memberIds.length > 1);
  // 남는 공유 가방이 쓰는 파일은 지우지 않는다
  const keep = urlsInUse(sharedBags, []);

  for (const bag of soloBags) {
    await deleteUnusedFiles(bagFileUrls(bag), keep);
    await deleteBagWithInviteCodeRemote(bag);
  }

  const me = auth.currentUser;
  for (const bag of sharedBags) {
    // 휴지통에 넣어 둔 가방은 넘기지 않는다: 넘기면 새 그룹장 휴지통에 뜨고 30일 뒤 모두에게서 지워진다
    if (bag.ownerId === uid && me && !bag.trashedByOwnerAt) {
      const target = nextOwner(bag, uid);
      if (target) {
        try {
          await transferBagOwnershipRemote(me, bag.id, target);
        } catch (err) {
          // 넘기기에 실패해도 탈퇴는 계속한다(가방은 멤버들이 그대로 쓸 수 있다)
          console.error("[팩인백] 탈퇴 전 그룹장 넘기기 실패:", err);
        }
      }
    }
    await leaveBagRemote(uid, bag.id);
  }

  await deleteUnusedFiles(packs.flatMap(packFileUrls), keep);
  await Promise.all(packs.map((p) => deleteLibraryPackRemote(uid, p.id)));

  await deleteDoc(doc(db, "users", uid));
}

// 댓글 작성자 표시용 - 이 uid들 중 실제로 회원탈퇴(계정 완전 삭제)한 사람이 누구인지
// 확인한다(deletedAccounts 컬렉션 참고). 단순히 그룹을 나간(나가기/강퇴) 사람은 건드리지
// 않는다 - 그룹은 나갔더라도 계정이 여전히 있으면 익명화하면 안 된다. 이미 결과가 결정된
// uid는 다시 조회하지 않도록 호출하는 쪽(BagEditorScreen)에서 캐시를 잡아둔다.
export async function fetchDeletedAccountIds(uids: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(uids));
  if (unique.length === 0) return new Set();
  const results = await Promise.all(
    unique.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "deletedAccounts", uid));
        return snap.exists() ? uid : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(results.filter((v): v is string => v !== null));
}
