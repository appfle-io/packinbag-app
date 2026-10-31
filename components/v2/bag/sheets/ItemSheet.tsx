"use client";

import { useEffect, useRef, useState } from "react";
import type { Item, Pack } from "@/lib/types";
import type { BagMember, ItemPatch } from "@/hooks/bag";
import { Button, Chip, SectionHeader, SegmentedControl, Sheet } from "@/components/v2/ui";
import { useToast } from "@/components/Toast";
import { ITEM_REMIND_PRESETS, MAX_CUSTOM_OFFSET, dueOffsetLabel } from "@/lib/v2/reminderPlan";

// 아이템 마감 알림 한 묶음(마감 며칠 전 · "HH:MM")
export type DueRemind = { offsets: number[]; time: string };

// 아이템 길게 누르기: 이름 · 종류 · 담당 · 마감일 · 다른 팩으로 옮기기 · 복제 · 삭제
// 마감일(2026-10-26): 체크 항목만. 멤버 모두에게 보이고, 알림은 각자 가방 더보기 > 알림 "아이템 마감"대로(dueHint)
// 11/1: iOS 앱에서는 마감일 아래 "마감 알림" 기본 / 이 아이템만 따로(며칠 전 칩 · 직접 입력 · 받을 시간). 따로 정한 것은 내 계정에만(dueRemind)
// 종류(체크 항목 · 글)는 팩 탭 아이템 시트와 같은 모양(2026-10-17)
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
  dueHint,
  onDueSet,
  dueRemind,
  onDueRemindSave,
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
  // 마감일 아래 안내(알림을 언제 받는지)
  dueHint?: string;
  // 마감일을 처음 정한 순간(누름 안에서 알림 권한을 묻는다)
  onDueSet?: () => void;
  // 아이템마다 마감 알림(iOS 앱만). own = 이 아이템만 따로 정한 것(없으면 null), base = 가방의 마감 알림
  dueRemind?: { own: DueRemind | null; base: DueRemind };
  // 따로 정한 것 저장(null = 기본으로 되돌림). 시트를 닫을 때 바뀐 경우만
  onDueRemindSave?: (own: DueRemind | null) => void;
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
          dueHint={dueHint}
          onDueSet={onDueSet}
          dueRemind={dueRemind}
          onDueRemindSave={onDueRemindSave}
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
  dueHint,
  onDueSet,
  dueRemind,
  onDueRemindSave,
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
  dueHint?: string;
  onDueSet?: () => void;
  dueRemind?: { own: DueRemind | null; base: DueRemind };
  onDueRemindSave?: (own: DueRemind | null) => void;
}) {
  const { show } = useToast();
  const [text, setText] = useState(target.item.text);
  const [type, setType] = useState<Item["type"]>(target.item.type);
  const [assignee, setAssignee] = useState<string>(target.item.assigneeUid ?? "");
  const [packId, setPackId] = useState(target.pack.id);
  const [due, setDue] = useState(target.item.dueDate ?? "");
  const shared = members.length > 1;
  // 마감 알림(11/1): "base" = 가방 설정대로, "own" = 이 아이템만 따로
  const [remindMode, setRemindMode] = useState<"base" | "own">(dueRemind?.own ? "own" : "base");
  const [remind, setRemind] = useState<DueRemind>(dueRemind?.own ?? dueRemind?.base ?? { offsets: [1, 0], time: "09:00" });
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const toggleRemind = (o: number) =>
    setRemind((r) => ({ ...r, offsets: r.offsets.includes(o) ? r.offsets.filter((x) => x !== o) : [...r.offsets, o] }));
  const addCustom = () => {
    const n = Number(customValue);
    if (!Number.isInteger(n) || n < 0 || n > MAX_CUSTOM_OFFSET) {
      show(`0~${MAX_CUSTOM_OFFSET}일 전 사이로 입력해 주세요`);
      return;
    }
    if (!remind.offsets.includes(n)) toggleRemind(n);
    setCustomOpen(false);
    setCustomValue("");
  };
  const customOffsets = remind.offsets.filter((o) => !(ITEM_REMIND_PRESETS as readonly number[]).includes(o)).sort((a, b) => b - a);

  // 한 번 저장하면 다시 쓰지 않는다. move=false면 팩 옮기기는 빼고(복제는 원래 팩에서 하므로) 이름 · 담당만
  const doneRef = useRef(false);
  const commit = (move = true) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const patch: ItemPatch = {};
    if (text.trim() && text.trim() !== target.item.text) patch.text = text;
    if (type !== target.item.type) patch.type = type;
    if ((target.item.assigneeUid ?? "") !== assignee) patch.assigneeUid = assignee || null;
    if ((target.item.dueDate ?? "") !== due) patch.dueDate = due || null;
    if (move && packId !== target.pack.id) patch.targetPackId = packId;
    if (Object.keys(patch).length > 0) onSave(patch);
    if (dueRemind && onDueRemindSave) {
      // 마감일을 지우거나 글로 바꾸면 따로 정한 것도 지운다
      const own = due && type === "check" && remindMode === "own" ? { offsets: [...remind.offsets].sort((a, b) => b - a), time: remind.time } : null;
      const key = (r: DueRemind | null) => (r ? `${[...r.offsets].sort((x, y) => y - x).join(",")}@${r.time}` : "");
      if (key(own) !== key(dueRemind.own)) onDueRemindSave(own);
    }
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

      {type === "check" && (
        <div className="flex flex-col gap-2">
          <span className="text-caption font-semibold text-sub">마감일</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="마감일"
              value={due}
              onChange={(e) => {
                if (e.target.value && !due) onDueSet?.();
                setDue(e.target.value);
              }}
              className="h-11 min-w-0 flex-1 rounded-field border border-line bg-card px-3 text-body outline-none focus:border-ink"
            />
            {due && (
              <Button size="sm" variant="secondary" onClick={() => setDue("")}>
                지우기
              </Button>
            )}
          </div>
          {due && dueRemind && (
            <SegmentedControl
              label="마감 알림"
              value={remindMode}
              onChange={setRemindMode}
              options={[
                { value: "base", label: "기본 알림" },
                { value: "own", label: "이 아이템만 따로" },
              ]}
            />
          )}
          {due && dueRemind && remindMode === "own" ? (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-card p-3">
              <div className="flex flex-wrap gap-2">
                {ITEM_REMIND_PRESETS.map((o) => (
                  <Chip key={o} label={`마감 ${dueOffsetLabel(o)}`} selected={remind.offsets.includes(o)} onClick={() => toggleRemind(o)} />
                ))}
                {customOffsets.map((o) => (
                  <Chip key={o} label={`마감 ${dueOffsetLabel(o)}`} selected onClick={() => toggleRemind(o)} />
                ))}
                <Chip label="직접 입력" onClick={() => setCustomOpen((v) => !v)} />
              </div>
              {customOpen && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_CUSTOM_OFFSET}
                    aria-label="마감 며칠 전"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    className="h-10 w-20 rounded-field border border-line bg-card px-2 text-body outline-none"
                  />
                  <span className="text-body">일 전</span>
                  <Button size="sm" variant="secondary" onClick={addCustom}>
                    추가
                  </Button>
                </div>
              )}
              {remind.offsets.length > 0 && (
                <div className="flex min-h-12 items-center justify-between border-t border-line pt-3">
                  <span className="text-body">받을 시간</span>
                  <input
                    type="time"
                    aria-label="이 아이템 알림 시간"
                    value={remind.time}
                    onChange={(e) => e.target.value && setRemind((r) => ({ ...r, time: e.target.value }))}
                    className="h-10 rounded-field border border-line bg-card px-2 text-caption outline-none"
                  />
                </div>
              )}
              <p className="m-0 text-micro text-faint">
                {remind.offsets.length > 0
                  ? "이 아이템만 이때 알려 드려요 · 내 계정에만 저장돼요"
                  : "이 아이템은 알리지 않아요 · 고르면 받을 시간이 나와요"}
              </p>
            </div>
          ) : (
            due && dueHint && <p className="m-0 text-micro text-faint">{dueHint}</p>
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
