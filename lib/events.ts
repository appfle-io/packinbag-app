// 이벤트(2026-10-19). 순수 함수만 — Firestore · Storage는 lib/eventsService.ts, 화면은 components/v2/events.
// 명세 _secrets/docs/spec/events.md(EVT-), 만드는 법 _secrets/claude/event-guide.md
// 기간은 "YYYY-MM-DD"(기기 날짜 기준, 시작일 · 끝나는 날 모두 포함) — 공지(announcements)와 같은 모양
// 끝나는 날이 빈 문자열이면 "끝나는 날 없음"(관리자가 닫을 때까지 진행 중, 2026-10-20). 닫을 때는 끝나는 날을 넣거나 게시를 끈다

export type EventBodyType = "html" | "image";

export interface EventLink {
  label: string;
  url: string;
}

export interface AppEvent {
  id: string;
  title: string;
  summary: string;
  startDate: string;
  // "" = 끝나는 날 없음(EVT-DATA-04)
  endDate: string;
  // 정사각 커버(홈 카드 · 목록 썸네일)
  coverUrl?: string;
  coverPath?: string;
  bodyType: EventBodyType;
  // html: 내려받기 주소를 스크립트를 막은 iframe에 띄움 / image: 긴 이미지 한 장
  bodyUrl?: string;
  bodyPath?: string;
  // 아래 고정 버튼(선택). url은 "/"로 시작하는 앱 경로 또는 https:// 주소만
  buttonLabel?: string;
  // 예전 하나짜리 열 곳(10/19). 10/20부터는 links를 쓰고, 이 값은 links[0].url과 같게 남긴다
  buttonUrl?: string;
  // 버튼을 눌렀을 때 고를 곳(10/20, EVT-VIEW-07). 1개면 확인 창, 2개 이상이면 고르는 시트
  links?: EventLink[];
  // 공개 페이지 주소 끝(10/20, EVT-WEB-01). /about/events/{slug} · 짧게 /e/{slug}. 없으면 문서 id
  slug?: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type EventStatus = "hidden" | "upcoming" | "active" | "ended";

export const EVENT_TITLE_MAX = 30;
export const EVENT_SUMMARY_MAX = 40;
export const EVENT_BUTTON_MAX = 12;
export const EVENT_LINKS_MAX = 5;
export const EVENT_LINK_LABEL_MAX = 20;
export const EVENT_COVER_MAX_BYTES = 2 * 1024 * 1024;
export const EVENT_BODY_MAX_BYTES = 8 * 1024 * 1024;
// 홈 캐러셀에 넣는 이벤트 수(가방 5장 뒤에)
export const EVENT_CAROUSEL_MAX = 3;

// 공개 페이지 주소(EVT-WEB). 영문 소문자 · 숫자 · 하이픈 3~40자, 하이픈으로 시작 · 끝 안 됨
export const EVENT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
export const normalizeSlug = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, "-");
const eventKey = (e: Pick<AppEvent, "id" | "slug">) => e.slug || e.id;
// 보여 주고 나눠 줄 짧은 주소, 실제 페이지 주소
export const eventShortPath = (e: Pick<AppEvent, "id" | "slug">) => `/e/${eventKey(e)}`;
export const eventPagePath = (e: Pick<AppEvent, "id" | "slug">) => `/about/events/${eventKey(e)}`;

// 한국 날짜(서버는 UTC라 기기 날짜 대신 이것을 쓴다)
export function kstDateKey(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 기기 날짜 "YYYY-MM-DD"(sv-SE 형식이 ISO와 같다)
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function eventStatus(e: Pick<AppEvent, "published" | "startDate" | "endDate">, today = localDateKey()): EventStatus {
  if (!e.published) return "hidden";
  if (today < e.startDate) return "upcoming";
  if (e.endDate && today > e.endDate) return "ended";
  return "active";
}

// 사용자 화면용: 진행 중(시작이 늦은 것 먼저) · 지난 이벤트(끝난 날이 늦은 것 먼저). 예정 · 숨김은 뺀다
export function splitEvents(events: AppEvent[], today = localDateKey()): { active: AppEvent[]; ended: AppEvent[] } {
  const active = events
    .filter((e) => eventStatus(e, today) === "active")
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));
  const ended = events
    .filter((e) => eventStatus(e, today) === "ended")
    .sort((a, b) => b.endDate.localeCompare(a.endDate) || b.createdAt.localeCompare(a.createdAt));
  return { active, ended };
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabel(key: string, withYear: boolean): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const w = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return `${withYear ? `${y}년 ` : ""}${m}월 ${d}일(${w})`;
}

// "11월 1일(토) ~ 11월 30일(일)". 올해가 아니면 연도를 붙인다. 끝나는 날이 없으면 "11월 1일(토)부터"
export function eventPeriodLabel(e: Pick<AppEvent, "startDate" | "endDate">, today = localDateKey()): string {
  const year = today.slice(0, 4);
  if (!e.endDate) return `${dayLabel(e.startDate, e.startDate.slice(0, 4) !== year)}부터`;
  const withYear = e.startDate.slice(0, 4) !== year || e.endDate.slice(0, 4) !== year;
  return `${dayLabel(e.startDate, withYear)} ~ ${dayLabel(e.endDate, withYear)}`;
}

// 홈 카드 작은 줄: "이벤트 · 11월 30일까지" / 오늘 끝나면 "이벤트 · 오늘까지" / 끝나는 날이 없으면 "이벤트 · 진행 중"
export function eventEyebrow(e: Pick<AppEvent, "endDate">, today = localDateKey()): string {
  if (!e.endDate) return "이벤트 · 진행 중";
  if (e.endDate === today) return "이벤트 · 오늘까지";
  const [, m, d] = e.endDate.split("-").map(Number);
  return `이벤트 · ${m}월 ${d}일까지`;
}

// 버튼이 열 곳 목록(EVT-VIEW-07). links가 있으면 그것, 없으면 예전 buttonUrl 하나(이름 = 주소 도메인). 안전하지 않은 주소는 뺀다
export function eventLinks(e: Pick<AppEvent, "links" | "buttonUrl">): EventLink[] {
  const raw = e.links && e.links.length > 0 ? e.links : e.buttonUrl ? [{ label: "", url: e.buttonUrl }] : [];
  return raw
    .map((l) => ({ label: (l.label ?? "").trim(), url: (l.url ?? "").trim() }))
    .filter((l) => isSafeEventLink(l.url))
    .map((l) => ({ label: l.label || linkHost(l.url) || l.url, url: l.url }));
}

// 표시용 도메인("www." 뺀). 앱 경로나 잘못된 주소는 ""
export function linkHost(url: string): string {
  if (url.startsWith("/")) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const isAppPath = (url: string) => url.startsWith("/") && !url.startsWith("//");

// 버튼 열 곳: 앱 경로("/"로 시작, "//" 아님) 또는 https 주소만
export function isSafeEventLink(url: string | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

// ---- 본 이벤트(이 기기). 진행 중인데 안 본 것이 있으면 설정 줄에 빨간 점 -----------------
const SEEN_KEY = "pib_seen_events_v1";

export function readSeenEventIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function markEventSeen(id: string): void {
  try {
    const ids = readSeenEventIds();
    if (ids.includes(id)) return;
    // 오래된 것부터 버려 50개까지만
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids, id].slice(-50)));
  } catch {
    // 저장소를 못 쓰면 점이 계속 보일 뿐
  }
}

export function hasUnseenEvent(active: AppEvent[], seenIds: string[]): boolean {
  return active.some((e) => !seenIds.includes(e.id));
}
