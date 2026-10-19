// 이벤트 Firestore · Storage(2026-10-19). 순수 함수 · 타입은 lib/events.ts, 명세 docs/spec/events.md(EVT-) · admin.md(ADM-EVT)
// - events/{id}: 마스터만 쓰기, 게시한 것은 누구나 읽기(firestore.rules)
// - Storage events/{id}/cover-… · body-…: 마스터만 쓰기, 읽기 공개(storage.rules). 앱은 내려받기 주소(토큰)로 띄운다
// - 사용자 화면은 앱을 켠 뒤 처음 필요할 때 한 번 읽는다(useEvents, 실시간 구독 없음). 관리자 화면만 실시간 구독
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestoreSanitize";
import type { AppEvent } from "@/lib/events";

const eventsCol = () => collection(db, "events");

export function newEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- 사용자 화면: 게시한 이벤트를 한 번만 ----------------------------------------------
let cache: AppEvent[] | null = null;
let inflight: Promise<AppEvent[]> | null = null;
const listeners = new Set<(e: AppEvent[]) => void>();

async function fetchPublished(): Promise<AppEvent[]> {
  try {
    // 게시한 것만(규칙이 이 조건이 있어야 목록을 허락). 이벤트 수가 적어 날짜 거르기 · 정렬은 화면(splitEvents)에서
    const snap = await getDocs(query(eventsCol(), where("published", "==", true)));
    return snap.docs.map((d) => ({ ...(d.data() as AppEvent), id: d.id }));
  } catch (err) {
    console.error("[팩인백] 이벤트 조회 실패:", err);
    return cache ?? [];
  }
}

// force: 설정 > 이벤트를 열 때 다시 받는다(관리자가 방금 올린 것도 보이게)
export function loadEvents(force = false): Promise<AppEvent[]> {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchPublished().then((list) => {
      cache = list;
      inflight = null;
      listeners.forEach((fn) => fn(list));
      return list;
    });
  }
  return inflight;
}

// enabled false(오프라인 모드 · 체험)면 읽지 않고 빈 목록
export function useEvents(enabled: boolean): AppEvent[] {
  const [events, setEvents] = useState<AppEvent[]>(() => (enabled ? cache ?? [] : []));
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setEvents);
    void loadEvents();
    return () => {
      listeners.delete(setEvents);
    };
  }, [enabled]);
  return enabled ? events : [];
}

// ---- 관리자 ---------------------------------------------------------------------------
export function subscribeToAllEvents(callback: (items: AppEvent[]) => void, onError?: (err: unknown) => void) {
  return onSnapshot(
    eventsCol(),
    (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as AppEvent), id: d.id }))),
    (err) => onError?.(err),
  );
}

export async function saveEventRemote(event: AppEvent): Promise<void> {
  await setDoc(doc(eventsCol(), event.id), stripUndefined({ ...event }));
}

export async function deleteEventRemote(event: AppEvent): Promise<void> {
  await deleteDoc(doc(eventsCol(), event.id));
  await Promise.all([event.coverPath, event.bodyPath].filter(Boolean).map((p) => deleteEventFile(p as string)));
}

function extOf(file: File): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(file.name);
  if (m) return m[1].toLowerCase();
  if (file.type === "text/html") return "html";
  return file.type.split("/")[1] || "bin";
}

// 올리고 { path, url }. HTML은 글자가 깨지지 않게 utf-8을 붙인다
export async function uploadEventFile(eventId: string, kind: "cover" | "body", file: File): Promise<{ path: string; url: string }> {
  const isHtml = file.type === "text/html" || /\.html?$/i.test(file.name);
  const path = `events/${eventId}/${kind}-${Date.now()}.${isHtml ? "html" : extOf(file)}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, {
    contentType: isHtml ? "text/html; charset=utf-8" : file.type || "application/octet-stream",
    cacheControl: "public, max-age=31536000",
  });
  return { path, url: await getDownloadURL(r) };
}

export async function deleteEventFile(path: string): Promise<void> {
  await deleteObject(ref(storage, path)).catch((err) => {
    // 이미 없으면 괜찮다
    if ((err as { code?: string }).code !== "storage/object-not-found") console.error("[팩인백] 이벤트 파일 삭제 실패:", err);
  });
}
