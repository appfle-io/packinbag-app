// 공유 링크 · 초대코드 정리(2026-10-15, share.md 확인 필요 3 · 4). 서버 라우트만 지울 수 있는 것들이라 서버에 맡긴다.
// 실패해도 원래 동작(지우기 등)은 막지 않는다 — 콘솔만 남긴다.
import type { User } from "firebase/auth";
import type { Bag, Pack } from "@/lib/types";
import { getApiUrl } from "@/lib/apiBase";
import { auth } from "@/lib/firebase";

async function post(user: User | null | undefined, path: string, body: unknown): Promise<Response | null> {
  const u = user ?? auth.currentUser;
  if (!u) return null;
  const idToken = await u.getIdToken();
  return fetch(getApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
}

/** 팩 · 폴더 · 메모 공유 끄기. 성공하면 true */
export async function stopPackShares(user: User | null | undefined, tokens: (string | undefined | null)[]): Promise<boolean> {
  const list = [...new Set(tokens.filter((t): t is string => !!t))];
  if (list.length === 0) return true;
  try {
    const res = await post(user, "/api/unshare-pack", { tokens: list });
    return !!res?.ok;
  } catch (err) {
    console.error("[팩인백] 공유 끄기 실패:", err);
    return false;
  }
}

/** 완전히 지우는 보관함 항목들이 가진 공유 토큰 */
export function packShareTokens(packs: Pack[]): string[] {
  return packs.map((p) => p.publicShareToken).filter((t): t is string => !!t);
}

/** 완전히 지우는 가방 속 팩들이 가진 공유 토큰 */
export function bagShareTokens(bag: Bag): string[] {
  return packShareTokens(bag.packs ?? []);
}

/** 가방을 지운 뒤 남은 초대코드 문서 정리. 서버는 그 가방이 이미 없을 때만 지운다 */
export async function cleanupInviteCode(code: string | undefined | null): Promise<void> {
  if (!code) return;
  try {
    await post(null, "/api/cleanup-invite-code", { code });
  } catch (err) {
    console.error("[팩인백] 초대코드 정리 실패:", err);
  }
}
