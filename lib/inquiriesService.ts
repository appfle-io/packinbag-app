import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Inquiry, InquiryCategory } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function inquiriesCol() {
  return collection(db, "inquiries");
}

// 내가 쓴 문의만 실시간 구독 (설정 > 문의하기).
export function subscribeToMyInquiries(
  myUid: string,
  callback: (items: Inquiry[]) => void
) {
  const q = query(
    inquiriesCol(),
    where("uid", "==", myUid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inquiry)));
  });
}

// 전체 문의 실시간 구독 (마스터 전용 - firestore.rules가 마스터 이메일만 허용).
export function subscribeToAllInquiries(callback: (items: Inquiry[]) => void) {
  const q = query(inquiriesCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inquiry)));
  });
}

export async function createInquiryRemote(
  authorUid: string,
  authorNickname: string,
  data: { category: InquiryCategory; title: string; content: string }
): Promise<Inquiry> {
  const inquiry: Inquiry = {
    id: uid(),
    uid: authorUid,
    authorNickname,
    category: data.category,
    title: data.title.trim().slice(0, 60),
    content: data.content.trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await setDoc(doc(inquiriesCol(), inquiry.id), stripUndefined(inquiry));
  return inquiry;
}

// 관리자가 답변을 등록한다. 문의 상태 갱신 + 작성자에게 알림 생성을 하나의 배치로 묶어서
// 둘 중 하나만 반영되는 일이 없게 한다(firestore.rules가 이 배치의 각 쓰기를 개별적으로
// 검증한다 - inquiries update는 마스터만, notifications create도 마스터만 가능).
export async function answerInquiryRemote(inquiry: Inquiry, answer: string) {
  const trimmed = answer.trim();
  if (!trimmed) return;
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  batch.update(doc(inquiriesCol(), inquiry.id), {
    status: "answered",
    answer: trimmed,
    answeredAt: now,
  });

  const notificationId = uid();
  batch.set(doc(db, "users", inquiry.uid, "notifications", notificationId), {
    id: notificationId,
    type: "inquiry_answered",
    title: "문의하신 글에 답변이 달렸어요",
    body: inquiry.title,
    relatedId: inquiry.id,
    createdAt: now,
    read: false,
  });

  await batch.commit();
}
