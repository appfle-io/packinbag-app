import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppNotification } from "@/lib/types";

// 범용 알림함. 지금은 문의 답변 알림만 쌓이지만, 나중에 푸시 기능이 추가되면 서버(Admin SDK)가
// 같은 컬렉션 구조에 다른 type의 문서를 써넣기만 하면 되도록 설계되어 있다.
function notificationsCol(uidStr: string) {
  return collection(db, "users", uidStr, "notifications");
}

export function subscribeToNotifications(
  uidStr: string,
  callback: (items: AppNotification[]) => void
) {
  const q = query(notificationsCol(uidStr), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
  });
}

export async function markNotificationRead(uidStr: string, notificationId: string) {
  await updateDoc(doc(notificationsCol(uidStr), notificationId), { read: true });
}

export async function markAllNotificationsRead(
  uidStr: string,
  notifications: AppNotification[]
) {
  const unread = notifications.filter((n) => !n.read);
  await Promise.all(unread.map((n) => markNotificationRead(uidStr, n.id)));
}
