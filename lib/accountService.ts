import { doc, deleteDoc, setDoc } from "firebase/firestore";
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
import { getApiUrl } from "@/lib/apiBase";
import { deleteAllWidgetPhotos } from "@/lib/v2/widgetStyles";

// 함께 쓰는 가방을 넘겨받을 사람: 가장 먼저 들어온 다른 멤버
function nextOwner(bag: Bag, uid: string): string | null {
  const others = bag.memberIds.filter((m) => m !== uid);
  if (others.length === 0) return null;
  const joined = (m: string) => bag.memberProfiles?.[m]?.joinedAt ?? "9999";
  return [...others].sort((a, b) => joined(a).localeCompare(joined(b)))[0];
}

// 탈퇴 · 게스트 모드 끝내기의 마지막 단계: 앱이 못 지우는 것(짧은 URL · 공유 스냅샷 · 알림 · 기기 토큰 · 문의 · 사용 기록)과
// 로그인 계정을 서버가 지운다(app/api/delete-account-data, 2026-10-15). 성공하면 true(계정까지 사라짐)
export async function deleteAccountServerSide(): Promise<boolean> {
  const me = auth.currentUser;
  if (!me) return false;
  try {
    const idToken = await me.getIdToken();
    const res = await fetch(getApiUrl("/api/delete-account-data"), {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.ok;
  } catch (err) {
    console.error("[팩인백] 서버 탈퇴 정리 실패:", err);
    return false;
  }
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
  // 탈퇴한 계정 표시(deletedAccounts/{uid}). 예전 댓글 작성자 익명화에 쓰던 마커로, 댓글 기능이 빠진 지금도
  // 탈퇴 기록으로 남긴다. firestore.rules에서 수정·삭제를 막아둔다.
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
    // 휴지통에 넣어 둔 함께 쓰는 가방은 모두에게서 완전히 지운다(2026-10-15, auth.md 확인 필요 4).
    // 예전에는 나가기만 해서 그룹장(탈퇴한 계정)이 없는 가방이 남아 30일 자동 삭제 · 되살리기 · 멤버 관리가 영영 안 됐다
    if (bag.ownerId === uid && bag.trashedByOwnerAt) {
      await deleteUnusedFiles(bagFileUrls(bag), urlsInUse(sharedBags.filter((b) => b.id !== bag.id), []));
      await deleteBagWithInviteCodeRemote(bag);
      continue;
    }
    if (bag.ownerId === uid && me) {
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

  // 북마크 위젯 배경 사진(2026-10-18)
  await deleteAllWidgetPhotos(uid);

  await deleteDoc(doc(db, "users", uid));
}
