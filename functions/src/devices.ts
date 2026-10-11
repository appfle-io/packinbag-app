// 계정(uid)별 푸시 받을 기기 찾기 · 보내기 · 죽은 토큰 정리(2026-10-11).
// 기기 목록은 웹 서버가 쓰는 deviceTokens/{hash}(lib/nativeDeviceServer.ts)를 그대로 읽는다.
// apns = { token, env, alerts, updatedAt } 가 있는 문서만 푸시를 받는다(로그아웃하면 문서째 사라짐).
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendApns, type ApnsEnv, type ApnsMessage } from "./apns";

export const DEVICE_TOKENS = "deviceTokens";

export interface PushDevice {
  id: string;
  uid: string;
  token: string;
  env: ApnsEnv;
  alerts: boolean;
}

// where in 은 한 번에 30개까지
export async function devicesOf(uids: string[]): Promise<PushDevice[]> {
  const unique = [...new Set(uids.filter(Boolean))];
  const db = getFirestore();
  const out: PushDevice[] = [];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await db.collection(DEVICE_TOKENS).where("uid", "in", unique.slice(i, i + 30)).get();
    for (const doc of snap.docs) {
      const d = doc.data() as { uid?: string; apns?: { token?: string; env?: string; alerts?: boolean } };
      const token = d.apns?.token;
      if (!token || !d.uid) continue;
      out.push({ id: doc.id, uid: d.uid, token, env: d.apns?.env === "sandbox" ? "sandbox" : "production", alerts: d.apns?.alerts === true });
    }
  }
  return out;
}

export interface SendSummary {
  sent: number;
  failed: number;
  removed: number;
  reasons: string[];
}

// 여러 기기에 같은 메시지. 보이는 알림(alert)은 알림 권한이 있는 기기에만 보낸다
export async function sendToDevices(p8: string, devices: PushDevice[], message: ApnsMessage): Promise<SendSummary> {
  const targets = message.pushType === "alert" ? devices.filter((d) => d.alerts) : devices;
  const results = await Promise.all(targets.map((d) => sendApns(p8, d, message).then((r) => ({ d, r }))));
  const db = getFirestore();
  const dead = results.filter(({ r }) => r.dead);
  await Promise.all(dead.map(({ d }) => db.collection(DEVICE_TOKENS).doc(d.id).update({ apns: FieldValue.delete() }).catch(() => {})));
  const failed = results.filter(({ r }) => !r.ok);
  for (const { d, r } of failed) console.warn("[push] 실패", { device: d.id.slice(0, 8), env: d.env, status: r.status, reason: r.reason });
  return {
    sent: results.length - failed.length,
    failed: failed.length,
    removed: dead.length,
    reasons: [...new Set(failed.map(({ r }) => r.reason ?? String(r.status)))],
  };
}
