import { Capacitor } from "@capacitor/core";

// Android 앱(Capacitor)인지. 웹 · iOS 앱 · 포터블은 false (2026-10-22, Android 준비)
export function isAndroidApp(): boolean {
  return typeof window !== "undefined" && Capacitor.getPlatform() === "android";
}

// 알림 권한을 켜는 기기 설정 경로(AND-WEB-04). 메뉴 이름은 제조사마다 조금 다르다(삼성 기준)
export function notificationSettingsPath(): string {
  return isAndroidApp() ? "휴대폰 설정 > 애플리케이션 > 팩인백 > 알림" : "아이폰 설정 > 팩인백 > 알림";
}
