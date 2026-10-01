"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { Bag, Item, Pack } from "@/lib/types";
import { Button, CheckMark, ListRow, SectionHeader, SegmentedControl, Sheet } from "@/components/v2/ui";

// 팩 보관함 체크리스트 팩 화면(PackEditorV2)이 쓰는 시트들.

// --- 아이템 길게 누르기: 이름 · 종류 · 여러 개 선택 · 옮기기 · 복제 · 삭제 ---------------------------
export function LibraryItemSheet({
  item,
  onClose,
  onSave,
  onSelectMany,
  onMove,
  onDuplicate,
  onDelete,
}: {
  item: Item | null;
  onClose: () => void;
  onSave: (patch: { text?: string; type?: Item["type"] }) => void;
  onSelectMany: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={!!item} onClose={onClose} showClose={false}>
      {item && (
        <ItemBody
          key={item.id}
          item={item}
          onClose={onClose}
          onSave={onSave}
          onSelectMany={onSelectMany}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </Sheet>
  );
}

function ItemBody({
  item,
  onClose,
  onSave,
  onSelectMany,
  onMove,
  onDuplicate,
  onDelete,
}: {
  item: Item;
  onClose: () => void;
  onSave: (patch: { text?: string; type?: Item["type"] }) => void;
  onSelectMany: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [type, setType] = useState<Item["type"]>(item.type);
  const rowCls = "flex min-h-13 items-center border-b border-line bg-transparent text-left text-body";

  const save = () => {
    const patch: { text?: string; type?: Item["type"] } = {};
    if (text.trim() && text.trim() !== item.text) patch.text = text.trim();
    if (type !== item.type) patch.type = type;
    if (Object.keys(patch).length > 0) onSave(patch);
    onClose();
  };
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-sub">이름</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-12 rounded-field border border-line bg-card px-4 text-body-lg font-semibold outline-none focus:border-ink"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-sub">종류</span>
        <SegmentedControl
          label="아이템 종류"
          value={type}
          onChange={setType}
          options={[
            { value: "check", label: "체크 항목" },
            { value: "text", label: "글" },
          ]}
        />
      </div>
      <div className="flex flex-col rounded-card border border-line bg-card px-4">
        <button type="button" className={rowCls} onClick={then(onSelectMany)}>
          여러 개 선택
        </button>
        <button type="button" className={rowCls} onClick={then(onMove)}>
          다른 팩으로 옮기기
        </button>
        <button type="button" className={rowCls} onClick={then(onDuplicate)}>
          복제
        </button>
        <button type="button" className="flex min-h-13 items-center bg-transparent text-left text-body text-alert" onClick={then(onDelete)}>
          삭제
        </button>
      </div>
      <Button type="submit" block>
        완료
      </Button>
    </form>
  );
}

// --- 옮길 곳: 보관함 팩 또는 가방 → 그 가방의 팩 -------------------------------------------------
export type MoveDestination = { kind: "library"; packId: string } | { kind: "bag"; bagId: string; packId: string };

export function MoveDestSheet({
  open,
  count,
  libraryPacks,
  bags,
  onPick,
  onClose,
}: {
  open: boolean;
  count: number;
  // 옮길 수 있는 보관함 체크리스트 팩(지금 팩 제외)
  libraryPacks: Pack[];
  // 옮길 수 있는 가방(잠기지 않고 체크리스트 팩이 있는 것)
  bags: Bag[];
  onPick: (dest: MoveDestination) => void;
  onClose: () => void;
}) {
  const [bagId, setBagId] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setBagId(null);
  }
  const bag = bagId ? bags.find((b) => b.id === bagId) : undefined;
  const pick = (dest: MoveDestination) => {
    onPick(dest);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={bag ? bag.name : `${count}개 옮기기`} size="tall">
      {bag ? (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setBagId(null)}
            className="flex min-h-11 items-center gap-1 bg-transparent text-caption font-semibold text-sub active:text-ink"
          >
            <IconChevronLeft size={16} stroke={2} aria-hidden="true" />
            옮길 곳 다시 고르기
          </button>
          {bag.packs
            .filter((p) => p.kind !== "editor" && p.type !== "folder")
            .map((p, i, arr) => (
              <ListRow
                key={p.id}
                divider={i < arr.length - 1}
                title={p.name}
                trailing={`${p.items.length}개`}
                onClick={() => pick({ kind: "bag", bagId: bag.id, packId: p.id })}
              />
            ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col">
            <SectionHeader>보관함 팩</SectionHeader>
            {libraryPacks.length === 0 ? (
              <p className="m-0 py-3 text-caption text-faint">옮길 수 있는 보관함 팩이 없어요</p>
            ) : (
              libraryPacks.map((p, i) => (
                <ListRow
                  key={p.id}
                  divider={i < libraryPacks.length - 1}
                  title={p.name}
                  trailing={`${p.items.length}개`}
                  onClick={() => pick({ kind: "library", packId: p.id })}
                />
              ))
            )}
          </section>
          <section className="flex flex-col">
            <SectionHeader>가방 속 팩</SectionHeader>
            {bags.length === 0 ? (
              <p className="m-0 py-3 text-caption text-faint">옮길 수 있는 가방이 없어요</p>
            ) : (
              bags.map((b, i) => (
                <ListRow
                  key={b.id}
                  divider={i < bags.length - 1}
                  title={b.name}
                  subtitle={`팩 ${b.packs.filter((p) => p.kind !== "editor" && p.type !== "folder").length}개`}
                  trailing={<IconChevronRight size={16} stroke={1.75} className="text-faint" aria-hidden="true" />}
                  onClick={() => setBagId(b.id)}
                />
              ))
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

// --- 같이 추가할 팩 고르기(아래 입력창으로 넣는 아이템을 이 팩들에도 복사) ---------------------------
export function AlsoAddSheet({
  open,
  packs,
  selectedIds,
  onChange,
  onClose,
}: {
  open: boolean;
  // 지금 팩을 뺀 보관함 체크리스트 팩
  packs: Pack[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="다른 팩에도 같이 추가"
      size="tall"
      footer={
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="secondary" className="flex-1" onClick={() => onChange([])}>
              모두 해제
            </Button>
          )}
          <Button className="flex-1" onClick={onClose}>
            {selectedIds.length > 0 ? `${selectedIds.length}개 팩에도 추가` : "완료"}
          </Button>
        </div>
      }
    >
      <p className="m-0 pb-2 text-caption text-sub">고른 팩에는 아래에서 적는 아이템이 복사본으로 같이 들어가요. 이 화면을 나가면 다시 지금 팩에만 추가돼요.</p>
      {packs.length === 0 ? (
        <p className="m-0 py-6 text-center text-caption text-faint">같이 추가할 수 있는 다른 팩이 없어요</p>
      ) : (
        <div className="flex flex-col">
          {packs.map((p, i) => (
            <ListRow
              key={p.id}
              divider={i < packs.length - 1}
              role="checkbox"
              aria-checked={selectedIds.includes(p.id)}
              leading={<CheckMark checked={selectedIds.includes(p.id)} shape="square" />}
              title={p.name}
              trailing={`${p.items.length}개`}
              onClick={() => toggle(p.id)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
