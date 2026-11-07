"use client";

import { useEffect, useState } from "react";
import { IconHistory, IconLoader2 } from "@tabler/icons-react";
import { Button, ListRow, Sheet } from "@/components/v2/ui";
import { getEditorDocFullText } from "@/lib/editorDocLimits";
import type { NoteHistoryEntry } from "@/lib/noteHistoryService";

// 메모 이전 버전(2026-11-07, memo.md MEMO-HIST). 열 때 한 번 읽는다 → 누르면 그 버전 글을 보고 "이 버전으로 되돌리기"
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const time = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return `오늘 ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `어제 ${time}`;
  const date = d.toLocaleDateString("ko-KR", d.getFullYear() === now.getFullYear() ? { month: "long", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" });
  return `${date} ${time}`;
}

export function NoteHistorySheet({
  open,
  onClose,
  load,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  load: () => Promise<NoteHistoryEntry[]>;
  onRestore: (entry: NoteHistoryEntry) => void;
}) {
  const [list, setList] = useState<NoteHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<NoteHistoryEntry | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 열 때마다 새로 읽는다
    setList(null);
    setFailed(false);
    setPicked(null);
    load()
      .then((l) => alive && setList(l))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickedText = picked ? getEditorDocFullText(picked.doc ?? null).trim() : "";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={picked ? formatWhen(picked.createdAt) : "이전 버전"}
      size="tall"
      footer={
        picked ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPicked(null)}>
              목록
            </Button>
            <Button className="flex-1" onClick={() => onRestore(picked)}>
              이 버전으로 되돌리기
            </Button>
          </div>
        ) : undefined
      }
    >
      {picked ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-caption text-sub">
            {picked.byName ? `${picked.byName}님이 고치기 전` : "고치기 전"} · 되돌려도 지금 내용은 이전 버전에 남아요
          </p>
          <div className="whitespace-pre-wrap rounded-field bg-fill p-3 text-body text-ink">{pickedText || "글 없이 사진 · 파일만 있는 버전이에요"}</div>
        </div>
      ) : failed ? (
        <p className="m-0 py-6 text-center text-caption text-sub">이전 버전을 불러오지 못했어요</p>
      ) : !list ? (
        <div className="flex justify-center py-8 text-sub">
          <IconLoader2 size={22} stroke={1.9} className="animate-spin" aria-label="불러오는 중" />
        </div>
      ) : list.length === 0 ? (
        <p className="m-0 py-6 text-center text-caption text-sub">
          아직 이전 버전이 없어요. 메모를 고치면 고치기 전 모습이 여기에 남아요
        </p>
      ) : (
        <div className="flex flex-col">
          <p className="m-0 pb-2 text-caption text-sub">메모를 고칠 때마다 고치기 전 모습을 최근 20개까지 남겨요</p>
          {list.map((e, i) => (
            <ListRow
              key={e.id}
              divider={i < list.length - 1}
              leading={<IconHistory size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
              title={formatWhen(e.createdAt)}
              subtitle={
                <span className="line-clamp-2">
                  {e.byName ? `${e.byName}님이 고치기 전 · ` : ""}
                  {e.preview || "비어 있는 글"}
                </span>
              }
              chevron
              onClick={() => setPicked(e)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
