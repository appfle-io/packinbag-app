import type { User } from "firebase/auth";
import { isPremiumUser } from "@/lib/premiumLimits";
import type { UserProfile } from "@/lib/types";

// app/api/shorten-url(Admin SDK)를 호출해서 숏 URL을 발급받는다.
export async function createShortLink(user: User, longUrl: string): Promise<string> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/shorten-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ longUrl }),
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
  return isPremiumUser(email, profile) && !!profile?.shortUrlEnabled;
}

// 커스텀 URL(/c/{code}) 생성. 한글/영문/숫자/하이픈/밑줄만 허용되며(validateCustomCode와 동일 규칙),
// 서버에서 다시 한번 검증하고 중복 여부를 확인한다.
export async function createCustomShortLink(
  user: User,
  longUrl: string,
  code: string
): Promise<string> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/custom-shorten-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ longUrl, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) ?? "커스텀 URL 생성에 실패했어요");
  }
  return data.shortUrl as string;
}

// 커스텀 코드 허용 규칙: 한글(완성형)/영문대소문/숫자/하이픈(-)/밑줄(_)만, 2~20자.
// 서버(app/api/custom-shorten-url)와 클라이언트(CustomUrlModal) 양쪽이 동일한 규칙을 쓴다.
export const CUSTOM_CODE_REGEX = /^[a-zA-Z0-9_\-\uAC00-\uD7A3]{2,20}$/;

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

// 이미 우리 서비스 짧은/커스텀 URL(/s/{code} 또는 /c/{code})인지 판단한다. 이미 축약된 링크는 또
// 축약할 수 없으므로(무한축약 방지), 클릭 시 "짧은/커스텀 URL로 변경" 선택지 자체를 숨기는 데 쓴다.
export function isAlreadyShortLink(url: string): boolean {
  return /\/(s|c)\/[^/\s]+\/?$/.test(url);
}
