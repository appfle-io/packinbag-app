"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconX,
  IconSquareCheck,
  IconAlignLeft,
  IconBold,
  IconStrikethrough,
  IconPlus,
} from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { ItemType, Pack } from "@/lib/types";
import { TEXT_COLORS } from "@/components/ItemRow";

export interface QuickAddItemData {
  type: ItemType;
  text: string;
  bold?: boolean;
  strike?: boolean;
  color?: string;
}

// 팩 목록 안에 실제로 존재할 수 없는 값이라 "새 팩" 칩의 선택 상태를 표현하는
// 용도로 안전하게 쓸 수 있다.
const NEW_PACK_ID = "__new_pack__";

// ItemFormModal과 동일한 iOS 키보드 대응(visualViewport 기준 높이/오프셋) - 이 모달도
// 텍스트 입력이 있어서 같은 처리가 필요하다.
function useVisualViewport() {
  const getRect = () => {
    if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
    const vv = window.visualViewport;
    return vv
      ? { height: vv.height, offsetTop: vv.offsetTop }
      : { height: window.innerHeight, offsetTop: 0 };
  };
  const [rect, setRect] = useState(getRect);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setRect({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return rect;
}

// 메모장뷰 상단 "+" 버튼으로 여는 통합 짐 추가 모달. 예전에는 각 팩 섹션 하단마다
// 따로 "항목 추가" 버튼이 있었는데, 이걸 하나로 모아서: 어느 팩에 넣을지부터 고르고
// (없으면 그 자리에서 이름까지 지어 새 팩을 만들어 저장) 체크/텍스트 타입과 서식까지
// 고른 뒤 추가한다. 저장해도 모달이 닫히지 않고 입력창만 비워져서 연속으로 여러 개를
// 넣을 수 있다 - 새 팩을 만들어서 첫 항목을 넣은 뒤에는 선택이 그 팩으로 자동으로
// 넘어가서, 이어지는 입력이 계속 같은 팩에 쌓인다(QuickAddModal의 연속입력과 같은 원리).
export default function NotebookQuickAddModal({
  packs,
  onClose,
  onAddToPack,
  onCreatePack,
}: {
  packs: Pack[];
  onClose: () => void;
  onAddToPack: (packId: string, data: QuickAddItemData) => void;
  // 새 팩을 만들고 첫 항목까지 넣은 뒤, 그 팩의 새 id를 동기적으로 돌려준다
  // (이후 입력은 이 id로 계속 이어짐. 10개 캡 등으로 실패하면 null).
  onCreatePack: (name: string, data: QuickAddItemData) => string | null;
}) {
  const [selectedId, setSelectedId] = useState<string>(packs[0]?.id ?? NEW_PACK_ID);
  const [newPackName, setNewPackName] = useState("새 팩");
  const [type, setType] = useState<ItemType>("check");
  const [text, setText] = useState("");
  const [bold, setBold] = useState(false);
  const [strike, setStrike] = useState(false);
  const [color, setColor] = useState("");
  const [addedCount, setAddedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { height: viewportHeight, offsetTop: viewportOffsetTop } = useVisualViewport();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const textEmpty = text.trim() === "";
  const canSave = !textEmpty;

  const handleSave = () => {
    if (!canSave) return;
    const data: QuickAddItemData = {
      type,
      text: text.trim(),
      ...(type === "text" ? { bold, strike, color: color || undefined } : {}),
    };
    if (selectedId === NEW_PACK_ID) {
      const createdId = onCreatePack(newPackName, data);
      if (!createdId) return; // 10개 캡 등으로 실패 - 모달은 열어둔 채로 그대로 둔다
      setSelectedId(createdId);
    } else {
      onAddToPack(selectedId, data);
    }
    setAddedCount((c) => c + 1);
    setText("");
    setBold(false);
    setStrike(false);
    setColor("");
    inputRef.current?.focus();
  };

  return (
    <Portal>
      <div
        className="fixed inset-x-0 z-[96] flex items-center justify-center p-4"
        style={{ top: viewportOffsetTop, height: viewportHeight, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-4 overflow-y-auto"
          style={{ maxHeight: "100%" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">항목 추가</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-text-muted pl-1">담을 팩</span>
            <div className="flex items-center gap-2 flex-wrap">
              {packs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="shrink-0 rounded-full px-4 py-2.5 text-[14px] font-medium whitespace-nowrap"
                  style={{
                    background: selectedId === p.id ? "var(--accent)" : "var(--surface-2)",
                    color: selectedId === p.id ? "#fff" : undefined,
                  }}
                >
                  {p.name || "팩"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedId(NEW_PACK_ID)}
                className="shrink-0 flex items-center gap-1 rounded-full px-4 py-2.5 text-[14px] font-medium whitespace-nowrap"
                style={{
                  background: selectedId === NEW_PACK_ID ? "var(--accent)" : "var(--surface-2)",
                  color: selectedId === NEW_PACK_ID ? "#fff" : "var(--accent)",
                }}
              >
                <IconPlus size={14} stroke={2} />
                새 팩
              </button>
            </div>
            {selectedId === NEW_PACK_ID && (
              <input
                value={newPackName}
                onChange={(e) => setNewPackName(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="새 팩 이름"
                className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] outline-none"
              />
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
              <span className="shrink-0" style={{ width: 1, height: 18, background: "var(--border)" }} />
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

          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder={type === "check" ? "짐 이름" : "텍스트 입력"}
            className="min-w-0 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[15px] outline-none"
            style={{
              fontWeight: type === "text" && bold ? 700 : 400,
              textDecoration: type === "text" && strike ? "line-through" : "none",
              color: type === "text" ? color || "var(--foreground)" : "var(--foreground)",
            }}
          />

          <div className="flex items-center justify-between gap-2">
            {addedCount > 0 ? (
              <span className="text-[11px] text-text-muted pl-1">{addedCount}개 추가함</span>
            ) : (
              <span />
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg px-6 py-2.5 text-[14px] font-medium"
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
