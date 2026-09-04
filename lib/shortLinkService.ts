import type { User } from "firebase/auth";
import { isPremiumUser, isOfflineEnvironment } from "@/lib/premiumLimits";
import type { UserProfile } from "@/lib/types";

// app/api/shorten-url(Admin SDK)를 호출해서 숏 URL을 발급받는다. label(표시 이름)은 선택
// 입력 - 비워두면 화면에는 이 링크 그대로(shortUrl 텍스트)가 보인다(lib/linkLabelCache.ts가
// 렌더링 시점에 label 유무를 조회해서 보여줄 텍스트를 결정한다).
export async function createShortLink(user: User, longUrl: string, label?: string): Promise<string> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/shorten-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ longUrl, label: label?.trim() || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "링크 축약에 실패했어요");
  }
  return data.shortUrl as string;
}

// 설정 > AI 기능 하위 "짧은 URL 사용하기" 토글 + 프리미엄 여부를 함께 판정한다. 둘 다
// 충족해야만 링크 클릭 시 "짧은 URL로 변경" 선택지가 노출된다.
export function isShortUrlFeatureEnabled(
  email: string | null | undefined,
  profile: UserProfile | null
): boolean {
  if (isOfflineEnvironment()) return false;
  return isPremiumUser(email, profile) && !!profile?.shortUrlEnabled;
}

// 커스텀 URL(/c/{code}) 생성. 한글/영문/숫자/하이픈/밑줄만 허용되며(validateCustomCode와 동일 규칙),
// 서버에서 다시 한번 검증하고 중복 여부를 확인한다. label(표시 이름)은 선택 입력.
export async function createCustomShortLink(
  user: User,
  longUrl: string,
  code: string,
  label?: string
): Promise<string> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/custom-shorten-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ longUrl, code, label: label?.trim() || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "커스텀 URL 생성에 실패했어요");
  }
  return data.shortUrl as string;
}

// 커스텀 코드 허용 규칙: 한글(완성형)/영문대소문/숫자/하이픈(-)/밑줄(_)만, 2~20자.
// 서버(app/api/custom-shorten-url)와 클라이언트(CustomUrlModal) 양쪽이 동일한 규칙을 쓴다.
export const CUSTOM_CODE_REGEX = /^[a-zA-Z0-9_\-가-힣]{2,20}$/;

// /c/, /s/ 경로와 공유해서 쓰면 안 되는 예약어(다른 라우트와 충돌 방지).
export const RESERVED_CUSTOM_CODES = new Set([
  "s",
  "c",
  "api",
  "admin",
  "privacy",
  "support",
  "favicon.ico",
  "manifest",
]);

export function validateCustomCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "URL을 입력해주세요";
  if (!CUSTOM_CODE_REGEX.test(trimmed)) {
    return "한글/영문/숫자/하이픈(-)/밑줄(_)만 사용하고, 2~20자로 입력해주세요";
  }
  if (RESERVED_CUSTOM_CODES.has(trimmed.toLowerCase())) {
    return "사용할 수 없는 URL이에요";
  }
  return null;
}

// 짧은/커스텀 URL에 붙일 수 있는 표시 이름(label)의 최대 길이. 생성/수정 화면(ShortenUrlModal/
// CustomUrlModal/EditLinkModal)과 서버(app/api/shorten-url 등)가 동일한 값을 쓴다.
export const LINK_LABEL_MAX_LENGTH = 60;

// 표시 이름은 선택 입력이라 비어있으면 통과시키고, 길이 초과일 때만 에러를 돌려준다.
export function validateLinkLabel(label: string): string | null {
  if (label.trim().length > LINK_LABEL_MAX_LENGTH) {
    return `표시 이름은 ${LINK_LABEL_MAX_LENGTH}자 이하로 입력해주세요`;
  }
  return null;
}

// url이 우리 서비스의 짧은/커스텀 URL(/s/{code} 또는 /c/{code})이면 종류와 코드를 뽑아준다.
// 표시 이름 조회(fetchLinkMeta)·수정(updateLinkMeta) 양쪽에서 재사용한다.
export function parseShortLinkUrl(url: string): { kind: "s" | "c"; code: string } | null {
  const match = url.match(/\/(s|c)\/([^/\s]+)\/?$/);
  if (!match) return null;
  return { kind: match[1] as "s" | "c", code: match[2] };
}

