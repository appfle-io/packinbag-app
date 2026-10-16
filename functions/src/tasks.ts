// 알림 · 위젯 갱신을 "때가 됐는지 2분마다 확인"하지 않고, 일이 생길 때 Cloud Tasks로 예약한다(2026-10-17).
// 예전 flushBagActivity(2분마다 pushQueue · pushSilent 조회)는 아무도 안 써도 빈 조회가 하루 1,440건 읽기로 잡혔다.
// - 같은 id의 작업은 한 번만 만들어진다(두 번째는 task-already-exists → 무시). id에 시간 칸을 넣어 묶음 단위를 정한다
// - 예약이 실패해도(권한 · 일시 오류) 활동 묶음은 1시간마다 도는 sweepBagActivity가 마저 보낸다. 위젯 갱신은 위젯의 30분 · 1시간 안전망이 받는다
import { getFunctions } from "firebase-admin/functions";

export const BAG_TASK_FN = "bagPushTask";
const QUEUE = `locations/asia-northeast3/functions/${BAG_TASK_FN}`;

export type BagTask =
  // 활동 묶음(pushQueue/{bagId})을 보낸다
  | { kind: "activity"; bagId: string }
  // 함께 쓰는 가방이 바뀜 → 멤버 기기에 위젯 갱신 조용한 푸시(멤버는 예약할 때 값 - 가방을 다시 읽지 않으려고)
  | { kind: "silent"; bagId: string; members: string[] };

const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 400);

export async function enqueueBagTask(task: BagTask, key: string, delaySec: number): Promise<void> {
  try {
    await getFunctions()
      .taskQueue<BagTask>(QUEUE)
      .enqueue(task, { id: safeId(`${task.kind}-${task.bagId}-${key}`), scheduleDelaySeconds: Math.max(0, Math.ceil(delaySec)) });
  } catch (err) {
    if ((err as { code?: string })?.code === "functions/task-already-exists") return;
    console.error("[push] 작업 예약 실패", { kind: task.kind, bagId: task.bagId.slice(0, 8), err });
  }
}
