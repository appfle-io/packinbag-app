import type { User } from "firebase/auth";
import { isPremiumUser } from "@/lib/premiumLimits";
import type { UserProfile } from "@/lib/types";

// 붙여넣은 텍스트 전체가 "긴 URL 하나"인지 판단한다. URL 중간에 다른 말이 섞여 있으면
// (예: "이거 봐 https://...") 축약 대상에서 제외한다 - 어디까지가 URL인지 애매해지기 때문.
const URL_REGEX = /^https?:\/\/\S+$/i;

// 이 길이 미만이면 굳이 축약할 필요가 없다고 보고 그냥 둔다.
const LONG_URL_MIN_LENGTH = 30;

// 붙여넣은 텍스트가 "축약할 만한 긴 URL"인지 판단한다. 이미 우리 서비스 숏 URL을 또
// 붙여넣은 경우(무한 축약 방지)는 대상에서 제외한다.
export function shouldShortenPastedText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < LONG_URL_MIN_LENGTH) return false;
  if (!URL_REGEX.test(trimmed)) return false;
  if (/\/s\/[a-zA-Z0-9]+$/.test(trimmed)) return false;
  return true;
}

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

// 설정 최상단 "짧은 URL 사용하기" 토글 + 프리미엄 여부를 함께 판정한다. 둘 다 충족해야만
// 짐/메모/메모팩에 붙여넣은 긴 URL이 자동으로 축약된다.
export function isShortUrlFeatureEnabled(
  email: string | null | undefined,
  profile: UserProfile | null
): boolean {
  return isPremiumUser(email, profile) && !!profile?.shortUrlEnabled;
}

// 텍스트 입력(input/textarea)의 onPaste 핸들러에서 공통으로 쓰는 헬퍼.
// 커서 위치에 원본 URL을 우선 삽입해 붙여넣기 자체는 즉시 완료된 것처럼 보이게 하고,
// 백그라운드에서 짧은 URL을 발급받아 그 자리를 교체한다(실패하면 원본 URL 그대로 둔다).
export function handleShortenablePaste({
  clipboardText,
  currentValue,
  selectionStart,
  selectionEnd,
  user,
  enabled,
  setValue,
  onShortened,
}: {
  clipboardText: string;
  currentValue: string;
  selectionStart: number;
  selectionEnd: number;
  user: User | null;
  // isShortUrlFeatureEnabled(email, profile)로 미리 계산해서 넘겨준다 - 프리미엄이 아니거나
  // 설정이 꺼져있으면 false를 넘겨야 한다(그러면 기본 붙여넣기가 그대로 일어난다).
  enabled: boolean;
  setValue: (updater: (prev: string) => string) => void;
  onShortened?: () => void;
}): boolean {
  if (!enabled || !user || !shouldShortenPastedText(clipboardText)) return false;

  const longUrl = clipboardText.trim();
  const withLongUrl =
    currentValue.slice(0, selectionStart) + longUrl + currentValue.slice(selectionEnd);
  setValue(() => withLongUrl);

  createShortLink(user, longUrl)
    .then((shortUrl) => {
      setValue((prev) => (prev.includes(longUrl) ? prev.replace(longUrl, shortUrl) : prev));
      onShortened?.();
    })
    .catch((err) => {
      // 실패해도 이미 원본 URL이 붙여넣기 된 상태라 사용자 입력을 막지는 않는다.
      console.error("[팩인백] 링크 축약 실패:", err);
    });

  return true;
}
