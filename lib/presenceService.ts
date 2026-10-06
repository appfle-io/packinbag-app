import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// 가방을 지금 열어보고 있는 사람들을 표시하기 위한 실시간 접속 정보.
// bags/{bagId}/presence/{uid} 문서로 저장하고, 주기적으로 updatedAt을 갱신(heartbeat)해서
// 죽은 접속(브라우저를 그냥 닫아버린 경우)은 클라이언트에서 오래된 항목으로 판단해 걸러낸다.

const HEARTBEAT_MS = 60000; // 60초마다 살아있다고 갱신 (35초 → 60초, 2026-10-07 쓰기 비용 절감)
export const PRESENCE_STALE_MS = 150000; // 150초 넘게 갱신 없으면 나간 것으로 간주 (하트비트 2번 + 여유)
// 화면은 보이지만 자리를 비운 경우(넓은 화면·포터블에 가방을 열어 둔 채 두기). 이 시간 동안 입력이 없으면 하트비트를
// 멈추고 접속 표시를 지운다. 다시 만지면 곧바로 돌아온다. presence 쓰기 1번마다 규칙의 get(bags/..) 읽기가 1번 붙어서 여기서 줄인다.
const IDLE_MS = 3 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function presenceCol(bagId: string) {
  return collection(db, "bags", bagId, "presence");
}

export interface RawPresence {
  uid: string;
  nickname: string;
  avatarId: string;
  updatedAtMs: number;
  // 지금 이 사람이 편집 중인 에디터팩(자유문서형 메모 팩)의 id. 없거나 null이면 지금
  // 어떤 팩도 편집 중이 아님(가방만 열어놓은 상태 포함). 같은 팩을 두 명 이상이 동시에
  // 열어서 덮어쓰는 사고를 막기 위해 배지로 알려주는 용도(PackNoteEditorScreen).
  editingPackId?: string | null;
}

export function subscribeToPresence(
  bagId: string,
  callback: (entries: RawPresence[]) => void
) {
  return onSnapshot(
    presenceCol(bagId),
    (snap) => {
      const entries = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.updatedAt;
        const ms =
          ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now();
        return {
          uid: d.id,
          nickname: (data.nickname as string) ?? "",
          avatarId: (data.avatarId as string) ?? "cat",
          updatedAtMs: ms,
          editingPackId: (data.editingPackId as string | null | undefined) ?? null,
        };
      });
      callback(entries);
    },
    () => {
      // 가방이 아직 저장 전이거나 접근 권한이 사라진 경우 등 - 접속자 표시는
      // 부가 기능이라 실패해도 조용히 무시하고 빈 목록으로 처리한다.
      callback([]);
    }
  );
}

// 가방을 여는 동안 호출: 즉시 등록 + 주기적 heartbeat. 반환된 함수를 unmount 시 호출해 정리한다.
// 1인 가방(isSharedBag = false)인 경우 혼자 쓰는 공간이므로 불필요한 하트비트 Write를 건너뛴다.
export function joinPresence(
  bagId: string,
  uid: string,
  nickname: string,
  avatarId: string,
  isSharedBag: boolean = true
): () => void {
  if (!isSharedBag) return () => {};

  const ref = doc(presenceCol(bagId), uid);
  let lastActivity = Date.now();
  let idle = false;
  let interval: number | null = null;

  const stop = () => {
    if (interval !== null) {
      window.clearInterval(interval);
      interval = null;
    }
  };
  const beat = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (Date.now() - lastActivity > IDLE_MS) {
      // 자리를 비움: 하트비트를 멈추고 다른 멤버 화면에서도 빠지게 한다
      if (!idle) {
        idle = true;
        stop();
        deleteDoc(ref).catch(() => {});
      }
      return;
    }
    setDoc(
      ref,
      { nickname, avatarId, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  };
  const start = () => {
    beat();
    if (interval === null && !idle) interval = window.setInterval(beat, HEARTBEAT_MS);
  };

  const handleActivity = () => {
    lastActivity = Date.now();
    if (idle) {
      idle = false;
      start();
    }
  };

  start();

  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      stop();
    } else {
      // 화면으로 돌아온 것 자체를 활동으로 본다
      lastActivity = Date.now();
      idle = false;
      start();
    }
  };

  const handleUnload = () => {
    deleteDoc(ref).catch(() => {});
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", handleUnload);
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true, capture: true }));

  return () => {
    stop();
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", handleUnload);
    ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity, { capture: true }));
    deleteDoc(ref).catch(() => {});
  };
}

// 지금 이 사람이 편집 중인 에디터팩(자유문서형 메모 팩) id를 알려준다. packId를 null로
// 넘기면 "지금 아무 메모팩도 편집 중이 아님"으로 지운다. joinPresence로 이미 만들어진
// presence 문서에 merge로 필드 하나만 얹는 방식이라(문서가 아직 없으면 heartbeat가 곧
// nickname/avatarId까지 채워준다), 가방 전체 접속 표시(PresenceBar)와 독립적으로 동작한다.
export function setEditingNotePack(
  bagId: string,
  uid: string,
  packId: string | null
): Promise<void> {
  const ref = doc(presenceCol(bagId), uid);
  return setDoc(ref, { editingPackId: packId, updatedAt: serverTimestamp() }, { merge: true }).catch(
    () => {}
  );
}
