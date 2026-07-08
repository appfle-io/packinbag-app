"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

export default function VersionInfoScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} aria-label="뒤로">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">버전 정보</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="rounded-lg border border-border bg-surface p-4 mb-6 text-center">
          <p className="text-[13px] text-text-secondary mb-1">현재 버전</p>
          <p className="text-[20px] font-medium">v{APP_VERSION}</p>
        </div>

        <p className="text-[12px] text-text-secondary mb-2">업데이트 노트</p>
        <div className="flex flex-col gap-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium">v{entry.version}</span>
                <span className="text-[11px] text-text-muted">{entry.date}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-[12px] text-text-secondary flex gap-1.5">
                    <span className="text-text-muted">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
