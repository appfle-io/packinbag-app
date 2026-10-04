"use client";

import { IconCheck } from "@tabler/icons-react";
import type { AppFontFamily } from "@/lib/types";
import { APP_FONTS } from "@/lib/v2/appFonts";
import { Sheet, cx } from "@/components/v2/ui";

// 설정 > 화면 > 글꼴. 줄마다 그 글꼴로 미리보기를 보여 준다.
// 시트는 열릴 때만 그려지므로(Sheet) 미리보기 글꼴도 이 시트를 열었을 때만 내려받는다.
// 고르면 바로 앱 전체(메모팩 본문 포함)에 적용되고 시트는 열린 채로 둔다(바꿔 보며 비교할 수 있게).
const SAMPLE = "제주 3박 4일 · 선크림 챙기기 Aa 123";

export function FontSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: AppFontFamily;
  onChange: (family: AppFontFamily) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="글꼴">
      <div role="radiogroup" aria-label="글꼴" className="flex flex-col">
        {APP_FONTS.map((f, i) => {
          const selected = f.id === value;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(f.id)}
              className={cx(
                "flex min-h-15 w-full items-center gap-3 bg-transparent py-3 text-left",
                "transition-colors duration-160 ease-snappy active:bg-fill",
                i < APP_FONTS.length - 1 && "border-b border-line",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cx("truncate text-body-lg text-ink", f.previewClass, selected ? "font-bold" : "font-medium")}>
                  {f.label}
                </span>
                <span className={cx("truncate text-body text-sub", f.previewClass)}>{SAMPLE}</span>
                <span className="truncate text-caption text-faint">{f.description}</span>
              </span>
              {selected && <IconCheck size={20} stroke={2.2} className="shrink-0 text-brand" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="m-0 pt-3 text-caption text-faint">메모팩 본문까지 앱 전체에 적용돼요. 메모 속 코드는 항상 D2코딩으로 보여요.</p>
    </Sheet>
  );
}
