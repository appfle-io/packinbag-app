"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { IconNotes } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { handleShortenablePaste } from "@/lib/shortLinkService";
import LinkifiedText from "@/components/LinkifiedText";

export interface BagNoticeHandle {
  open: () => void;
}

// 가방 상단 제목 아래에 붙는 공지사항 느낌의 메모.
// 네모 칸 없이 투명 배경에 바로 적는다. 비어있을 땐 "메모 추가 +" 힌트만 보인다.
// hideEmptyPrompt가 true면 비어있을 때 이 힌트 자체를 숨긴다(BagQuickAddRow가 대신
// "메모 추가 +" 트리거를 보여줄 때 씀) - 대신 ref.open()으로 외부에서 편집을 열 수 있다.
// 마진은 이 컴포넌트가 직접 갖지 않는다(BagEditorScreen에서 TravelDateField와 함께
// 하나의 묶음으로 마진을 관리해서, 디데이만/메모만/둘다 있을 때 간격이 자연스럽게 붙는다).
const BagNotice = forwardRef<
  BagNoticeHandle,
  {
    value: string;
    onChange: (value: string) => void;
    // true면 편집 진입을 막고 내용만 보여준다.
    readOnly?: boolean;
    hideEmptyPrompt?: boolean;
  }
>(function BagNotice({ value, onChange, readOnly, hideEmptyPrompt }, ref) {
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      if (readOnly) return;
      setDraft(value);
      setEditing(true);
    },
  }));

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
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
        ref={textareaRef}
        autoFocus
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onPaste={(e) => {
          const handled = handleShortenablePaste({
            clipboardText: e.clipboardData.getData("text"),
            currentValue: draft,
            selectionStart: e.currentTarget.selectionStart ?? draft.length,
            selectionEnd: e.currentTarget.selectionEnd ?? draft.length,
            user,
            setValue: setDraft,
            onShortened: () => showToast("링크를 짧게 줄였어요"),
          });
          if (handled) e.preventDefault();
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="다같이 볼 공지사항을 적어보세요"
        className="w-full resize-none bg-transparent outline-none text-[13px] leading-relaxed block"
        style={{ color: "var(--text-secondary)", border: "none" }}
      />
    );
  }

  if (!value) {
    if (readOnly || hideEmptyPrompt) return null;
    return (
      <button
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="flex items-center gap-1 text-[12px]"
        style={{ color: "var(--text-muted)" }}
      >
        <IconNotes size={13} stroke={1.75} />
        메모 추가 +
      </button>
    );
  }

  // 링크 클릭 시 부모의 편집 진입 동작이 같이 실행되면 안 되므로(LinkifiedText 안의
  // <a>가 클릭 이벤트를 stopPropagation함), <button> 대신 div+role="button"을 쓴다
  // (<a>를 <button> 안에 중첩하는 건 유효하지 않은 HTML이라 여기서도 ItemRow와 동일하게 바꿨다).
  return (
    <div
      role="button"
      tabIndex={readOnly ? -1 : 0}
      onClick={
        readOnly
          ? undefined
          : () => {
              setDraft(value);
              setEditing(true);
            }
      }
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === "Enter" || e.key === " ") {
          setDraft(value);
          setEditing(true);
        }
      }}
      className="block w-full text-left text-[13px] leading-relaxed whitespace-pre-wrap"
      style={{ color: "var(--text-secondary)", cursor: readOnly ? "default" : "pointer" }}
    >
      <LinkifiedText text={value} />
    </div>
  );
});

export default BagNotice;
