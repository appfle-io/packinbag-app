// 팩인백 Cloud Functions 진입점(2026-10-11). 리전은 Firestore와 같은 서울(asia-northeast3).
// 배포: 저장소 루트에서 `cd functions && npm install && npm run build && cd .. && npx firebase-tools deploy --only functions`
// APNs 키는 Secret Manager의 APNS_KEY_P8(.p8 파일 내용). 코드·저장소에는 넣지 않는다.
//
// 지금 있는 것
// - sendTestPush(호출형): 로그인한 사람의 기기에 5초 뒤 테스트 알림 하나(설정 > 테스트 알림)
// 다음 단계(B-3~5): bags/{bagId} 변경 트리거 → 공유 가방 묶음 알림 · 담당 지정 · 새 멤버 · 조용한 푸시 · 실시간 현황
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { devicesOf, sendToDevices } from "./devices";

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

const APNS_KEY_P8 = defineSecret("APNS_KEY_P8");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const sendTestPush = onCall({ secrets: [APNS_KEY_P8], timeoutSeconds: 30 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인한 뒤 다시 해 주세요");
  const devices = await devicesOf([uid]);
  if (devices.length === 0) return { devices: 0, sent: 0, reason: "no-device" };
  if (!devices.some((d) => d.alerts)) return { devices: devices.length, sent: 0, reason: "no-permission" };
  // 앱을 보는 중에는 배너가 안 뜨므로(presentationOptions: []) 홈 화면으로 나갈 시간을 준다
  await sleep(5000);
  const result = await sendToDevices(APNS_KEY_P8.value(), devices, {
    pushType: "alert",
    payload: {
      aps: { alert: { title: "팩인백", body: "알림이 잘 도착했어요" }, sound: "default" },
      kind: "test",
    },
    collapseId: "test",
    expiresInSec: 600,
  });
  return { devices: devices.length, ...result };
});
