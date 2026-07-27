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

// 이미 우리 서비스 숏 URL(/s/{code})인지 판단한다. 이미 축약된 링크는 또 축약할 수
// 없으므로(무한 축약 방지), 클릭 시 "짧은 URL로 변경" 선택지 자체를 숨기는 데 쓴다.
export function isAlreadyShortLink(url: string): boolean {
  return /\/s\/[a-zA-Z0-9]+\/?$/.test(url);
}
