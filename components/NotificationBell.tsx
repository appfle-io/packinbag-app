"use client";

import { NotificationBellV2 } from "@/components/v2/sheets/NotificationsSheet";

// 알림 종. 앱은 v2만 있어서 늘 NotificationBellV2를 그린다(`v2` prop은 부르는 쪽 호환용으로만 남김).
// 10/19: 예전 구 UI 종(LegacyNotificationBell)과 그 안의 "새 배포가 있어요"(10분 폴링, lib/useNewVersionAvailable)를 지웠다.
// 새 버전 확인은 설정 > 버전 정보에서만(settings.md SET-VER-04)
export default function NotificationBell({ uid }: { uid: string; v2?: boolean }) {
  return <NotificationBellV2 uid={uid} />;
}