// 이미 우리 서비스 짧은/커스텀 URL(/s/{code} 또는 /c/{code})인지 판단한다. 이미 축약된 링크는 또
// 축약할 수 없으므로(무한축약 방지), 클릭 시 "짧은/커스텀 URL로 변경" 선택지 자체를 숨기는 데 쓴다.
export function isAlreadyShortLink(url: string): boolean {
  return parseShortLinkUrl(url) !== null;
}

// 짧은/커스텀 URL 하나의 표시 이름(label)·원본 주소(longUrl)·수정 가능 여부(canEdit)를 담는다.
// canEdit은 조회 시점에 로그인한 사용자가 이 링크를 만든 본인(createdBy)인지로 결정된다.
export interface LinkMeta {
  kind: "s" | "c";
  code: string;
  longUrl: string;
  label: string | null;
  canEdit: boolean;
}

// 짐/메모/메모팩에 이미 들어있는 짧은/커스텀 URL의 표시 이름·원본 주소를 조회한다(app/api/link-meta,
// 공개 라우트). 우리 서비스 링크가 아니면(parseShortLinkUrl이 null) 네트워크 요청 없이 바로 null을
// 돌려준다. 로그인 상태면 Authorization 헤더를 같이 보내 canEdit까지 함께 받아온다 - 이 값으로
// 화면에 "수정" 메뉴를 보여줄지 결정한다.
export async function fetchLinkMeta(url: string, user: User | null): Promise<LinkMeta | null> {
  const parsed = parseShortLinkUrl(url);
  if (!parsed) return null;
  try {
    const headers: Record<string, string> = {};
    if (user) {
      const idToken = await user.getIdToken();
      headers.Authorization = `Bearer ${idToken}`;
    }
    const res = await fetch(
      `/api/link-meta?kind=${parsed.kind}&code=${encodeURIComponent(parsed.code)}`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      kind: parsed.kind,
      code: parsed.code,
      longUrl: data.longUrl as string,
      label: (data.label as string | null) ?? null,
      canEdit: !!data.canEdit,
    };
  } catch (err) {
    console.error("[팩인백] 링크 정보 조회 실패:", err);
    return null;
  }
}

// 본인이 만든 짧은/커스텀 링크 하나를 나타낸다("내가 만든 URL 관리" 모달 목록 항목).
export interface MyShortLink {
  kind: "s" | "c";
  code: string;
  longUrl: string;
  label: string | null;
  createdAt: string;
  shortUrl: string;
}

// 설정 > "짧은 URL 사용하기" 하단 "내가 만든 URL 관리"에서 본인이 만든 짧은/커스텀 URL을
// 전부 조회한다(app/api/my-short-links, 최신순으로 이미 정렬돼서 돌아온다).
export async function fetchMyShortLinks(user: User): Promise<MyShortLink[]> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/my-short-links", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "목록을 불러오지 못했어요");
  }
  return (data.links as MyShortLink[]) ?? [];
}

// 본인이 만든 짧은/커스텀 링크를 삭제한다(app/api/delete-short-link). 서버가 createdBy와
// 요청자 uid가 같은지 다시 검증한다.
export async function deleteShortLink(user: User, kind: "s" | "c", code: string): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/delete-short-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ kind, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "링크 삭제에 실패했어요");
  }
}

// 본인이 만든 짧은/커스텀 링크의 표시 이름·원본 주소를 수정한다(app/api/update-short-link, PATCH).
// 서버가 createdBy와 요청자 uid가 같은지 다시 검증하므로("만든 사람 본인만 수정 가능"의 실제
// 강제는 거기서 일어남), 여기서는 별도 권한 체크 없이 그대로 호출한다.
export async function updateLinkMeta(
  user: User,
  params: { kind: "s" | "c"; code: string; label?: string; longUrl?: string }
): Promise<{ label: string | null; longUrl: string }> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/update-short-link", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "링크 수정에 실패했어요");
  }
  return { label: (data.label as string | null) ?? null, longUrl: data.longUrl as string };
}
