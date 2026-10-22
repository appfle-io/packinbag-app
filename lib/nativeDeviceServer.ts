// iOS 네이티브(위젯 · 단축어 · 실시간 현황)용 기기 토큰(2026-10-10). 서버 전용.
//
// 위젯과 단축어는 앱(웹)이 꺼진 상태에서 돌기 때문에 Firebase 로그인 토큰을 쓸 수 없다.
// 앱이 로그인 상태일 때 /api/native/device-token으로 긴 무작위 토큰을 받아 App Group(기기 안)에 넣어 두고,
// 네이티브는 "Authorization: Device <토큰>"으로 /api/native/* 를 부른다.
// - Firestore에는 토큰 원문이 아니라 SHA-256만 저장한다(deviceTokens/{hash}, 클라이언트 규칙 없음 = 서버만)
// - 로그아웃 · 다른 계정 로그인 때 앱이 지운다(DELETE). 토큰마다 하루 호출 횟수 제한
import { createHash, randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const DEVICE_TOKENS = "deviceTokens";
// 위젯 새로고침(대략 15~30분마다) + 체크 + 단축어를 넉넉히 덮는 값
const DAILY_LIMIT = 800;
// 한 계정이 가질 수 있는 기기 토큰 수(넘으면 오래된 것부터 지운다)
const MAX_TOKENS_PER_USER = 10;
// 이 기간 동안 한 번도 안 쓴 토큰은 만료(2026-10-22, security_review SEC-AUTH-04). 위젯이 1시간마다 새로 고치므로
// 쓰는 기기는 늘 새로 갱신되고, 잃어버린 기기 · 지운 앱의 토큰만 걸린다. 걸리면 앱을 열 때 새 토큰을 받는다
export const DEVICE_TOKEN_IDLE_DAYS = 90;

export function isDeviceTokenExpired(lastUsedAt: string | undefined, now = new Date()): boolean {
  const t = lastUsedAt ? Date.parse(lastUsedAt) : NaN;
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > DEVICE_TOKEN_IDLE_DAYS * 24 * 3600 * 1000;
}

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

// ---- 푸시(APNs) 토큰(2026-10-11, 1.5 빌드부터) -------------------------------------------------
// 앱이 APNs에 등록해 받은 푸시 토큰을 그 기기의 deviceTokens 문서에 붙인다(apns 필드).
// - 로그아웃·계정 전환 때 기기 토큰 문서가 지워지므로 푸시 토큰도 같이 사라진다(다른 계정 알림이 오지 않게)
// - 같은 푸시 토큰이 다른 문서에 남아 있으면(예전 계정 토큰 삭제 실패) 거기서는 떼 낸다
// - env: Xcode에서 바로 설치한 빌드는 sandbox, TestFlight·App Store는 production(보낼 APNs 서버가 다르다)
// - alerts: 알림 표시 권한이 있는지(없으면 보이는 알림은 보내지 않고 조용한 푸시만)
// Cloud Functions는 deviceTokens를 uid로 찾아 apns가 있는 기기에 보낸다
export interface DevicePush {
  token: string;
  env: "sandbox" | "production";
  alerts: boolean;
}

export function parseDevicePush(body: unknown): DevicePush | null {
  const b = (body ?? {}) as { token?: unknown; env?: unknown; alerts?: unknown };
  const token = typeof b.token === "string" ? b.token.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{64,200}$/.test(token)) return null;
  if (b.env !== "sandbox" && b.env !== "production") return null;
  return { token, env: b.env, alerts: b.alerts === true };
}

// verifyDeviceRequest를 통과한 요청에서만 부른다
export async function attachPushToken(req: Request, push: DevicePush): Promise<void> {
  const db = adminDb();
  const id = hashToken(tokenFromRequest(req));
  await db.collection(DEVICE_TOKENS).doc(id).update({ apns: { ...push, updatedAt: new Date().toISOString() } });
  const dupes = await db.collection(DEVICE_TOKENS).where("apns.token", "==", push.token).get();
  await Promise.all(dupes.docs.filter((d) => d.id !== id).map((d) => d.ref.update({ apns: FieldValue.delete() })));
}

export async function detachPushToken(req: Request): Promise<void> {
  const token = tokenFromRequest(req);
  if (!token) return;
  await adminDb().collection(DEVICE_TOKENS).doc(hashToken(token)).update({ apns: FieldValue.delete() });
}

// ---- 잠금화면 실시간 현황 푸시 토큰(2026-10-11, B-5) ----------------------------------------
// 기기당 하나만 떠 있다(새로 띄우면 이전 것을 내린다) → deviceTokens/{hash}.apnsLive = { token, bagId, packId, env, updatedAt }.
// Cloud Functions(functions/src/live.ts)가 가방이 바뀔 때 apnsLive.bagId로 찾아 잠금화면을 바로 고친다
export interface DeviceLive {
  token: string;
  bagId: string;
  packId: string;
  env: "sandbox" | "production";
}

export function parseDeviceLive(body: unknown): DeviceLive | null {
  const b = (body ?? {}) as { token?: unknown; bagId?: unknown; packId?: unknown; env?: unknown };
  const token = typeof b.token === "string" ? b.token.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{32,400}$/.test(token)) return null;
  const bagId = typeof b.bagId === "string" ? b.bagId : "";
  const packId = typeof b.packId === "string" ? b.packId : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(bagId) || !packId || packId.length > 128) return null;
  if (b.env !== "sandbox" && b.env !== "production") return null;
  return { token, bagId, packId, env: b.env };
}

export async function attachLiveToken(req: Request, live: DeviceLive): Promise<void> {
  await adminDb()
    .collection(DEVICE_TOKENS)
    .doc(hashToken(tokenFromRequest(req)))
    .update({ apnsLive: { ...live, updatedAt: new Date().toISOString() } });
}

export async function detachLiveToken(req: Request): Promise<void> {
  const token = tokenFromRequest(req);
  if (!token) return;
  await adminDb().collection(DEVICE_TOKENS).doc(hashToken(token)).update({ apnsLive: FieldValue.delete() });
}

// 토큰을 확인하고 하루 횟수를 하나 쓴다. 통과하면 uid
export async function verifyDeviceRequest(req: Request): Promise<string> {
  const token = tokenFromRequest(req);
  if (!token || token.length < 20 || token.length > 100) throw new DeviceAuthError("다시 로그인해 주세요");
  const db = adminDb();
  const ref = db.collection(DEVICE_TOKENS).doc(hashToken(token));
  const today = kstDay();
  const uid = await db.runTransaction(async (tx): Promise<string | null> => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DeviceAuthError("다시 로그인해 주세요");
    const data = snap.data() as { uid: string; day?: string; count?: number; lastUsedAt?: string };
    // 거래 안에서 throw하면 지우기까지 취소되므로 null로 돌려주고 밖에서 거절한다
    if (isDeviceTokenExpired(data.lastUsedAt)) {
      tx.delete(ref);
      return null;
    }
    const count = data.day === today ? data.count ?? 0 : 0;
    if (count >= DAILY_LIMIT) throw new DeviceAuthError("오늘은 너무 많이 요청했어요. 내일 다시 해 주세요", 429);
    tx.update(ref, { day: today, count: count + 1, lastUsedAt: new Date().toISOString() });
    return data.uid;
  });
  if (!uid) throw new DeviceAuthError("다시 로그인해 주세요");
  return uid;
}
