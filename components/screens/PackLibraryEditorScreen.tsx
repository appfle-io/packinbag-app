"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconTrash,
  IconSquareCheck,
  IconAlignLeft,
} from "@tabler/icons-react";
import { Item, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import EditableText from "@/components/EditableText";
import ItemRow from "@/components/ItemRow";
import ConfirmDialog from "@/components/ConfirmDialog";
import PackColorDot from "@/components/PackColorDot";
import { useToast } from "@/components/Toast";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  const { show } = useToast();
  const { profile } = useAuth();
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const displayItems = moveCompletedToBottom
    ? [...pack.items].sort(
        (a, b) =>
          Number(a.type === "check" && !!a.checked) - Number(b.type === "check" && !!b.checked)
      )
    : pack.items;

  const addItem = (type: "check" | "text") =>
    setPack((p) => ({
      ...p,
      items: [...p.items, { id: uid(), type, text: "", checked: false } as Item],
    }));

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

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex items-center gap-2 mb-4">
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

        <div
          className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]"
          style={{
            gap: "8px 10px",
          }}
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

        {pack.items.length === 0 && (
          <p className="text-[13px] text-text-muted py-6 text-center">
            아래 버튼으로 짐을 추가해보세요.
          </p>
        )}

        <div className="flex gap-4 pt-3 border-t border-border text-[13px] text-text-secondary">
          <button onClick={() => addItem("check")} className="flex items-center gap-1.5">
            <IconSquareCheck size={15} stroke={1.75} />
            체크항목 추가
          </button>
          <button onClick={() => addItem("text")} className="flex items-center gap-1.5">
            <IconAlignLeft size={15} stroke={1.75} />
            텍스트 추가
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
