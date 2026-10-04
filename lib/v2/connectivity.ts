"use client";

import { useSyncExternalStore } from "react";
import { enableNetwork } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { checkIsOnline } from "@/lib/networkUtils";

/**
 * 앱 전체가 함께 보는 "지금 인터넷이 되나" 상태(리디자인 v2 · 연결 흐름 A).
 * - 판단: 포터블은 메인 프로세스 IPC, 웹은 서비스 도메인 HEAD 요청(lib/networkUtils.checkIsOnline).
 *   브라우저의 online/offline 이벤트는 폐쇄망(랜선·와이파이는 붙어 있고 인터넷만 막힘)을 못 알아채므로 신호로만 쓴다.
 * - 끊겨 있는 동안은 5초마다, 연결돼 있는 동안은 30초마다 다시 확인한다(작은 HEAD 요청 하나, Firestore 읽기 없음).
 *   탭이 숨겨져 있으면 확인하지 않고, 다시 보이면 바로 확인한다.
 * - 끊김 → 연결로 바뀌는 순간 Firestore 네트워크를 다시 켜고 "pib:reconnected" 이벤트를 보낸다
 *   (대기 중인 작업 처리 등은 이 이벤트를 듣는다).
 * - "unknown"은 앱을 막 켜서 아직 확인 전. 화면은 대부분 online처럼 다루고, 시작 흐름만 결과를 기다린다.
 */
export type Connectivity = "unknown" | "online" | "offline";

export const RECONNECTED_EVENT = "pib:reconnected";

const OFFLINE_INTERVAL_MS = 5_000;
const ONLINE_INTERVAL_MS = 30_000;

let status: Connectivity = "unknown";
let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let checking: Promise<Connectivity> | null = null;
const listeners = new Set<() => void>();

function setStatus(next: Connectivity) {
  if (next === status) return;
  const prev = status;
  status = next;
  listeners.forEach((l) => l());
  if (prev === "offline" && next === "online") {
    enableNetwork(db).catch(() => {});
    window.dispatchEvent(new CustomEvent(RECONNECTED_EVENT));
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  timer = setTimeout(() => void recheckConnectivity(), status === "online" ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS);
}

/** 지금 바로 다시 확인한다(겹쳐 부르면 한 번만 확인). 결과를 돌려준다. */
export function recheckConnectivity(timeoutMs = 2000): Promise<Connectivity> {
  if (typeof window === "undefined") return Promise.resolve("online");
  if (!checking) {
    checking = checkIsOnline(timeoutMs)
      .then((ok) => {
        setStatus(ok ? "online" : "offline");
        return status;
      })
      .finally(() => {
        checking = null;
        schedule();
      });
  }
  return checking;
}

/** 서버 호출이 네트워크 오류로 실패했을 때 알려 주면 다음 주기를 기다리지 않고 바로 확인한다 */
export function reportNetworkFailure() {
  void recheckConnectivity();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!navigator.onLine) status = "offline";
  window.addEventListener("online", () => void recheckConnectivity());
  window.addEventListener("offline", () => {
    setStatus("offline");
    schedule();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void recheckConnectivity();
    else if (timer) clearTimeout(timer);
  });
  void recheckConnectivity();
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConnectivity(): Connectivity {
  return status;
}

/** 화면용 훅. 서버 렌더링 때는 "unknown" */
export function useConnectivity(): Connectivity {
  return useSyncExternalStore(subscribe, getConnectivity, () => "unknown");
}

/** 연결이 꼭 필요한 기능을 막을지(확인 전 unknown은 막지 않는다) */
export function useOffline(): boolean {
  return useConnectivity() === "offline";
}

/** 연결이 필요한 기능에 붙이는 안내 문구(버튼 아래 설명 등) */
export const NEEDS_ONLINE_MESSAGE = "인터넷에 연결되면 쓸 수 있어요";
