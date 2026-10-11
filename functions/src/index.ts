// 팩인백 Cloud Functions 진입점(2026-10-11). 리전은 Firestore와 같은 서울(asia-northeast3).
// 배포: 저장소 루트에서 `cd functions && npm install && cd .. && npx firebase-tools deploy --only functions`
// APNs 키는 Secret Manager의 APNS_KEY_P8(.p8 파일 내용). 코드·저장소에는 넣지 않는다.
//
// - sendTestPush(호출형): 로그인한 사람의 기기에 5초 뒤 테스트 알림(설정 > 알림 > 테스트 알림)
// - onBagUpdated(Firestore 트리거): 공유 가방 변경 → 담당 지정 · 새 멤버는 바로, 활동은 pushQueue에 모음(bagEvents.ts)
// - flushBagActivity(2분마다): 10분이 된 활동 묶음을 보냄
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { devicesOf, sendToDevices } from "./devices";
import { diffBag, enqueueActivity, flushDue, sendImmediate } from "./bagEvents";

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

// 가방이 저장될 때마다 불린다. 혼자 쓰는 가방은 바로 끝낸다(읽기 · 쓰기 없음)
export const onBagUpdated = onDocumentUpdated({ document: "bags/{bagId}", secrets: [APNS_KEY_P8] }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const members: string[] = Array.isArray(after.memberIds) ? after.memberIds : [];
  if (members.length < 2) return;
  if (after.trashedByOwnerAt) return;
  const bagId = event.params.bagId;
  const actor = typeof after.editedBy === "string" && members.includes(after.editedBy) ? after.editedBy : undefined;
  const diff = diffBag(before, after, actor);
  if (diff.assigned.size > 0 || diff.newMembers.length > 0) {
    await sendImmediate(APNS_KEY_P8.value(), bagId, after, diff, actor).catch((err) => console.error("[push] 바로 알림 실패", err));
  }
  // 누가 했는지 모르는 변경(옛 앱 · 서버 정리 등)은 활동으로 알리지 않는다
  if (actor) await enqueueActivity(bagId, actor, diff);
});

export const flushBagActivity = onSchedule(
  { schedule: "every 2 minutes", timeZone: "Asia/Seoul", secrets: [APNS_KEY_P8], timeoutSeconds: 120 },
  async () => {
    const n = await flushDue(APNS_KEY_P8.value());
    if (n > 0) console.log(`[push] 활동 묶음 ${n}개 보냄`);
  },
);
