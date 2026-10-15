"use client";

import { useEffect, useRef, useState } from "react";
import type { Item, Pack } from "@/lib/types";
import type { BagMember, ItemPatch } from "@/hooks/bag";
import { Button, Chip, SectionHeader, SegmentedControl, Sheet } from "@/components/v2/ui";

// 아이템 길게 누르기: 이름 · 담당 · 다른 팩으로 옮기기 · 복제 · 삭제
// 고친 내용은 삭제를 뺀 모든 닫기(완료 · 바깥 · 끌어내리기 · Esc · 다른 줄)에서 저장한다(2026-10-14)
export function ItemSheet({
  target,
  onClose,
  packs,
  members,
  onSave,
  onDuplicate,
  onDelete,
  onSelectMany,
}: {
  target: { pack: Pack; item: Item } | null;
  onClose: () => void;
  // 옮길 수 있는 체크리스트 팩
  packs: Pack[];
  members: BagMember[];
  onSave: (patch: ItemPatch) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  // 이 아이템부터 여러 개 선택 모드 시작
  onSelectMany?: () => void;
}) {
  const commitRef = useRef<(() => void) | null>(null);
  const closeWithSave = () => {
    commitRef.current?.();
    onClose();
  };
  return (
    <Sheet open={!!target} onClose={closeWithSave} showClose={false}>
      {target && (
        <ItemSheetBody
          key={target.item.id}
          target={target}
          commitRef={commitRef}
          packs={packs}
          members={members}
          onClose={onClose}
          onSave={onSave}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onSelectMany={onSelectMany}
        />
      )}
    </Sheet>
  );
}

function ItemSheetBody({
  target,
  commitRef,
  packs,
  members,
  onClose,
  onSave,
  onDuplicate,
  onDelete,
  onSelectMany,
}: {
  target: { pack: Pack; item: Item };
  commitRef: React.RefObject<(() => void) | null>;
  packs: Pack[];
  members: BagMember[];
  onClose: () => void;
  onSave: (patch: ItemPatch) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSelectMany?: () => void;
}) {
  const [text, setText] = useState(target.item.text);
  const [assignee, setAssignee] = useState<string>(target.item.assigneeUid ?? "");
  const [packId, setPackId] = useState(target.pack.id);
  const shared = members.length > 1;

  // 한 번 저장하면 다시 쓰지 않는다. move=false면 팩 옮기기는 빼고(복제는 원래 팩에서 하므로) 이름 · 담당만
  const doneRef = useRef(false);
  const commit = (move = true) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const patch: ItemPatch = {};
    if (text.trim() && text.trim() !== target.item.text) patch.text = text;
    if ((target.item.assigneeUid ?? "") !== assignee) patch.assigneeUid = assignee || null;
    if (move && packId !== target.pack.id) patch.targetPackId = packId;
    if (Object.keys(patch).length > 0) onSave(patch);
  };
  useEffect(() => {
    commitRef.current = () => commit();
    return () => {
      commitRef.current = null;
    };
  });

  const save = () => {
    commit();
    onClose();
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

      {shared && (
        <div className="flex flex-col gap-2">
          <span className="text-caption font-semibold text-sub">담당</span>
          {members.length <= 3 ? (
            <SegmentedControl
              label="담당자"
              value={assignee}
              onChange={setAssignee}
              options={[{ value: "", label: "없음" }, ...members.map((m) => ({ value: m.uid, label: m.isMe ? "나" : m.nickname }))]}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Chip label="없음" selected={assignee === ""} onClick={() => setAssignee("")} />
              {members.map((m) => (
                <Chip key={m.uid} label={m.isMe ? "나" : m.nickname} selected={assignee === m.uid} onClick={() => setAssignee(m.uid)} />
              ))}
            </div>
          )}
        </div>
      )}

      {packs.length > 1 && (
        <div className="flex flex-col gap-2">
          <SectionHeader>팩</SectionHeader>
          <div className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {packs.map((p) => (
              <Chip key={p.id} label={p.name} selected={packId === p.id} onClick={() => setPackId(p.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col rounded-card border border-line bg-card px-4">
        {onSelectMany && (
          <button
            type="button"
            className="flex min-h-13 items-center border-b border-line bg-transparent text-left text-body"
            onClick={() => {
              commit();
              onSelectMany();
              onClose();
            }}
          >
            여러 개 선택
          </button>
        )}
        <button
          type="button"
          className="flex min-h-13 items-center border-b border-line bg-transparent text-left text-body"
          onClick={() => {
            commit(false);
            onDuplicate();
            onClose();
          }}
        >
          복제
        </button>
        <button
          type="button"
          className="flex min-h-13 items-center bg-transparent text-left text-body text-alert"
          onClick={() => {
            doneRef.current = true;
            onDelete();
            onClose();
          }}
        >
          삭제
        </button>
      </div>

      <Button type="submit" block>
        완료
      </Button>
    </form>
  );
}