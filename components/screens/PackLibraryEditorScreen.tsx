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
import { useSwipeBack } from "@/lib/useSwipeBack";
import EditableText from "@/components/EditableText";
import ItemRow from "@/components/ItemRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import PackColorDot from "@/components/PackColorDot";
import { useToast } from "@/components/Toast";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 텍스트 항목 색상 팔레트 (ItemRow의 편집 툴바와 동일 구성)
const TEXT_COLORS = ["", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7"];

// 팩 편집 화면: 채팅방처럼 하단에 입력창을 고정해두고, 짐을 입력해서 보내면
// 입력창 바로 위 목록에 쌓인다. 기본은 체크박스 항목이고, 위쪽 모드 선택(체크박스/텍스트)
// 중 지금 고른 쪽이 굵게+확대+강조색으로 표시된다. 텍스트 모드면 서식 옵션이 추가로
// 나타난다. 이미 추가된 짐은 기존과 동일하게 오른쪽 스와이프=수정, 왼쪽 스와이프=삭제로
// 조작하고, 체크박스 제외 영역을 롱프레스하면(그립 아이콘 없음) 같은 팩 안에서 순서를
// 바꿀 수 있다.
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
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
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

  // --- 짐 순서 변경(롱프레스 드래그) ------------------------------------
  // 팩이 하나뿐인 화면이라 "다른 팩으로 이동"은 필요 없고, 같은 팩 안에서
  // 순서만 바꾼다. "가방 속 팩"과 동일하게 그립 아이콘 없이 롱프레스로 시작.
  const [drag, setDrag] = useState<{ itemId: string; overItemId: string | null } | null>(null);

  const handleStartItemDrag = (itemId: string) => {
    setDrag({ itemId, overItemId: null });
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
      const overItemId = itemEl?.getAttribute("data-item-id") ?? null;
      setDrag((d) => (d ? { ...d, overItemId } : d));
    };

    const handleUp = () => {
      setDrag((d) => {
        if (d && d.overItemId && d.overItemId !== d.itemId) {
          setPack((p) => {
            const item = p.items.find((i) => i.id === d.itemId);
            if (!item) return p;
            const without = p.items.filter((i) => i.id !== d.itemId);
            const targetIndex = without.findIndex((i) => i.id === d.overItemId);
            if (targetIndex === -1) return p;
            return {
              ...p,
              items: [
                ...without.slice(0, targetIndex),
                item,
                ...without.slice(targetIndex),
              ],
            };
          });
        }
        return null;
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  // iOS Safari는 키보드가 올라올 때 "레이아웃 뷰포트" 크기는 그대로 두고 화면을
  // 슬쩍 스크롤시켜서 포커스된 입력창을 보여주는 방식으로 동작한다. 이 화면은
  // 부모가 100dvh(=키보드를 반영하지 않는 값)라서 그 스크롤이 헤더까지 밀어버리고,
  // 입력창은 오히려 키보드에 가려 안 보이게 된다. 대신 실제로 보이는 영역의 높이인
  // visualViewport.height를 이 화면의 높이로 직접 지정해서, 키보드가 올라온 만큼
  // 화면 자체가 줄어들도록 한다 — 그러면 브라우저가 스크롤로 보정할 필요가 없어져서
  // 상단 헤더는 그 자리에 그대로 있고, 입력창은 항상 키보드 바로 위에 보인다.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={swipeBackRef}
      className="flex flex-col overflow-hidden h-dvh"
      style={viewportHeight != null ? { height: `${viewportHeight}px` } : undefined}
    >
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
          여러 열로 재배치된다(auto-fit). 오른쪽 스와이프=수정, 왼쪽 스와이프=삭제,
          체크박스 제외 영역 롱프레스=순서변경 드래그 시작. */}
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
                onStartDrag={() => handleStartItemDrag(item.id)}
                isDragSource={drag?.itemId === item.id}
                isDragOverTarget={drag?.overItemId === item.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* 채팅형 입력창: 체크박스/텍스트 선택(선택된 쪽이 굵게+확대+강조색) +
          (텍스트 모드일 때) 서식 옵션 + 입력창 + 확인(전송) 버튼 */}
      <div
        className="shrink-0 border-t border-border p-3 flex flex-col gap-2"
        style={{ paddingBottom: "max(22px, calc(env(safe-area-inset-bottom) + 10px))" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setInputMode("check")}
            className="flex items-center gap-1.5"
            style={{
              color: inputMode === "check" ? "var(--accent)" : "var(--text-muted)",
              fontWeight: inputMode === "check" ? 700 : 400,
              fontSize: inputMode === "check" ? 14 : 12.5,
              transition: "font-size 120ms ease, color 120ms ease",
            }}
          >
            <IconSquareCheck size={inputMode === "check" ? 17 : 14} stroke={1.75} />
            체크박스
          </button>
          <button
            onClick={() => setInputMode("text")}
            className="flex items-center gap-1.5"
            style={{
              color: inputMode === "text" ? "var(--accent)" : "var(--text-muted)",
              fontWeight: inputMode === "text" ? 700 : 400,
              fontSize: inputMode === "text" ? 14 : 12.5,
              transition: "font-size 120ms ease, color 120ms ease",
            }}
          >
            <IconAlignLeft size={inputMode === "text" ? 17 : 14} stroke={1.75} />
            텍스트
          </button>
        </div>

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
