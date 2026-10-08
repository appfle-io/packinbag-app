// "use client"를 붙이지 않는다: lib/errorMessage.ts(서버 라우트에서도 쓸 수 있음)가 이 파일을 가져온다.
// 브라우저 전용 동작은 모두 typeof window 확인 뒤에만 한다.
import { useSyncExternalStore } from "react";

/**
 * Firestore SDK가 내부 검사에 실패해 멈췄을 때 알아채고 새로고침으로 되살린다(2026-10-06).
 *
 * 왜 필요한가: 노트북을 덮었다 여는 등 절전에서 깨어날 때 IndexedDB 캐시(persistentLocalCache)의
 * 구독 상태와 서버 상태가 어긋나면 SDK가 "INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)"를 던진다.
 * 한 번 이렇게 되면 그 페이지의 Firestore 작업 대기열이 실패 상태로 굳어 이후 모든 읽기·쓰기·실시간 구독이
 * 같은 오류(ID: b815)로 막힌다. 화면은 멀쩡해 보여서 사용자는 저장이 안 되는 걸 모른다.
 * SDK 안에서는 되살릴 방법이 없고 페이지를 새로 여는 것만 통한다.
 *
 * 동작
 * - 전역 error · unhandledrejection, 그리고 앱의 catch에서 넘겨 준 오류(reportFirestoreError)를 본다
 * - 처음이면 "다시 연결하는 중"을 잠깐 보이고 새로고침. 오류 전에 쓴 내용은 IndexedDB 대기열에 남아 있어 새로고침 뒤 올라간다
 * - 2분 안에 또 터지면 새로고침을 되풀이하지 않고 "새로고침" 버튼만 보여 준다(무한 새로고침 방지)
 */
export type FirestoreRecoveryState = "ok" | "reloading" | "stuck";

const RELOAD_KEY = "pib_fs_recover_at";
const RELOAD_GUARD_MS = 2 * 60_000;
const RELOAD_DELAY_MS = 1_200;

let state: FirestoreRecoveryState = "ok";
let installed = false;
const listeners = new Set<() => void>();

function setState(next: FirestoreRecoveryState) {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
}

/** Firestore가 멈춘 오류인지(내부 검사 실패) */
function isFirestoreBrokenError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
  return msg.includes("FIRESTORE") && msg.includes("INTERNAL ASSERTION FAILED");
}

function recentlyReloaded(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    return at > 0 && Date.now() - at < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

function trigger() {
  if (state !== "ok") return;
  if (recentlyReloaded()) {
    setState("stuck");
    return;
  }
  setState("reloading");
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {}
  window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
}

/** 앱 코드의 catch에서 받은 오류를 넘겨 준다. Firestore가 멈춘 오류면 복구를 시작한다 */
export function reportFirestoreError(err: unknown) {
  if (typeof window === "undefined") return;
  if (isFirestoreBrokenError(err)) trigger();
}

/** 사용자가 버튼으로 직접 새로고침(stuck 상태) */
export function reloadNow() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {}
  window.location.reload();
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportFirestoreError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportFirestoreError(e.reason));
}

function subscribe(listener: () => void) {
  install();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFirestoreRecovery(): FirestoreRecoveryState {
  return useSyncExternalStore(subscribe, () => state, () => "ok");
}
