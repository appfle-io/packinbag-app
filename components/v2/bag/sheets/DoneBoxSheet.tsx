"use client";

import { useState } from "react";
import { IconCheck, IconChevronLeft, IconTrash } from "@tabler/icons-react";
import { Button, CheckMark, ListRow, Sheet, cx } from "@/components/v2/ui";
import { DEFAULT_DONE_BOX_MODE, DONE_BOX_MODES, type DoneBoxEntry, type DoneBoxMode } from "@/lib/v2/doneBox";
import { ConfirmSheet } from "./ConfirmSheet";

type View = "list" | "select" | "settings";

// 가방 완료함(2026-11-01, BAG-DONE). 가방 맨 아래 "완료함" 줄에서 연다.
// - 목록: 누르면 체크를 풀어 원래 팩으로. 칸 수는 가방 1열/2열(내 설정)을 따른다
// - 선택: 여러 개 골라 지우기 · 전체 삭제(확인) - 지우면 가방에서 아예 빠진다(되돌리기 토스트는 deleteItems)
// - 설정: 완료함으로 옮기는 때(가방에 저장, 멤버 모두 같음). 자동으로 지우는 옵션은 없다
export function DoneBoxSheet({
  open,
  onClose,
  entries,
  mode,
  hasDday,
  cols,
  onUncheck,
  onDelete,
  onSetMode,
}: {
  open: boolean;
  onClose: () => void;
  entries: DoneBoxEntry[];
  mode: DoneBoxMode;
  // D-Day를 정한 가방만 "D-Day 다음 날"을 보인다
  hasDday: boolean;
  cols: 1 | 2;
  onUncheck: (entry: DoneBoxEntry) => void;
  onDelete: (itemIds: string[]) => void;
  onSetMode: (mode: DoneBoxMode) => void;
}) {
  // 꺼져 있으면 설정부터. 열 때마다 처음 화면으로(닫는 동안에는 그대로 둬서 내려가는 모습이 안 바뀌게)
  const [view, setView] = useState<View>(mode === "off" ? "settings" : "list");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView(mode === "off" ? "settings" : "list");
      setSelected(new Set());
    }
  }

  // 다른 기기에서 지워졌거나 원래 팩으로 돌아간 것은 선택에서 뺀다
  const present = new Set(entries.map((e) => e.item.id));
  const picked = [...selected].filter((id) => present.has(id));
  const allPicked = entries.length > 0 && picked.length === entries.length;
  const modeLine = DONE_BOX_MODES.find((m) => m.id === mode)?.line ?? "";

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const title = view === "settings" ? "완료함 설정" : view === "select" ? (picked.length > 0 ? `${picked.length}개 선택` : "지울 아이템 고르기") : `완료함 ${entries.length}`;

  const footer =
    view === "select" ? (
      <Button
        block
        variant="destructive"
        disabled={picked.length === 0}
        leading={<IconTrash size={18} stroke={1.9} />}
        onClick={() => {
          onDelete(picked);
          setSelected(new Set());
          setView("list");
        }}
      >
        {picked.length > 0 ? `${picked.length}개 삭제` : "지울 아이템을 고르세요"}
      </Button>
    ) : view === "list" && entries.length > 0 ? (
      <div className="flex justify-center">
        <Button variant="danger" size="sm" onClick={() => setConfirmAll(true)}>
          전체 삭제
        </Button>
      </div>
    ) : undefined;

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title} size="tall" footer={footer}>
        {view === "settings" ? (
          <div className="flex flex-col">
            {mode !== "off" && (
              <button
                type="button"
                className="-ml-1 mb-1 flex h-11 items-center gap-1 self-start bg-transparent text-body font-semibold text-brand active:opacity-60"
                onClick={() => setView("list")}
              >
                <IconChevronLeft size={20} stroke={1.9} aria-hidden="true" />
                완료함
              </button>
            )}
            <p className="m-0 pb-1 text-caption font-semibold text-sub">챙긴 아이템을 완료함으로 옮기는 때</p>
            <div role="radiogroup" aria-label="완료함으로 옮기는 때">
              {DONE_BOX_MODES.filter((m) => m.id !== "dday" || hasDday || mode === "dday").map((m) => (
                <ListRow
                  key={m.id}
                  role="radio"
                  aria-checked={mode === m.id}
                  title={m.id === DEFAULT_DONE_BOX_MODE ? `${m.label} (기본)` : m.label}
                  subtitle={m.sub}
                  trailing={mode === m.id ? <IconCheck size={20} stroke={2.4} className="text-brand" aria-hidden="true" /> : undefined}
                  onClick={() => onSetMode(m.id)}
                />
              ))}
            </div>
            <p className="m-0 pt-3 text-caption text-sub">
              이 가방 멤버 모두 같은 설정을 써요. 완료함 아이템은 자동으로 지우지 않아요. 체크를 풀면 원래 팩으로 돌아가요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex min-h-11 items-center justify-between gap-2">
              {view === "list" ? (
                <>
                  <button
                    type="button"
                    className="min-w-0 truncate bg-transparent text-left text-caption text-sub active:opacity-60"
                    onClick={() => setView("settings")}
                  >
                    {modeLine} · <span className="font-semibold text-brand">바꾸기</span>
                  </button>
                  {entries.length > 0 && (
                    <Button variant="text" size="sm" className="-mr-4 shrink-0" onClick={() => setView("select")}>
                      선택
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="text" size="sm" className="-ml-4 text-ink" onClick={() => setView("list")}>
                    취소
                  </Button>
                  <Button
                    variant="text"
                    size="sm"
                    className="-mr-4"
                    onClick={() => setSelected(allPicked ? new Set() : new Set(entries.map((e) => e.item.id)))}
                  >
                    {allPicked ? "선택 해제" : "전체 선택"}
                  </Button>
                </>
              )}
            </div>

            {entries.length === 0 ? (
              <p className="m-0 py-10 text-center text-caption text-faint">챙긴 아이템이 여기 모여요</p>
            ) : (
              <ul className={cx("m-0 grid list-none p-0", cols === 2 ? "grid-cols-2 gap-x-3" : "grid-cols-1")}>
                {entries.map((e) => {
                  const on = picked.includes(e.item.id);
                  return (
                    <li key={e.item.id} className="min-w-0">
                      <button
                        type="button"
                        aria-pressed={view === "select" ? on : true}
                        className={cx(
                          "flex w-full select-none items-center rounded-field bg-transparent text-left",
                          cols === 2 ? "min-h-13 gap-2 py-2" : "min-h-14 gap-3 py-1",
                          "transition-colors duration-160 ease-snappy active:bg-fill",
                          on && "bg-brand-soft",
                        )}
                        onClick={() => (view === "select" ? toggle(e.item.id) : onUncheck(e))}
                      >
                        {view === "select" ? (
                          <span
                            aria-hidden="true"
                            className={cx(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border-check",
                              on ? "border-brand bg-brand text-on-brand" : "border-line-strong",
                            )}
                          >
                            {on && <IconCheck size={14} stroke={2.6} />}
                          </span>
                        ) : (
                          <CheckMark checked />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={cx("text-body", cols === 2 && "line-clamp-2 break-keep", view === "select" ? "text-ink" : "text-faint line-through")}>
                            {e.item.text}
                          </span>
                          <span className="truncate text-caption text-sub">
                            {e.packName}
                            {e.item.checkedAt ? ` · ${checkedAgo(e.item.checkedAt)}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="m-0 pt-2 text-caption text-sub">
              {view === "select"
                ? "지우면 가방에서 아예 빠져요. 다시 쓸 아이템은 체크를 풀어 원래 팩으로 돌려 두세요."
                : "누르면 체크가 풀려 원래 팩으로 돌아가요."}
            </p>
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={`완료함 ${entries.length}개를 모두 지울까요?`}
        message="가방에서 아예 빠져요. 함께 쓰는 가방이면 멤버 모두에게서 빠져요."
        confirmLabel="모두 삭제"
        danger
        onConfirm={() => onDelete(entries.map((e) => e.item.id))}
      />
    </>
  );
}

// 방금 · N분 전 · N시간 전 · 어제 · N일 전 · M/D
function checkedAgo(iso: string, now = new Date()): string {
  const t = new Date(iso);
  const diff = now.getTime() - t.getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) /
      86_400_000,
  );
  if (days <= 0) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${t.getMonth() + 1}/${t.getDate()}`;
}
