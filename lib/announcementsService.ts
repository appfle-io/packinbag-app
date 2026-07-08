import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Announcement } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function announcementsCol() {
  return collection(db, "announcements");
}

// 전체 공지사항(과거/미래 포함)을 최신순으로 실시간 구독. 설정 화면의
// "공지사항"(현재 노출기간인 것만 필터링해서 보여줌)과 마스터 관리화면(전체) 모두 이걸 쓴다.
export function subscribeToAnnouncements(
  callback: (items: Announcement[]) => void
) {
  const q = query(announcementsCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
  });
}

export function isAnnouncementActive(a: Announcement, today = new Date()): boolean {
  const todayStr = today.toISOString().slice(0, 10);
  return a.startDate <= todayStr && todayStr <= a.endDate;
}

export async function createAnnouncementRemote(
  data: Omit<Announcement, "id" | "createdAt">
) {
  const announcement: Announcement = {
    ...data,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(announcementsCol(), announcement.id), stripUndefined(announcement));
  return announcement;
}

export async function updateAnnouncementRemote(
  id: string,
  data: Partial<Omit<Announcement, "id" | "createdAt" | "createdBy">>
) {
  await updateDoc(doc(announcementsCol(), id), stripUndefined(data));
}

export async function deleteAnnouncementRemote(id: string) {
  await deleteDoc(doc(announcementsCol(), id));
}

// 사용자가 "다시 보지 않기"를 누른 공지 id를 계정에 기록
export async function dismissAnnouncementRemote(uidStr: string, announcementId: string) {
  await setDoc(
    doc(db, "users", uidStr),
    { dismissedAnnouncementIds: arrayUnion(announcementId) },
    { merge: true }
  );
}
