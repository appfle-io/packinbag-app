"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { PRESENCE_STALE_MS, RawPresence } from "@/lib/presenceService";

export default function PresenceBar({
  entries = [],
  uid,
}: {
  entries?: RawPresence[];
  uid: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [showOverflow, setShowOverflow] = useState(false);
  const { show } = useToast();

  // 시간이 흘러서 오래된 접속자를 걸러내기 위해 주기적으로 리렌더
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);

  // 나(uid)는 항상 접속자 목록에 포함되지만(joinPresence), 화면에는 "다른 사람"만 보여준다 -
  // 나 혼자 접속 중이면 아예 표시하지 않고, 누군가 같이 있을 때만 그 사람들만 나열한다.
  const others = entries
    .filter((e) => e.uid !== uid && now - e.updatedAtMs < PRESENCE_STALE_MS);

  if (others.length === 0) return null;

  const visible = others.slice(0, 2);
  const overflow = others.slice(2);

  return (
    <div className="relative flex items-center -space-x-2 shrink-0">
      {visible.map((entry) => (
        <button
          key={entry.uid}
          onMouseEnter={() => show(entry.nickname)}
          onClick={() => show(entry.nickname)}
        >
          <Avatar avatarId={entry.avatarId} size={26} ring />
        </button>
      ))}

      {overflow.length > 0 && (
        <div className="relative">
          <button
            onMouseEnter={() => setShowOverflow(true)}
            onClick={() => setShowOverflow((v) => !v)}
            className="h-[26px] w-[26px] rounded-full flex items-center justify-center text-[10px] font-medium"
            style={{
              background: "var(--surface-2)",
              color: "var(--foreground)",
              boxShadow: "0 0 0 2px var(--background)",
            }}
          >
            +{overflow.length}
          </button>

          {showOverflow && (
            <div
              onMouseLeave={() => setShowOverflow(false)}
              className="absolute right-0 top-full mt-1.5 z-20 rounded-lg border border-border bg-surface p-1.5 flex flex-col gap-0.5 min-w-[120px]"
            >
              {overflow.map((entry) => (
                <button
                  key={entry.uid}
                  onClick={() => {
                    show(entry.nickname);
                    setShowOverflow(false);
                  }}
                  className="flex items-center gap-2 px-1.5 py-1 rounded-md text-[12px] text-left hover:bg-surface-2"
                >
                  <Avatar avatarId={entry.avatarId} size={20} />
                  {entry.nickname}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
