"use client";

import { useState } from "react";
import { PACK_COLORS, getPackColorHex } from "@/lib/packColors";
import Portal from "@/components/Portal";

// 팩 이름 옆에 붙는 작은 색상 점. 누르면 팔레트가 열려서 색을 고를 수 있다.
export default function PackColorDot({
  colorId,
  onChange,
}: {
  colorId?: string;
  onChange: (colorId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const hex = getPackColorHex(colorId);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="팩 색상 선택"
        className="h-3 w-3 rounded-full shrink-0"
        style={{
          background: hex ?? "transparent",
          border: hex ? "none" : "1.5px dashed var(--border-strong)",
        }}
      />
      {open && (
        <>
          <Portal>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
          </Portal>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 top-5 left-0 flex flex-wrap gap-1.5 rounded-xl p-2 shadow-lg"
            style={{
              width: 128,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {PACK_COLORS.map((c) => {
              const isSelected = colorId === c.id || (!colorId && c.id === "none");
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id === "none" ? undefined : c.id);
                    setOpen(false);
                  }}
                  aria-label={c.label}
                  className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: c.hex || "transparent",
                    border: c.hex
                      ? "none"
                      : "1.5px dashed var(--border-strong)",
                    boxShadow: isSelected ? "0 0 0 2px var(--accent)" : "none",
                  }}
                >
                  {!c.hex && (
                    <span
                      className="text-[9px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
