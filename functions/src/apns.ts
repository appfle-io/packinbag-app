// APNs(애플 푸시 서버)로 직접 보낸다(2026-10-11). FCM을 거치지 않는다 - 앱이 APNs 토큰을 그대로 저장하기 때문.
// - 인증: .p8 키로 만든 JWT(ES256). 애플 규칙상 20~60분마다 새로 만들어야 해서 50분 동안 재사용
// - 연결: HTTP/2. 같은 인스턴스 안에서는 호스트별 연결을 재사용한다
// - 환경: 기기 토큰의 env(sandbox = Xcode 설치 빌드, production = TestFlight·App Store)에 맞는 서버로 보낸다
// - 만료된 토큰(410 · BadDeviceToken 등)은 결과로 알려 주고, 지우는 건 devices.ts가 한다
import http2 from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

export const TEAM_ID = "2ZHYLWBV2H";
export const KEY_ID = "GT8XUF9U3R";
export const BUNDLE_ID = "com.appfle.packinbag";

const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

export type ApnsEnv = keyof typeof HOSTS;

export interface ApnsMessage {
  // alert: 보이는 알림 / background: 조용한 푸시(content-available) / liveactivity: 잠금화면 실시간 현황
  pushType: "alert" | "background" | "liveactivity";
  payload: Record<string, unknown>;
  // 같은 값이면 알림 센터에서 앞 알림을 덮는다(가방별 묶음 알림 등)
  collapseId?: string;
  // 초 단위. 기기가 꺼져 있을 때 애플이 들고 있을 시간(0 = 지금 못 받으면 버림)
  expiresInSec?: number;
}

export interface ApnsResult {
  ok: boolean;
  status: number;
  reason?: string;
  // 다시 보내도 소용없는 토큰(지워야 함)
  dead: boolean;
}

const DEAD_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic", "ExpiredToken"]);

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

let jwtCache: { token: string; at: number } | null = null;

function providerToken(p8: string): string {
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache && now - jwtCache.at < 50 * 60) return jwtCache.token;
  const input = `${b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID }))}.${b64url(JSON.stringify({ iss: TEAM_ID, iat: now }))}`;
  const signature = sign("sha256", Buffer.from(input), { key: createPrivateKey(p8), dsaEncoding: "ieee-p1363" });
  jwtCache = { token: `${input}.${b64url(signature)}`, at: now };
  return jwtCache.token;
}

const sessions = new Map<string, http2.ClientHttp2Session>();

function session(host: string): http2.ClientHttp2Session {
  const existing = sessions.get(host);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const s = http2.connect(host);
  const drop = () => {
    if (sessions.get(host) === s) sessions.delete(host);
  };
  s.on("error", drop);
  s.on("close", drop);
  s.on("goaway", drop);
  // 쉬는 연결 때문에 함수 인스턴스가 끝나지 못하는 일이 없게
  s.unref();
  sessions.set(host, s);
  return s;
}

function post(host: string, path: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = session(host).request({ ":method": "POST", ":path": path, ...headers });
    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.setTimeout(10_000, () => {
      req.close();
      reject(new Error("APNs 응답 시간 초과"));
    });
    req.on("response", (h) => {
      status = Number(h[":status"] ?? 0);
    });
    req.on("data", (chunk: string) => {
      data += chunk;
    });
    req.on("end", () => resolve({ status, body: data }));
    req.on("error", reject);
    req.end(body);
  });
}

export async function sendApns(p8: string, device: { token: string; env: ApnsEnv }, message: ApnsMessage): Promise<ApnsResult> {
  const topic = message.pushType === "liveactivity" ? `${BUNDLE_ID}.push-type.liveactivity` : BUNDLE_ID;
  const headers: Record<string, string> = {
    authorization: `bearer ${providerToken(p8)}`,
    "apns-push-type": message.pushType,
    "apns-topic": topic,
    // 조용한 푸시는 5만 허용(10이면 애플이 거절)
    "apns-priority": message.pushType === "background" ? "5" : "10",
    "content-type": "application/json",
  };
  if (message.collapseId) headers["apns-collapse-id"] = message.collapseId.slice(0, 64);
  if (message.expiresInSec !== undefined) {
    headers["apns-expiration"] = String(message.expiresInSec === 0 ? 0 : Math.floor(Date.now() / 1000) + message.expiresInSec);
  }
  try {
    const res = await post(HOSTS[device.env] ?? HOSTS.production, `/3/device/${device.token}`, headers, JSON.stringify(message.payload));
    if (res.status === 200) return { ok: true, status: 200, dead: false };
    let reason: string | undefined;
    try {
      reason = (JSON.parse(res.body) as { reason?: string }).reason;
    } catch {
      reason = undefined;
    }
    if (reason === "ExpiredProviderToken") jwtCache = null;
    return { ok: false, status: res.status, reason, dead: res.status === 410 || (!!reason && DEAD_REASONS.has(reason)) };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err), dead: false };
  }
}
