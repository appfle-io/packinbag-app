// 이벤트 공개 페이지(서버 전용, 2026-10-20). 명세 _secrets/docs/spec/events.md EVT-WEB
// - Admin SDK로 게시한 이벤트만 읽는다. 페이지가 revalidate로 캐시하므로 읽기는 캐시 주기마다 한 번
// - 못 읽으면(환경변수 없음 등) 없는 것으로 다룬다 — 소개 페이지가 이 때문에 깨지지 않게
import { cache } from "react";
import { adminDb } from "@/lib/firebaseAdmin";
import type { DocumentData } from "firebase-admin/firestore";
import { EVENT_SLUG_RE, kstDateKey, splitEvents, type AppEvent } from "@/lib/events";

function toEvent(id: string, data: DocumentData): AppEvent {
  return { ...(data as AppEvent), id };
}

// 주소 끝(key)으로 찾기: slug가 먼저, 없으면 문서 id. 게시하지 않은 것은 null.
// cache: 같은 요청에서 metadata와 페이지가 한 번만 읽게
export const getPublicEvent = cache(async (key: string): Promise<AppEvent | null> => {
  if (!key || key.length > 100 || !/^[A-Za-z0-9-]+$/.test(key)) return null;
  try {
    const col = adminDb().collection("events");
    if (EVENT_SLUG_RE.test(key)) {
      const snap = await col.where("slug", "==", key).limit(1).get();
      if (!snap.empty) {
        const ev = toEvent(snap.docs[0].id, snap.docs[0].data());
        return ev.published ? ev : null;
      }
    }
    const doc = await col.doc(key).get();
    if (!doc.exists) return null;
    const ev = toEvent(doc.id, doc.data() ?? {});
    return ev.published ? ev : null;
  } catch (err) {
    console.error("[팩인백] 이벤트 공개 페이지 조회 실패:", err);
    return null;
  }
});

// 소개 페이지 위 줄(EVT-WEB-05): 오늘(한국 날짜) 진행 중인 이벤트
export async function getActiveEventsServer(): Promise<AppEvent[]> {
  try {
    const snap = await adminDb().collection("events").where("published", "==", true).get();
    return splitEvents(
      snap.docs.map((d) => toEvent(d.id, d.data())),
      kstDateKey(),
    ).active;
  } catch (err) {
    console.error("[팩인백] 진행 중 이벤트 조회 실패:", err);
    return [];
  }
}
