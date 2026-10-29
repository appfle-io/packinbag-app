"use client";

// 설정 > 알림 > 함께 쓰는 가방 알림(2026-10-19). 종류별 토글 3개를 하위 화면 하나로 모았다(_secrets/docs/spec/settings.md SET-PUSH-03 · 08).
// 저장은 부르는 쪽(SettingsScreenV2 togglePush → AuthProvider.updatePushPref)
import type { UserProfile } from "@/lib/types";
import { PUSH_KINDS, type PushKind } from "@/lib/v2/serverPush";
import { Toggle } from "@/components/v2/ui";
import { SubScreen } from "./SubScreen";

// 설정 줄 오른쪽 요약: 모두 켜짐 / N개 켜짐 / 모두 꺼짐
export function pushKindsSummary(prefs: UserProfile["pushPrefs"] | undefined): string {
  const on = PUSH_KINDS.filter(({ kind }) => prefs?.[kind] !== false).length;
  if (on === PUSH_KINDS.length) return "모두 켜짐";
  if (on === 0) return "모두 꺼짐";
  return `${on}개 켜짐`;
}

export function PushSettingsScreen({
  prefs,
  onToggle,
  onBack,
}: {
  prefs: UserProfile["pushPrefs"] | undefined;
  onToggle: (kind: PushKind, label: string, on: boolean) => void;
  onBack: () => void;
}) {
  return (
    <SubScreen title="함께 쓰는 가방 알림" onBack={onBack}>
      <section className="flex flex-col">
        {PUSH_KINDS.map(({ kind, label, description }) => (
          <Toggle
            key={kind}
            checked={prefs?.[kind] !== false}
            onChange={(on) => onToggle(kind, label, on)}
            label={label}
            description={description}
          />
        ))}
        <p className="m-0 pt-2 text-micro text-faint">여기서 끈 알림은 모든 가방에서 오지 않아요. 가방마다 끄려면 가방 더보기 &gt; 알림에서 바꿔요.</p>
      </section>
    </SubScreen>
  );
}
