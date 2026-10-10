// iOS 네이티브(위젯 · 단축어 · 실시간 현황)용 기기 토큰(2026-10-10). 서버 전용.
//
// 위젯과 단축어는 앱(웹)이 꺼진 상태에서 돌기 때문에 Firebase 로그인 토큰을 쓸 수 없다.
// 앱이 로그인 상태일 때 /api/native/device-token으로 긴 무작위 토큰을 받아 App Group(기기 안)에 넣어 두고,
// 네이티브는 "Authorization: Device <토큰>"으로 /api/native/* 를 부른다.
// - Firestore에는 토큰 원문이 아니라 SHA-256만 저장한다(deviceTokens/{hash}, 클라이언트 규칙 없음 = 서버만)
// - 로그아웃 · 다른 계정 로그인 때 앱이 지운다(DELETE). 토큰마다 하루 호출 횟수 제한
import { createHash, randomBytes } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";

export const DEVICE_TOKENS = "deviceTokens";
// 위젯 새로고침(대략 15~30분마다) + 체크 + 단축어를 넉넉히 덮는 값
const DAILY_LIMIT = 800;
// 한 계정이 가질 수 있는 기기 토큰 수(넘으면 오래된 것부터 지운다)
const MAX_TOKENS_PER_USER = 10;

export class DeviceAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// KST 날짜(하루 횟수 기준)
function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function issueDeviceToken(uid: string, platform: string): Promise<string> {
  const db = adminDb();
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  await db.collection(DEVICE_TOKENS).doc(hashToken(token)).set({
    uid,
    platform: platform.slice(0, 20),
    createdAt: now,
    lastUsedAt: now,
    day: kstDay(),
    count: 0,
  });
  // 오래된 토큰 정리(같은 기기에서 앱을 지웠다 깔면 새 토큰이 쌓인다)
  const mine = await db.collection(DEVICE_TOKENS).where("uid", "==", uid).get();
  if (mine.size > MAX_TOKENS_PER_USER) {
    const old = mine.docs
      .sort((a, b) => String(a.data().lastUsedAt ?? "").localeCompare(String(b.data().lastUsedAt ?? "")))
      .slice(0, mine.size - MAX_TOKENS_PER_USER);
    await Promise.all(old.map((d) => d.ref.delete()));
  }
  return token;
}

function tokenFromRequest(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Device ") ? header.slice(7).trim() : "";
}

export async function revokeDeviceToken(req: Request): Promise<void> {
  const token = tokenFromRequest(req);
  if (!token) return;
  await adminDb().collection(DEVICE_TOKENS).doc(hashToken(token)).delete();
}

// 토큰을 확인하고 하루 횟수를 하나 쓴다. 통과하면 uid
export async function verifyDeviceRequest(req: Request): Promise<string> {
  const token = tokenFromRequest(req);
  if (!token || token.length < 20 || token.length > 100) throw new DeviceAuthError("다시 로그인해 주세요");
  const db = adminDb();
  const ref = db.collection(DEVICE_TOKENS).doc(hashToken(token));
  const today = kstDay();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DeviceAuthError("다시 로그인해 주세요");
    const data = snap.data() as { uid: string; day?: string; count?: number };
    const count = data.day === today ? data.count ?? 0 : 0;
    if (count >= DAILY_LIMIT) throw new DeviceAuthError("오늘은 너무 많이 요청했어요. 내일 다시 해 주세요", 429);
    tx.update(ref, { day: today, count: count + 1, lastUsedAt: new Date().toISOString() });
    return data.uid;
  });
}
