"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { hexToHsv, hsvToHex } from "@/lib/colorMath";
import Portal from "@/components/Portal";

// 네이티브 <input type="color">가 iOS에서 홈화면에 추가한 PWA(standalone) 상태일 때
// 색상 선택 다이얼로그 자체가 안 열리는 WebKit 이슈가 있어서, 웹/iOS PWA/향후 앱
// (Capacitor WebView) 어디서든 동일하게 동작하도록 직접 그리는 피커로 대체했다.
export default function ColorPickerPopover({
  initialHex,
  onChange,
  onClose,
}: {
  initialHex: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const parsed = hexToHsv(initialHex) ?? { h: 0, s: 1, v: 1 };
  const [h, setH] = useState(parsed.h);
  const [s, setS] = useState(parsed.s);
  const [v, setV] = useState(parsed.v);
  const [hexInput, setHexInput] = useState(initialHex.toUpperCase());
  const hex = hsvToHex(h, s, v);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"sv" | "hue" | null>(null);

  const commit = (nh: number, ns: number, nv: number) => {
    const nextHex = hsvToHex(nh, ns, nv);
    setHexInput(nextHex.toUpperCase());
    onChange(nextHex);
  };

  const updateFromSvPointer = (clientX: number, clientY: number) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ns = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    setS(ns);
    setV(nv);
    commit(h, ns, nv);
  };

  const updateFromHuePointer = (clientX: number) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nh = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    setH(nh);
    commit(nh, s, v);
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (draggingRef.current === "sv") updateFromSvPointer(e.clientX, e.clientY);
      else if (draggingRef.current === "hue") updateFromHuePointer(e.clientX);
    };
    const handleUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, s, v]);

  const handleHexInputChange = (text: string) => {
    setHexInput(text);
    const next = hexToHsv(text);
    if (next) {
      setH(next.h);
      setS(next.s);
      setV(next.v);
      onChange(hsvToHex(next.h, next.s, next.v));
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-medium">색상 선택</p>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} />
            </button>
          </div>

          <div
            ref={svRef}
            onPointerDown={(e) => {
              draggingRef.current = "sv";
              updateFromSvPointer(e.clientX, e.clientY);
            }}
            className="relative w-full rounded-lg overflow-hidden select-none"
            style={{
              height: 160,
              touchAction: "none",
              background: `hsl(${h}, 100%, 50%)`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, #fff, rgba(255,255,255,0))" }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, #000, rgba(0,0,0,0))" }}
            />
            <div
              className="absolute h-4 w-4 rounded-full border-2 border-white shadow pointer-events-none"
              style={{
                left: `${s * 100}%`,
                top: `${(1 - v) * 100}%`,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.4)",
              }}
            />
          </div>

          <div
            ref={hueRef}
            onPointerDown={(e) => {
              draggingRef.current = "hue";
              updateFromHuePointer(e.clientX);
            }}
            className="relative w-full rounded-full select-none"
            style={{
              height: 16,
              touchAction: "none",
              background:
                "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          >
            <div
              className="absolute rounded-full border-2 border-white pointer-events-none"
              style={{
                height: 20,
                width: 20,
                top: "50%",
                left: `${(h / 360) * 100}%`,
                transform: "translate(-50%, -50%)",
                background: `hsl(${h}, 100%, 50%)`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.4)",
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg shrink-0 border border-border"
              style={{ background: hex }}
            />
            <input
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              placeholder="#3B82F6"
              maxLength={7}
              className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none uppercase"
            />
          </div>

          <button
            onClick={onClose}
            className="rounded-lg py-2.5 text-[13px] font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            완료
          </button>
        </div>
      </div>
    </Portal>
  );
}
