import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getUserBagsOnce,
  leaveBagRemote,
  deleteBagWithInviteCodeRemote,
} from "@/lib/bagsService";
import { getLibraryPacksOnce, deleteLibraryPackRemote } from "@/lib/packsService";
import { deleteBagImage } from "@/lib/storageService";

// 회원탈퇴 시 Firestore/Storage에 남아있는 이 사용자의 데이터를 정리한다.
// - 나만 있는 가방(memberIds가 1명, 곧 나 자신)은 이미지까지 포함해서 완전히 삭제
// - 다른 사람과 함께 쓰는 가방은 나만 빠져나오기 (다른 멤버는 계속 사용 가능)
// - 팩 보관함(개인 전용 공간)은 전부 삭제
// - users/{uid} 프로필 문서 삭제
// Firebase Auth 계정 자체 삭제는 이 함수를 호출한 쪽(AuthProvider)에서 이어서 처리한다.
export async function deleteAllUserData(uid: string) {
  const bags = await getUserBagsOnce(uid);

  for (const bag of bags) {
    if (bag.memberIds.length <= 1) {
      await Promise.all(bag.images.map((url) => deleteBagImage(url)));
      await deleteBagWithInviteCodeRemote(bag);
    } else {
      await leaveBagRemote(uid, bag.id);
    }
  }

  const packs = await getLibraryPacksOnce(uid);
  await Promise.all(packs.map((p) => deleteLibraryPackRemote(uid, p.id)));

  await deleteDoc(doc(db, "users", uid));
}
