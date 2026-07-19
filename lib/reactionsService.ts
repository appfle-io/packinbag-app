import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BagReactionDoc, ReactionEmoji, ReactionTargetType } from "@/lib/types";

function reactionsCol(bagId: string) {
  return collection(db, "bags", bagId, "reactions");
}

function reactionDocId(targetType: ReactionTargetType, targetId: string) {
  return `${targetType}_${targetId}`;
}

// 가방 하나의 리액션 문서 전체를 실시간 구독한다(대상당 문서 1개, 소그룹이라 총량이
// 크지 않아 presence/comments와 동일하게 통째로 구독한다). 화면에서는
// targetType_targetId 키로 필요한 것만 찾아 쓴다.
export function subscribeToReactions(
  bagId: string,
  callback: (items: BagReactionDoc[]) => void
) {
  return onSnapshot(
    reactionsCol(bagId),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BagReactionDoc)));
    },
    () => {
      callback([]);
    }
  );
}

// 리액션 토글: 이미 눌렀으면 빼고, 안 눌렀으면 더한다. 문서가 없으면 새로 만든다.
export async function toggleReaction(
  bagId: string,
  targetType: ReactionTargetType,
  targetId: string,
  uid: string,
  emoji: ReactionEmoji,
  currentlyReacted: boolean
) {
  const ref = doc(reactionsCol(bagId), reactionDocId(targetType, targetId));
  await setDoc(
    ref,
    {
      targetType,
      targetId,
      reactions: {
        [emoji]: currentlyReacted ? arrayRemove(uid) : arrayUnion(uid),
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
