"use client";

import Portal from "@/components/Portal";

import { useState } from "react";
import { Pack } from "@/lib/types";

export default function SaveAsDialog({
  suggestedName,
  libraryPacks,
  onCancel,
  onConfirm,
}: {
  suggestedName: string;
  libraryPacks: Pack[];
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(suggestedName);

  const trimmed = name.trim();
  const collides = libraryPacks.some((p) => p.name.trim() === trimmed);
  const disabled = trimmed.length === 0 || collides;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[97] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onCancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div>
            <p className="text-[14px] font-medium mb-1">
              동일한 이름의 팩이 있어요
            </p>
            <p className="text-[12px] text-text-secondary">
              다른 이름으로 저장할까요?
            </p>
          </div>

          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />
          {collides && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              이 이름도 이미 있어요.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border py-2 text-[13px]"
            >
              취소
            </button>
            <button
              onClick={() => onConfirm(trimmed)}
              disabled={disabled}
              className="flex-1 rounded-lg py-2 text-[13px] font-medium disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
