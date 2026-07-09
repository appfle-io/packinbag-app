"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconTrash,
  IconSquareCheck,
  IconAlignLeft,
  IconBold,
  IconStrikethrough,
  IconArrowUp,
} from "@tabler/icons-react";
import { Item, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import EditableText from "@/components/EditableText";
import ItemRow from "@/components/ItemRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import PackColorDot from "@/components/PackColorDot";
import { useToast } from "@/components/Toast";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 텍스트 항목 색상 팔레트 (ItemRow의 편집 툴바와 동일 구성)
const TEXT_COLORS = ["", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7"];

// 팩 편집 화면: 채팅방처럼 하단에 입력창을 고정해두고, 짐을 입력해서 보내면
// 입력창 바로 위 목록에 쌓인다. 기본은 체크박스 항목이고, 위쪽 모드 표시를 탭하면
// 텍스트 항목(서식 지정 가능)으로 전환할 수 있다. 이미 추가된 짐은 기존과 동일하게
// 오른쪽 스와이프=수정, 왼쪽 스와이프=삭제로 조작한다.
export default function PackLibraryEditorScreen({
  initialPack,
  onBack,
  onSave,
  onDelete,
}: {
  initialPack: Pack;
  onBack: () => void;
  onSave: (pack: Pack) => void;
  onDelete: (packId: string) => void;
}) {
  const [pack, setPack] = useState<Pack>(initialPack);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inputMode, setInputMode] = useState<"check" | "text">("check");
  const [draftText, setDraftText] = useState("");
  const [draftBold, setDraftBold] = useState(false);
  const [draftStrike, setDraftStrike] = useState(false);
  const [draftColor, setDraftColor] = useState("");
  const { show } = useToast();
  const { profile } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const displayItems = moveCompletedToBottom
    ? [...pack.items].sort(
        (a, b) =>
          Number(a.type === "check" && !!a.checked) - Number(b.type === "check" && !!b.checked)
      )
    : pack.items;

  const toggleItem = (itemId: string) =>
    setPack((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId ? { ...i, checked: !i.checked } : i
      ),
    }));

  const changeItemText = (
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) =>
    setPack((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              text,
              spans: undefined,
              ...(style
                ? { bold: style.bold, strike: style.strike, color: style.color }
                : null),
            }
          : i
      ),
    }));

  const deleteItem = (itemId: string) =>
    setPack((p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }));

  const handleSubmit = () => {
    const text = draftText.trim();
    if (!text) return;
    const newItem: Item =
      inputMode === "check"
        ? { id: uid(), type: "check", text, checked: false }
        : {
            id: uid(),
            type: "text",
            text,
            bold: draftBold,
            strike: draftStrike,
            color: draftColor || undefined,
          };
    setPack((p) => ({ ...p, items: [...p.items, newItem] }));
    setDraftText("");
  };

  // 짐을 새로 추가하면(= 목록 끝에 쌓이면) 입력창 바로 위, 즉 목록 맨 아래로
  // 자동 스크롤해서 방금 추가한 짐이 바로 보이게 한다.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [pack.items.length]);

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={onBack}>
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg px-2.5 py-1.5"
          >
            <IconTrash size={18} stroke={1.75} color="var(--danger)" />
          </button>
          <button
            onClick={() => {
              onSave(pack);
              show("팩을 저장했어요");
            }}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            저장
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 shrink-0">
        <PackColorDot
          colorId={pack.color}
          onChange={(colorId) => setPack((p) => ({ ...p, color: colorId }))}
        />
        <EditableText
          value={pack.name}
          onChange={(name) => setPack((p) => ({ ...p, name }))}
          className="text-[18px] font-medium block text-left min-w-0 flex-1"
          inputClassName="text-[18px] font-medium block w-full"
          placeholder="새 팩"
        />
      </div>

      {/* 이미 추가된 짐 목록: 1개면 한 줄을 다 채우고, 늘어날수록 반응형으로
          여러 열로 재배치된다(auto-fit). 각 항목은 기존과 동일하게 오른쪽
          스와이프=수정, 왼쪽 스와이프=삭제로 조작 가능. */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-3">
        {displayItems.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">
            아래 입력창으로 짐을 추가해보세요.
          </p>
        ) : (
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
            style={{ gap: "8px 10px", alignItems: "start" }}
          >
            {displayItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={item.type === "check" ? () => toggleItem(item.id) : undefined}
                onChangeText={(text, style) => changeItemText(item.id, text, style)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 채팅형 입력창: 모드 표시(탭해서 체크/텍스트 전환) + (텍스트 모드일 때) 서식
          옵션 + 입력창 + 확인(전송) 버튼 */}
      <div className="shrink-0 border-t border-border p-3 flex flex-col gap-2">
        <button
          onClick={() => setInputMode((m) => (m === "check" ? "text" : "check"))}
          className="self-start flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-text-secondary"
          style={{ background: "var(--surface-2)" }}
        >
          {inputMode === "check" ? (
            <IconSquareCheck size={14} stroke={1.75} />
          ) : (
            <IconAlignLeft size={14} stroke={1.75} />
          )}
          {inputMode === "check" ? "체크박스" : "텍스트"}
        </button>

        {inputMode === "text" && (
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={() => setDraftBold((b) => !b)}
              aria-label="굵게"
              className="flex items-center justify-center rounded shrink-0"
              style={{
                background: draftBold ? "var(--accent)" : "var(--surface)",
                color: draftBold ? "#fff" : "var(--text-secondary)",
                width: 28,
                height: 28,
              }}
            >
              <IconBold size={16} stroke={2.25} />
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={() => setDraftStrike((s) => !s)}
              aria-label="취소선"
              className="flex items-center justify-center rounded shrink-0"
              style={{
                background: draftStrike ? "var(--accent)" : "var(--surface)",
                color: draftStrike ? "#fff" : "var(--text-secondary)",
                width: 28,
                height: 28,
              }}
            >
              <IconStrikethrough size={16} stroke={2.25} />
            </button>
            <span
              className="shrink-0"
              style={{ width: 1, height: 17, background: "var(--border)" }}
            />
            {TEXT_COLORS.map((c) => (
              <button
                key={c || "default"}
                type="button"
                onMouseDown={preventBlur}
                onClick={() => setDraftColor(c)}
                aria-label={c ? `색상 ${c}` : "기본 색상"}
                className="rounded-full shrink-0"
                style={{
                  background: c || "var(--surface)",
                  border:
                    draftColor === c
                      ? "1.5px solid var(--foreground)"
                      : "1.5px solid var(--border-strong)",
                  width: 22,
                  height: 22,
                }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={inputMode === "check" ? "짐 이름" : "텍스트 입력"}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] outline-none"
            style={
              inputMode === "text"
                ? {
                    fontWeight: draftBold ? 700 : 400,
                    textDecoration: draftStrike ? "line-through" : "none",
                    color: draftColor || "var(--foreground)",
                  }
                : undefined
            }
          />
          <button
            onClick={handleSubmit}
            disabled={!draftText.trim()}
            aria-label="짐 추가"
            className="shrink-0 rounded-lg p-2.5 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <IconArrowUp size={18} stroke={2} />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 삭제할까요?"
          message="이미 가방에 불러와진 팩에는 영향 없어요."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete(pack.id);
          }}
        />
      )}
    </div>
  );
}
