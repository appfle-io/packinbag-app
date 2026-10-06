import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Announcement } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function announcementsCol() {
  return collection(db, "announcements");
}

// 일반 사용자용 1회성 조회. 실시간 리스너 연결 비용을 절약하기 위해 앱 진입 시 한 번만 읽는다.
// 끝난 공지는 읽지 않는다(2026-10-06): 예전에는 컬렉션 전체를 읽어서 공지가 쌓일수록 앱을 열 때마다 읽기가 늘었다.
// 화면(시작 공지·설정 > 공지사항)은 어차피 진행 중인 공지(isAnnouncementActive)만 보여 준다. 시간대 차이를 감안해 하루 여유를 두고,
// 정확한 판단은 화면의 isAnnouncementActive가 한다. endDate 단일 필드 조건이라 복합 색인이 필요 없고, 정렬은 여기서 한다.
export async function getAnnouncementsOnce(): Promise<Announcement[]> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const q = query(announcementsCol(), where("endDate", ">=", since));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Announcement))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  } catch (err) {
    console.error("[팩인백] 공지사항 조회 실패:", err);
    return [];
  }
}

// 전체 공지사항(과거/미래 포함)을 최신순으로 실시간 구독. 마스터 관리화면에서 쓴다.
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
