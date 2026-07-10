"use client";

import { useState } from "react";
import {
  IconX,
  IconSquareCheck,
  IconAlignLeft,
  IconBold,
  IconStrikethrough,
} from "@tabler/icons-react";
import Portal from "@/components/Portal";
import PackChipBar from "@/components/PackChipBar";
import { ItemType, Pack } from "@/lib/types";
import { TEXT_COLORS } from "@/components/ItemRow";

export interface ItemFormSaveData {
  type: ItemType;
  text: string;
  bold?: boolean;
  strike?: boolean;
  color?: string;
}

// 짐 추가/수정용 중앙 모달.
// - selectionMode="single": 가방 속 팩 편집 - 담을 팩을 하나만 고른다(라디오형).
// - selectionMode="multi": 팩 라이브러리 편집 - 라이브러리의 모든 팩을 체크박스로
//   보여주고, 체크된 모든 팩에 동시에 추가/복사된다.
// 삭제는 이 모달의 책임이 아니다 - 짐 목록의 오른쪽 스와이프 삭제로만 가능하고,
// 이 모달에서는 필수값(텍스트/팩 선택)이 비어있으면 저장을 막고 안내만 보여준다.
export default function ItemFormModal({
  packs,
  selectionMode,
  initialSelectedPackIds,
  mode,
  initialType,
  initialText = "",
  initialBold = false,
  initialStrike = false,
  initialColor = "",
  onClose,
  onSave,
}: {
  packs: Pack[];
  selectionMode: "single" | "multi";
  initialSelectedPackIds: string[];
  mode: "add" | "edit";
  initialType: ItemType;
  initialText?: string;
  initialBold?: boolean;
  initialStrike?: boolean;
  initialColor?: string;
  onClose: () => void;
  onSave: (targetPackIds: string[], data: ItemFormSaveData) => void;
}) {
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(initialSelectedPackIds);
  const [type, setType] = useState<ItemType>(initialType);
  const [text, setText] = useState(initialText);
  const [bold, setBold] = useState(initialBold);
  const [strike, setStrike] = useState(initialStrike);
  const [color, setColor] = useState(initialColor);

  const handleSelectPack = (packId: string) => {
    if (selectionMode === "single") {
      setSelectedPackIds([packId]);
      return;
    }
    setSelectedPackIds((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  const textEmpty = text.trim() === "";
  const noPackSelected = selectedPackIds.length === 0;
  const canSave = !textEmpty && !noPackSelected;

  const handleSave = () => {
    if (!canSave) return;
    onSave(selectedPackIds, {
      type,
      text,
      ...(type === "text" ? { bold, strike, color: color || undefined } : {}),
    });
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[96] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">
              {mode === "add" ? "짐 추가" : "짐 수정"}
            </span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <PackChipBar
              packs={packs}
              label={selectionMode === "single" ? "담을 팩" : "담을 팩 (여러개 선택 가능)"}
              onSelectPack={handleSelectPack}
              getState={(packId) =>
                selectedPackIds.includes(packId) ? "selected" : "normal"
              }
            />
            {noPackSelected && (
              <p className="text-[11px] pl-1" style={{ color: "var(--danger)" }}>
                담을 팩을 선택해주세요.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("check")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-medium"
              style={{
                background: type === "check" ? "var(--accent)" : "var(--surface-2)",
                color: type === "check" ? "#fff" : "var(--text-secondary)",
              }}
            >
              <IconSquareCheck size={16} stroke={1.75} />
              체크항목
            </button>
            <button
              type="button"
              onClick={() => setType("text")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-medium"
              style={{
                background: type === "text" ? "var(--accent)" : "var(--surface-2)",
                color: type === "text" ? "#fff" : "var(--text-secondary)",
              }}
            >
              <IconAlignLeft size={16} stroke={1.75} />
              텍스트
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === "check" ? "짐 이름" : "텍스트 입력"}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[15px] outline-none resize-none"
              style={{
                fontWeight: type === "text" && bold ? 700 : 400,
                textDecoration: type === "text" && strike ? "line-through" : "none",
                color: type === "text" ? color || "var(--foreground)" : "var(--foreground)",
              }}
            />
            {textEmpty && (
              <p className="text-[11px] pl-1" style={{ color: "var(--danger)" }}>
                텍스트를 입력해주세요.
              </p>
            )}
          </div>

          {type === "text" && (
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setBold((b) => !b)}
                aria-label="굵게"
                className="flex items-center justify-center rounded shrink-0"
                style={{
                  background: bold ? "var(--accent)" : "var(--surface-2)",
                  color: bold ? "#fff" : "var(--text-secondary)",
                  width: 30,
                  height: 30,
                }}
              >
                <IconBold size={16} stroke={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setStrike((s) => !s)}
                aria-label="취소선"
                className="flex items-center justify-center rounded shrink-0"
                style={{
                  background: strike ? "var(--accent)" : "var(--surface-2)",
                  color: strike ? "#fff" : "var(--text-secondary)",
                  width: 30,
                  height: 30,
                }}
              >
                <IconStrikethrough size={16} stroke={2.25} />
              </button>
              <span
                className="shrink-0"
                style={{ width: 1, height: 18, background: "var(--border)" }}
              />
              {TEXT_COLORS.map((c) => (
                <button
                  key={c || "default"}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c ? `색상 ${c}` : "기본 색상"}
                  className="rounded-full shrink-0"
                  style={{
                    background: c || "var(--surface-2)",
                    border:
                      color === c
                        ? "1.5px solid var(--foreground)"
                        : "1.5px solid var(--border-strong)",
                    width: 24,
                    height: 24,
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg py-2.5 text-[14px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: canSave ? "var(--accent)" : "var(--surface-2)",
                color: canSave ? "#fff" : "var(--text-muted)",
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
