// 개인 잠금 Face ID · Touch ID(2026-10-12). iOS 앱 네이티브 플러그인 PackInBagNative의 메서드를 부른다.
// 네이티브 쪽(1.6 빌드에서 추가): ios/App/App/AppDelegate.swift PackInBagNativePlugin
//   biometricInfo() → { available: Bool, type: "faceId" | "touchId" | "opticId" | "none" }   (LAContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics))
//   authenticateBiometric({ reason }) → { ok: Bool }                                         (LAContext.evaluatePolicy, 실패 · 취소는 ok:false)
//   Info.plist NSFaceIDUsageDescription 필요
// 메서드가 없는 빌드(1.5 이하) · 웹 · PC에서는 쓸 수 없음으로 돌려준다 → PIN만
import { Capacitor, registerPlugin } from "@capacitor/core";

export type BiometricType = "faceId" | "touchId" | "opticId" | "none";

interface BiometricPlugin {
  biometricInfo(): Promise<{ available: boolean; type?: BiometricType }>;
  authenticateBiometric(options: { reason: string }): Promise<{ ok: boolean }>;
}

const Native = registerPlugin<BiometricPlugin>("PackInBagNative");

let cached: Promise<{ available: boolean; type: BiometricType }> | null = null;

export function getBiometricInfo(): Promise<{ available: boolean; type: BiometricType }> {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("PackInBagNative")) {
    return Promise.resolve({ available: false, type: "none" });
  }
  if (!cached) {
    cached = Native.biometricInfo()
      .then((r) => ({ available: !!r?.available, type: r?.type ?? "none" }))
      .catch(() => ({ available: false, type: "none" as const }));
  }
  return cached;
}

export function biometricLabel(type: BiometricType): string {
  return type === "touchId" ? "Touch ID" : type === "opticId" ? "Optic ID" : "Face ID";
}

export async function authenticateBiometric(reason: string): Promise<boolean> {
  const info = await getBiometricInfo();
  if (!info.available) return false;
  try {
    return !!(await Native.authenticateBiometric({ reason })).ok;
  } catch {
    return false;
  }
}
