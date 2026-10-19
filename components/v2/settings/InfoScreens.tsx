"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCircleCheck, IconExternalLink } from "@tabler/icons-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { BUILD_ID } from "@/lib/buildInfo";
import { decideUpdate, type UpdateKind } from "@/lib/appUpdate";
import { OSS_LICENSES } from "@/lib/licenses";
import { openExternalLink } from "@/lib/openExternalLink";
import { Button, SectionHeader, cx } from "@/components/v2/ui";
import { SubScreen } from "./SubScreen";

const APP_STORE_URL = "https://apps.apple.com/kr/app/id6793290752";
const PORTABLE_DOWNLOAD_URL = "https://github.com/appfle-io/packinbag-app/releases/latest";

// 포터블(Electron)은 로컬 서버로 돌아서 웹 배포와 비교할 수 없다 → 다운로드 페이지 안내만
function isPortable(): boolean {
  return typeof window !== "undefined" && !!(window as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron;
}

type CheckState = { kind: "checking" } | { kind: UpdateKind } | { kind: "error" } | { kind: "portable" };

// 새 버전 확인(SET-VER-04~07). 화면을 열 때 한 번 + "다시 확인". 주기적으로 확인하지 않는다
function useUpdateCheck(): { state: CheckState; recheck: () => void } {
  // 이 화면은 눌러서 여는 하위 화면이라 서버 렌더가 없다(초깃값에 window를 봐도 됨)
  const [state, setState] = useState<CheckState>(() => (isPortable() ? { kind: "portable" } : { kind: "checking" }));
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => {
    setState({ kind: "checking" });
    setRound((r) => r + 1);
  }, []);
  useEffect(() => {
    if (isPortable()) return;
    let cancelled = false;
    const run = async () => {
      try {
        const native = Capacitor.isNativePlatform() ? (await App.getInfo().catch(() => null))?.version ?? null : null;
        const res = await fetch("/api/build-info", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { buildId?: string; storeVersion?: string | null };
        const kind = decideUpdate({ clientBuild: BUILD_ID, serverBuild: data.buildId, nativeVersion: native, storeVersion: data.storeVersion });
        if (!cancelled) setState({ kind });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [round]);
  return { state, recheck };
}

// 사용자에게는 "새 버전이 있어요 · 업데이트" 하나. App Store로 갈지 다시 불러올지는 여기서 고른다
function UpdateRow({ state, recheck }: { state: CheckState; recheck: () => void }) {
  if (state.kind === "checking") return <span className="text-caption text-sub">새 버전을 확인하고 있어요</span>;
  if (state.kind === "latest")
    return (
      <span className="flex items-center gap-1 text-caption font-semibold text-brand">
        <IconCircleCheck size={16} stroke={2} aria-hidden="true" />
        최신 버전이에요
      </span>
    );
  if (state.kind === "store" || state.kind === "web")
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-caption font-semibold text-ink">새 버전이 있어요</span>
        <Button
          size="sm"
          onClick={() => (state.kind === "store" ? openExternalLink(APP_STORE_URL) : window.location.reload())}
        >
          업데이트
        </Button>
      </div>
    );
  if (state.kind === "portable")
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-caption text-sub">새 버전은 다운로드 페이지에서 받아요</span>
        <Button size="sm" variant="secondary" onClick={() => openExternalLink(PORTABLE_DOWNLOAD_URL)}>
          다운로드 페이지
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-caption text-sub">새 버전을 확인하지 못했어요</span>
      <Button size="sm" variant="secondary" onClick={recheck}>
        다시 확인
      </Button>
    </div>
  );
}

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
  const update = useUpdateCheck();
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
        <div className="mt-3" aria-live="polite">
          <UpdateRow state={update.state} recheck={update.recheck} />
        </div>
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
