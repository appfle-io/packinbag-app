import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BagComment, CommentTargetType } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function commentsCol(bagId: string) {
  return collection(db, "bags", bagId, "comments");
}

// 가방 하나에 달린 댓글 전체를 실시간 구독한다(짐 댓글 + 가방 전체 댓글 다 포함).
// 화면 쪽에서 targetType/targetId로 필터링해서 보여준다 - 가방당 댓글 총량이
// 크지 않을 것으로 보여(소그룹, 최대 10명) 별도 where 쿼리 없이 통째로 구독하는
// 쪽이 복합 인덱스 없이도 간단하다(presenceService와 동일한 접근).
export function subscribeToComments(
  bagId: string,
  callback: (items: BagComment[]) => void
) {
  const q = query(commentsCol(bagId), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BagComment)));
    },
    () => {
      // 가방 접근 권한이 사라진 경우 등 - presenceService와 동일하게 조용히 무시.
      callback([]);
    }
  );
}

export async function createComment(
  bagId: string,
  data: {
    targetType: CommentTargetType;
    targetId: string;
    packId?: string;
    authorUid: string;
    authorNickname: string;
    authorAvatarId: string;
    text: string;
    mentions?: string[];
    // 멘션된 멤버의 닉네임(알림 본문에 "OO님이 언급했어요" 같은 문구를 쓰고 싶을 때 참고용).
    // 없으면 알림 body에 댓글 내용만 들어간다.
    mentionTargetLabel?: string;
  }
): Promise<BagComment> {
  const trimmed = data.text.trim().slice(0, 500);
  if (!trimmed) throw new Error("empty comment");

  const comment: BagComment = {
    id: uid(),
    targetType: data.targetType,
    targetId: data.targetId,
    packId: data.packId,
    authorUid: data.authorUid,
    authorNickname: data.authorNickname,
    authorAvatarId: data.authorAvatarId,
    text: trimmed,
    mentions: data.mentions && data.mentions.length > 0 ? data.mentions : undefined,
    createdAt: new Date().toISOString(),
  };

  const mentions = (data.mentions ?? []).filter((m) => m !== data.authorUid);

  if (mentions.length === 0) {
    await setDoc(doc(commentsCol(bagId), comment.id), stripUndefined(comment));
    return comment;
  }

  // 댓글 생성 + 멘션된 멤버들에게 알림을 하나의 배치로 묶는다(문의 답변 알림과 동일한 패턴).
  // firestore.rules가 각 알림 쓰기마다 "같은 가방 멤버끼리인지"를 개별 검증한다.
  const batch = writeBatch(db);
  batch.set(doc(commentsCol(bagId), comment.id), stripUndefined(comment));

  const now = comment.createdAt;
  const label = data.mentionTargetLabel ? `${data.mentionTargetLabel} - ` : "";
  for (const mentionUid of mentions) {
    const notificationId = uid();
    batch.set(doc(db, "users", mentionUid, "notifications", notificationId), {
      id: notificationId,
      type: "comment_mention",
      title: `${data.authorNickname}님이 댓글에서 언급했어요`,
      body: `${label}${trimmed}`,
      relatedId: comment.id,
      relatedBagId: bagId,
      createdAt: now,
      read: false,
    });
  }

  await batch.commit();
  return comment;
}

export async function updateCommentText(bagId: string, commentId: string, text: string) {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return;
  await updateDoc(doc(commentsCol(bagId), commentId), {
    text: trimmed,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteComment(bagId: string, commentId: string) {
  await deleteDoc(doc(commentsCol(bagId), commentId));
}
