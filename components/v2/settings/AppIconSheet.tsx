"use client";

import { useState } from "react";
import { IconCheck, IconLock } from "@tabler/icons-react";
import BackpackLogo from "@/components/BackpackLogo";
import { useToast } from "@/components/Toast";
import { Sheet, cx } from "@/components/v2/ui";
import type { AccentPreset } from "@/lib/types";
import { ACCENTS, DEFAULT_ACCENT } from "@/lib/v2/accent";
import { setAppIcon } from "@/lib/v2/nativeBridge";

// 설정 > 화면 > 앱 아이콘(SET-DISP-09, 아이폰 앱 1.13). 강조색과 따로 고르고 이 기기에만 적용된다(iOS가 기억, 계정 저장 없음)
export function AppIconSheet({
  open,
  onClose,
  value,
  onChanged,
  locked,
  onLocked,
}: {
  open: boolean;
  onClose: () => void;
  value: AccentPreset | null;
  onChanged: (id: AccentPreset) => void;
  locked: boolean;
  onLocked: () => void;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async (id: AccentPreset) => {
    if (busy || id === value) return;
    setBusy(true);
    try {
      await setAppIcon(id);
      onChanged(id);
    } catch {
      show("앱 아이콘을 바꾸지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="앱 아이콘">
      <div role="radiogroup" aria-label="앱 아이콘" className="flex flex-col">
        {ACCENTS.map((a, i) => {
          const selected = a.id === value;
          const lockedRow = locked && a.id !== DEFAULT_ACCENT;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={lockedRow || undefined}
              onClick={() => (lockedRow ? onLocked() : pick(a.id))}
              className={cx("flex min-h-14 w-full items-center gap-3 bg-transparent py-2 text-left transition-colors duration-160 ease-snappy active:bg-fill", i < ACCENTS.length - 1 && "border-b border-line")}
            >
              <BackpackLogo size={40} accent={a.id} />
              <span className={cx("min-w-0 flex-1 truncate text-body text-ink", selected ? "font-bold" : "font-medium")}>
                {a.label}
                {a.id === DEFAULT_ACCENT && <span className="ml-1 font-normal text-faint">기본</span>}
              </span>
              {selected && <IconCheck size={20} stroke={2.2} className="shrink-0 text-brand" aria-hidden="true" />}
              {lockedRow && <IconLock size={18} stroke={1.75} className="shrink-0 text-faint" aria-label="프리미엄" />}
            </button>
          );
        })}
      </div>
      <p className="m-0 pt-3 text-caption text-faint">이 아이폰의 홈 화면 아이콘만 바뀌어요. 바꾸면 아이폰이 안내 창을 한 번 띄워요.</p>
    </Sheet>
  );
}
