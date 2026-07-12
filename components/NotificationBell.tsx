"use client";

import { useEffect, useState } from "react";
import Portal from "@/components/Portal";
import { IconBell, IconX } from "@tabler/icons-react";
import { AppNotification } from "@/lib/types";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/lib/notificationsService";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// 알림종. 처음엔 화면 우상단에 항상 떠 있는 고정 오버레이로 만들었는데, 팩/가방 보관함
// 화면 자체의 헤더 아이콘 줄(검색/도움말/설정)과 같은 자리를 놓고 겹쳐버리는 문제가
// 있었다(설정 아이콘을 가려서 못 누르는 버그). 그래서 각 화면 헤더의 아이콘 줄 "안에"
// 나머지 아이콘들과 나란히 들어가는 평범한 인라인 버튼으로 바꿨다 - 위치 충돌 걱정 없이
// 항상 같은 상대적 자리(아이콘 줄의 한 자리)에 보인다. 알림 패널 자체는 여전히 화면
// 전체를 덮는 오버레이라 다른 화면 요소와 겹칠 일이 없다.
export default function NotificationBell({ uid }: { uid: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeToNotifications(uid, setNotifications), [uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="알림"
        className="relative -m-2 p-2"
      >
        <IconBell size={20} stroke={1.75} color="var(--text-secondary)" />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full"
            style={{ background: "var(--danger)" }}
          />
        )}
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[85] flex items-start justify-end p-4"
            style={{
              background: "rgba(0,0,0,0.3)",
              paddingTop: "max(60px, calc(env(safe-area-inset-top) + 56px))",
            }}
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl bg-surface p-3 flex flex-col gap-2 shadow-lg"
              style={{ maxHeight: "70vh" }}
            >
              <div className="flex items-center justify-between shrink-0 px-1">
                <span className="text-[13px] font-medium">알림</span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead(uid, notifications)}
                      className="text-[11px]"
                      style={{ color: "var(--accent)" }}
                    >
                      모두 읽음
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} aria-label="닫기">
                    <IconX size={16} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                {notifications.length === 0 ? (
                  <p className="text-[12px] text-text-muted py-8 text-center">알림이 없어요</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => !n.read && markNotificationRead(uid, n.id)}
                      className="w-full flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left"
                      style={{ background: n.read ? "transparent" : "var(--surface-2)" }}
                    >
                      <span className="text-[12.5px] font-medium">{n.title}</span>
                      <span className="text-[11.5px] text-text-secondary truncate w-full">
                        {n.body}
                      </span>
                      <span className="text-[10px] text-text-muted">{formatDate(n.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
