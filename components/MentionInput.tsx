"use client";

import { useRef, useState } from "react";

export interface MentionMember {
  uid: string;
  nickname: string;
  avatarId: string;
}

// "@"를 입력하면 가방 멤버 목록에서 자동완성해주는 입력창. 실제로 누가 멘션됐는지는
// 이 컴포넌트가 추적하지 않고, 보낼 때(부모 쪽에서 lib/mentions.ts의 extractMentionedUids로)
// 최종 텍스트를 다시 스캔해서 판단한다 - 그래서 이 컴포넌트는 순수하게 자동완성 UI만 담당한다.
export default function MentionInput({
  members,
  value,
  onChange,
  onSubmit,
  placeholder,
  maxLength = 500,
}: {
  members: MentionMember[];
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<MentionMember[] | null>(null);

  const findMentionQuery = (text: string, caret: number) => {
    const uptoCaret = text.slice(0, caret);
    const match = uptoCaret.match(/(?:^|\s)@([^\s@]*)$/);
    return match ? { query: match[1], matchLength: match[0].length } : null;
  };

  const updateSuggestions = (text: string, caret: number) => {
    const found = findMentionQuery(text, caret);
    if (!found) {
      setSuggestions(null);
      return;
    }
    const query = found.query.toLowerCase();
    const filtered = members
      .filter((m) => m.nickname.toLowerCase().includes(query))
      .slice(0, 5);
    setSuggestions(filtered.length > 0 ? filtered : null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const pickMember = (m: MentionMember) => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const found = findMentionQuery(value, caret);
    if (!found) return;
    const startIdx = caret - found.matchLength + (value[caret - found.matchLength] === " " ? 1 : 0);
    const before = value.slice(0, startIdx);
    const after = value.slice(caret);
    const inserted = `@${m.nickname} `;
    onChange(before + inserted + after);
    setSuggestions(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = (before + inserted).length;
      el?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative min-w-0 flex-1">
      {suggestions && (
        <div
          className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-border shadow-lg overflow-hidden z-10"
          style={{ background: "var(--surface)" }}
        >
          {suggestions.map((m) => (
            <button
              key={m.uid}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickMember(m)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
            >
              @{m.nickname}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (suggestions && suggestions.length > 0) {
              pickMember(suggestions[0]);
            } else {
              onSubmit();
            }
          } else if (e.key === "Escape") {
            setSuggestions(null);
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-full border border-border bg-surface-2 px-4 py-2.5 text-[13px] outline-none"
      />
    </div>
  );
}
