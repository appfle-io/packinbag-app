"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { IconBell } from "@tabler/icons-react";
import type { AppNotification } from "@/lib/types";
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from "@/lib/notificationsService";
import { Button, Sheet, cx } from "@/components/v2/ui";
import { requestOpenInquiry } from "@/lib/v2/shell";

// 알림 구독을 앱 전체가 한 벌만 쓴다(2026-10-07). 좁은 화면에서는 홈·설정 탭이 함께 마운트돼 종이 두 개인데,
// 예전에는 종마다 onSnapshot을 따로 열어 읽기가 2배로 나갔다.
const EMPTY: AppNotification[] = [];
const shared: { uid: string | null; list: AppNotification[]; unsub: (() => void) | null; listeners: Set<() => void> } = {
  uid: null,
  list: EMPTY,
  unsub: null,
  listeners: new Set(),
};
function subscribeShared(uid: string, listener: () => void) {
  if (shared.uid !== uid) {
    shared.unsub?.();
    shared.uid = uid;
    shared.list = EMPTY;
    shared.unsub = subscribeToNotifications(uid, (list) => {
      shared.list = list;
      shared.listeners.forEach((l) => l());
    });
  }
  shared.listeners.add(listener);
  return () => {
    shared.listeners.delete(listener);
    if (shared.listeners.size === 0) {
      shared.unsub?.();
      shared.unsub = null;
      shared.uid = null;
      shared.list = EMPTY;
    }
  };
}
function useSharedNotifications(uid: string): AppNotification[] {
  // subscribe가 렌더마다 바뀌면 React가 다시 구독하면서 onSnapshot을 닫았다 열게 된다 → uid가 바뀔 때만 새로 만든다
  const subscribe = useCallback((l: () => void) => subscribeShared(uid, l), [uid]);
  return useSyncExternalStore(
    subscribe,
    () => (shared.uid === uid ? shared.list : EMPTY),
    () => EMPTY,
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// 리디자인 v2 알림 종 + 알림 시트. 구 NotificationBell(v2 prop)이 이걸 그대로 그린다.
// - 종: 헤더의 다른 IconButton과 같은 44px · 22px. 안 읽은 알림은 빨간 점
// - 시트: 알림 목록(안 읽은 것은 굵게 + 점). 누르면 읽음, 문의 답변은 그 문의로
// - 새 버전 안내는 10/19부터 여기서 빼고 설정 > 버전 정보에서만 확인한다(주기 확인 없음, SET-VER-04)
export function NotificationBellV2({ uid }: { uid: string }) {
  const notifications = useSharedNotifications(uid);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const label = unreadCount > 0 ? `알림 · 안 읽은 알림 ${unreadCount}개` : "알림";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title="알림"
        className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-field text-ink active:bg-fill"
      >
        <IconBell size={22} stroke={1.75} />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-alert ring-2 ring-canvas" />
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="알림"
        footer={
          unreadCount > 0 ? (
            <Button variant="secondary" block onClick={() => markAllNotificationsRead(uid, notifications)}>
              모두 읽음
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          {notifications.length === 0
            ? <p className="m-0 py-16 text-center text-body text-sub">알림이 없어요</p>
            : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {notifications.map((n, i) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.read) void markNotificationRead(uid, n.id).catch(() => {});
                          // 문의 답변이면 설정 > 문의하기의 그 문의로(2026-10-27, SHELL-NOTI-03)
                          if (n.type === "inquiry_answered") {
                            setOpen(false);
                            requestOpenInquiry(n.relatedId ?? null);
                          }
                        }}
                        className={cx(
                          "flex w-full items-start gap-3 bg-transparent py-3 text-left active:bg-fill",
                          i < notifications.length - 1 && "border-b border-line",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cx("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className={cx("text-body", n.read ? "font-medium text-sub" : "font-semibold text-ink")}>{n.title}</span>
                          {n.body && <span className="line-clamp-2 text-caption text-sub">{n.body}</span>}
                          <span className="text-micro text-faint">{formatDate(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>
      </Sheet>
    </>
  );
}
