"use client";

import { useEffect, useRef, useState } from "react";
import { IconNotes } from "@tabler/icons-react";

// 가방 상단 제목 아래에 붙는 공지사항 느낌의 메모.
// 네모 칸 없이 투명 배경에 바로 적는다. 비어있을 땐 "메모 추가 +" 힌트만 보인다.
export default function BagNotice({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, draft]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onChange(trimmed);
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        autoFocus
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="다같이 볼 공지사항을 적어보세요"
        className="w-full resize-none bg-transparent outline-none text-[13px] leading-relaxed mb-3 block"
        style={{ color: "var(--text-secondary)", border: "none" }}
      />
    );
  }

  if (!value) {
    return (
      <button
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="flex items-center gap-1 text-[12px] mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        <IconNotes size={13} stroke={1.75} />
        메모 추가 +
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="block w-full text-left text-[13px] leading-relaxed whitespace-pre-wrap mb-3"
      style={{ color: "var(--text-secondary)" }}
    >
      {value}
    </button>
  );
}
