import type { User } from "firebase/auth";

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

// 텍스트 입력(input/textarea)의 onPaste 핸들러에서 공통으로 쓰는 헬퍼.
// 커서 위치에 원본 URL을 우선 삽입해 붙여넣기 자체는 즉시 완료된 것처럼 보이게 하고,
// 백그라운드에서 숏 URL을 발급받아 그 자리를 교체한다(실패하면 원본 URL 그대로 둔다).
export function handleShortenablePaste({
  clipboardText,
  currentValue,
  selectionStart,
  selectionEnd,
  user,
  setValue,
  onShortened,
}: {
  clipboardText: string;
  currentValue: string;
  selectionStart: number;
  selectionEnd: number;
  user: User | null;
  setValue: (updater: (prev: string) => string) => void;
  onShortened?: () => void;
}): boolean {
  if (!user || !shouldShortenPastedText(clipboardText)) return false;

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
