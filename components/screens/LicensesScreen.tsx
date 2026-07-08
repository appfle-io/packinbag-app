"use client";

import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import { OSS_LICENSES } from "@/lib/licenses";

export default function LicensesScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} aria-label="뒤로">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">오픈소스 라이선스</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="text-[12px] text-text-secondary mb-3">
          팩인백은 다음 오픈소스 소프트웨어를 사용해요. 각 라이선스 전문은 링크에서 확인할 수 있어요.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          {OSS_LICENSES.map((entry, i) => (
            <a
              key={entry.name}
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3"
              style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
            >
              <span className="flex flex-col">
                <span className="text-[13px]">{entry.name}</span>
                <span className="text-[11px] text-text-muted">{entry.license}</span>
              </span>
              <IconExternalLink size={15} stroke={1.75} color="var(--text-muted)" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
