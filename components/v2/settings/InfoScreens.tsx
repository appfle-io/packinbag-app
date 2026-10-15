"use client";

import { useEffect, useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { OSS_LICENSES } from "@/lib/licenses";
import { openExternalLink } from "@/lib/openExternalLink";
import { SectionHeader, cx } from "@/components/v2/ui";
import { SubScreen } from "./SubScreen";

// 1.0.x는 웹 번호를 따로 센 예전 번호다(lib/changelog.ts 번호 규칙). 그 앞에 한 줄 안내를 둔다
const isLegacyVersion = (v: string) => v.startsWith("1.0.");

// 아이폰 앱이면 스토어 앱 버전 · 빌드 번호(문의 대응용). 웹 · 포터블은 null
function useNativeAppInfo(): { version: string; build: string } | null {
  const [info, setInfo] = useState<{ version: string; build: string } | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    App.getInfo()
      .then((i) => !cancelled && setInfo({ version: i.version, build: i.build }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

// 설정 > 버전 정보. 구 VersionInfoScreen 대체(같은 CHANGELOG)
export function VersionScreenV2({ onBack }: { onBack: () => void }) {
  const native = useNativeAppInfo();
  return (
    <SubScreen title="버전 정보" onBack={onBack} bodyClassName="gap-8">
      <section className="flex flex-col items-center gap-1 rounded-card bg-fill py-6">
        <span className="text-caption text-sub">지금 버전</span>
        <span className="text-heading font-bold text-ink">v{APP_VERSION}</span>
        {native && (
          <span className="text-micro text-faint">
            앱 {native.version} (빌드 {native.build})
          </span>
        )}
      </section>

      <section className="flex flex-col">
        <SectionHeader>업데이트 노트</SectionHeader>
        {CHANGELOG.map((entry, i) => (
          <div key={entry.version} className="flex flex-col">
            {isLegacyVersion(entry.version) && (i === 0 || !isLegacyVersion(CHANGELOG[i - 1].version)) && (
              <p className="m-0 border-b border-line py-3 text-micro text-faint">
                여기부터는 예전 번호(1.0.x)예요. 1.6.1부터 앱스토어 버전과 번호를 맞추었어요.
              </p>
            )}
            <article className={cx("flex flex-col gap-2 py-4", i < CHANGELOG.length - 1 && "border-b border-line")}>
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
          </div>
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
