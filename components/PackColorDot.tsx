"use client";

import { useEffect, useRef, useState } from "react";
import { PACK_COLORS, getPackColorHex } from "@/lib/packColors";

// 팩 이름 옆에 붙는 작은 색상 점. 누르면 팔레트가 열려서 색을 고를 수 있다.
//
// 팔레트 바깥 아무 곳이나 누르면(색을 고르지 않고) "그냥 닫히기만" 해야 한다 - 그 클릭이
// 밑에 있는 다른 요소(팩/폴더 행 등)에 먹혀서 그게 열려버리면 안 된다. 예전엔 화면 전체를
// 덮는 fixed 백드롭으로 이걸 처리했는데, 팩 트리(PacksScreen)처럼 각 행 자체에 롱프레스/
// 드래그 제스처가 걸려있는 화면에서는 그 백드롭만으로는 부족했다(pointerdown은 막아도
// 뒤이어 오는 click 이벤트가 그대로 밑 요소에 전달됨). 그래서:
// 1) 문서 전체에 캡처 단계 pointerdown 리스너를 걸어서 팔레트 바깥을 눌렀는지 감지하고,
// 2) 그 즉시 팔레트를 닫으면서, 뒤이어 올 click 이벤트 딱 한 번을 캡처 단계에서 가로채
//    완전히 삼켜버린다(preventDefault+stopPropagation) - 이렇게 해야 그 클릭이 밑에 있는
//    팩/폴더 행까지 전달되지 않는다.
export default function PackColorDot({
  colorId,
  onChange,
}: {
  colorId?: string;
  onChange: (colorId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hex = getPackColorHex(colorId);

  useEffect(() => {
    if (!open) return;

    const swallowNextClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("click", swallowNextClick, true);
    };

    const handleOutsidePointerDown = (e: PointerEvent) => {
      if (wrapRef.current && wrapRef.current.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      // 이 pointerdown 뒤에 곧바로 이어지는 click까지 확실히 삼켜서, 밑에 있는 팩/폴더가
      // 열리지 않게 한다(1회용 - 한 번 쓰고 나면 스스로 제거됨).
      document.addEventListener("click", swallowNextClick, true);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
      document.removeEventListener("click", swallowNextClick, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
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
                  border: c.hex ? "none" : "1.5px dashed var(--border-strong)",
                  boxShadow: isSelected ? "0 0 0 2px var(--accent)" : "none",
                }}
              >
                {!c.hex && (
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
