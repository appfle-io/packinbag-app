"use client";

import { useEffect, useState } from "react";
import { IconBell, IconRefresh } from "@tabler/icons-react";
import type { AppNotification } from "@/lib/types";
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from "@/lib/notificationsService";
import { useNewVersionAvailable } from "@/lib/useNewVersionAvailable";
import { Button, Sheet, cx } from "@/components/v2/ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// 리디자인 v2 알림 종 + 알림 시트. 구 NotificationBell(v2 prop)이 이걸 그대로 그린다.
// - 종: 헤더의 다른 IconButton과 같은 44px · 22px. 새 배포는 브랜드색 점, 안 읽은 알림은 빨간 점
// - 시트: 새 배포 안내(누르면 새로고침) → 알림 목록(안 읽은 것은 굵게 + 점). 누르면 읽음
export function NotificationBellV2({ uid }: { uid: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const hasNewVersion = useNewVersionAvailable();

  useEffect(() => subscribeToNotifications(uid, setNotifications), [uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const label = hasNewVersion ? "알림 · 새 버전이 있어요" : unreadCount > 0 ? `알림 · 안 읽은 알림 ${unreadCount}개` : "알림";

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
        {(hasNewVersion || unreadCount > 0) && (
          <span
            aria-hidden="true"
            className={cx("absolute top-2 right-2 size-2 rounded-full ring-2 ring-canvas", hasNewVersion ? "bg-brand" : "bg-alert")}
          />
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
          {hasNewVersion && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex min-h-15 w-full items-center gap-3 rounded-card bg-brand-soft px-4 py-3 text-left active:opacity-80"
            >
              <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
                <IconRefresh size={18} stroke={2} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body font-semibold text-ink">새 버전이 있어요</span>
                <span className="text-caption text-sub">눌러서 새로고침하면 바로 쓸 수 있어요</span>
              </span>
            </button>
          )}

          {notifications.length === 0
            ? !hasNewVersion && <p className="m-0 py-16 text-center text-body text-sub">알림이 없어요</p>
            : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {notifications.map((n, i) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => !n.read && markNotificationRead(uid, n.id)}
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
