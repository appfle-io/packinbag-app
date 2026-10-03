"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { OSS_LICENSES } from "@/lib/licenses";
import { openExternalLink } from "@/lib/openExternalLink";
import { SectionHeader, cx } from "@/components/v2/ui";
import { SubScreen } from "./SubScreen";

// 설정 > 버전 정보. 구 VersionInfoScreen 대체(같은 CHANGELOG)
export function VersionScreenV2({ onBack }: { onBack: () => void }) {
  return (
    <SubScreen title="버전 정보" onBack={onBack} bodyClassName="gap-8">
      <section className="flex flex-col items-center gap-1 rounded-card bg-fill py-6">
        <span className="text-caption text-sub">지금 버전</span>
        <span className="text-heading font-bold text-ink">v{APP_VERSION}</span>
      </section>

      <section className="flex flex-col">
        <SectionHeader>업데이트 노트</SectionHeader>
        {CHANGELOG.map((entry, i) => (
          <article key={entry.version} className={cx("flex flex-col gap-2 py-4", i < CHANGELOG.length - 1 && "border-b border-line")}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="m-0 text-body font-semibold text-ink">v{entry.version}</h3>
              <span className="shrink-0 text-micro text-faint">{entry.date}</span>
            </div>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-caption text-sub marker:text-faint">
              {entry.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </SubScreen>
  );
}

// 설정 > 오픈소스 라이선스. 구 LicensesScreen 대체. 링크는 openExternalLink(앱에서는 사파리로)
export function LicensesScreenV2({ onBack }: { onBack: () => void }) {
  return (
    <SubScreen title="오픈소스 라이선스" onBack={onBack} bodyClassName="gap-4">
      <p className="m-0 text-caption text-sub">팩인백은 아래 오픈소스를 써요. 누르면 라이선스 전문이 열려요.</p>
      <section className="flex flex-col">
        {OSS_LICENSES.map((entry, i) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => openExternalLink(entry.url)}
            className={cx(
              "flex min-h-13 w-full items-center gap-3 bg-transparent py-2 text-left active:bg-fill",
              i < OSS_LICENSES.length - 1 && "border-b border-line",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink">{entry.name}</span>
              <span className="truncate text-caption text-sub">{entry.license}</span>
            </span>
            <IconExternalLink size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
          </button>
        ))}
      </section>
    </SubScreen>
  );
}
