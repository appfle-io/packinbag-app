// 팩인백 Cloud Functions 진입점(2026-10-11). 리전은 Firestore와 같은 서울(asia-northeast3).
// 배포: 저장소 루트에서 `cd functions && npm install && cd .. && npx firebase-tools deploy --only functions`
// APNs 키는 Secret Manager의 APNS_KEY_P8(.p8 파일 내용). 코드·저장소에는 넣지 않는다.
//
// - sendTestPush(호출형): 로그인한 사람의 기기에 5초 뒤 테스트 알림(설정 > 알림 > 테스트 알림)
// - onBagUpdated(Firestore 트리거): 공유 가방 변경 → 담당 지정 · 새 멤버는 바로, 활동은 pushQueue에 모음(bagEvents.ts)
// - bagPushTask(Cloud Tasks): 활동 묶음 · 위젯 갱신 푸시를 때가 되면 보냄(tasks.ts, 2026-10-17)
// - sweepBagActivity(1시간마다): 예약이 실패해 남은 활동 묶음만 보냄(안전망)
//   예전의 flushBagActivity(2분마다 조회 2번 = 아무도 안 써도 하루 읽기 1,440건)를 대신한다
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { defineSecret } from "firebase-functions/params";
import * as functionsV1 from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { DEVICE_TOKENS, devicesOf, sendToDevices } from "./devices";
import { diffBag, enqueueActivity, flushActivity, sendImmediate, sweepActivity } from "./bagEvents";
import { SILENT_BATCH_MS, sendSilent, updateLiveActivities } from "./live";
import { enqueueBagTask, type BagTask } from "./tasks";

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
  // collapse-id는 붙이지 않는다(테스트마다 새 알림으로, 2026-10-17)
  const result = await sendToDevices(APNS_KEY_P8.value(), devices, {
    pushType: "alert",
    payload: {
      aps: { alert: { title: "팩인백", body: "알림이 잘 도착했어요" }, sound: "default" },
      kind: "test",
    },
    expiresInSec: 600,
  });
  return { devices: devices.length, ...result };
});

// 가방이 저장될 때마다 불린다. 저장마다 Firestore를 읽지 않는 것이 기본(2026-10-17)
// - 팩 내용이 바뀌었고 잠금화면에 띄운 가방(liveOn)이면: 실시간 현황을 고친다(혼자 쓰는 가방도, 조회 1)
// - 함께 쓰는 가방만: 위젯 조용한 푸시 예약 · 담당 · 새 멤버 · 활동 묶음(쓰기만)
export const onBagUpdated = onDocumentUpdated({ document: "bags/{bagId}", secrets: [APNS_KEY_P8] }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const bagId = event.params.bagId;
  const packsChanged = before.name !== after.name || JSON.stringify(before.packs ?? []) !== JSON.stringify(after.packs ?? []);
  // 멤버가 빠졌으면 그 사람 잠금화면도 바로 내린다(updateLiveActivities가 멤버 아닌 기기는 내림, 10/12)
  const afterIds: string[] = Array.isArray(after.memberIds) ? after.memberIds : [];
  const memberRemoved = (Array.isArray(before.memberIds) ? (before.memberIds as string[]) : []).some((id) => !afterIds.includes(id));
  if ((packsChanged || memberRemoved) && after.liveOn === true) {
    await updateLiveActivities(APNS_KEY_P8.value(), bagId, after, event.data?.after.updateTime).catch((err) =>
      console.error("[push] 실시간 현황 갱신 실패", err),
    );
  }
  const members: string[] = Array.isArray(after.memberIds) ? after.memberIds : [];
  if (members.length < 2) return;
  if (after.trashedByOwnerAt) return;
  if (packsChanged) {
    const now = Date.now();
    await enqueueBagTask({ kind: "silent", bagId, members }, `s${Math.floor(now / SILENT_BATCH_MS)}`, SILENT_BATCH_MS / 1000);
  }
  const actor = typeof after.editedBy === "string" && members.includes(after.editedBy) ? after.editedBy : undefined;
  const diff = diffBag(before, after, actor);
  if (diff.assigned.size > 0 && !actor) console.log("[push] 담당 지정을 누가 했는지 몰라 건너뜀", { bagId, editedBy: String(after.editedBy ?? "").slice(0, 6) });
  if (diff.assigned.size > 0 || diff.newMembers.length > 0) {
    await sendImmediate(APNS_KEY_P8.value(), bagId, after, diff, actor).catch((err) => console.error("[push] 바로 알림 실패", err));
  }
  // 누가 했는지 모르는 변경(옛 앱 · 서버 정리 등)은 활동으로 알리지 않는다
  if (actor) await enqueueActivity(bagId, actor, diff);
});

// 때가 된 일을 보낸다(onBagUpdated가 예약). 실패하면 30초 뒤부터 두 번 더
export const bagPushTask = onTaskDispatched<BagTask>(
  {
    secrets: [APNS_KEY_P8],
    timeoutSeconds: 60,
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 10 },
  },
  async (req) => {
    const task = req.data;
    if (!task || typeof task.bagId !== "string") return;
    const p8 = APNS_KEY_P8.value();
    if (task.kind === "activity") {
      await flushActivity(p8, task.bagId);
    } else if (task.kind === "silent") {
      const n = await sendSilent(p8, task.bagId, Array.isArray(task.members) ? task.members : []);
      if (n > 0) console.log(`[push] 위젯 갱신 푸시 ${n}대`);
    }
  },
);

// 안전망: 예약이 실패해 남은 활동 묶음(20분 넘게 그대로인 것)만 보낸다. 빈 조회 1번 = 하루 읽기 24건
export const sweepBagActivity = onSchedule(
  { schedule: "every 60 minutes", timeZone: "Asia/Seoul", secrets: [APNS_KEY_P8], timeoutSeconds: 120 },
  async () => {
    const n = await sweepActivity(APNS_KEY_P8.value());
    if (n > 0) console.log(`[push] 남은 활동 묶음 ${n}개 보냄`);
  },
);

// 가방이 완전히 지워지면 그 가방을 띄운 잠금화면을 내린다(띄운 적이 있는 가방만)
export const onBagDeleted = onDocumentDeleted({ document: "bags/{bagId}", secrets: [APNS_KEY_P8] }, async (event) => {
  if (event.data?.data()?.liveOn !== true) return;
  await updateLiveActivities(APNS_KEY_P8.value(), event.params.bagId, null).catch((err) => console.error("[push] 실시간 현황 내리기 실패", err));
});

// 회원 탈퇴(Auth 계정 삭제) → 그 계정의 기기 토큰을 모두 지운다(2026-10-12 보안 점검).
// 예전에는 남아 있어서, 탈퇴한 기기의 위젯·단축어가 계속 서버를 부르고 푸시도 받을 수 있었다.
// Auth 삭제 트리거는 v2에 없어 v1을 쓴다(리전은 같게 서울)
export const onUserDeleted = functionsV1
  .region("asia-northeast3")
  .auth.user()
  .onDelete(async (user) => {
    const db = getFirestore();
    const snap = await db.collection(DEVICE_TOKENS).where("uid", "==", user.uid).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    if (snap.size > 0) console.log(`[push] 탈퇴 계정 기기 토큰 ${snap.size}개 삭제`);
  });
