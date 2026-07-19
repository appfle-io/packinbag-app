"use client";

import { useEffect, useRef, useState } from "react";
import { IconSquareCheck, IconAlignLeft, IconPlus, IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";

// 하단 중앙 "+" 버튼으로 여는 빠른입력 모달. 체크/텍스트 타입만 고르고 텍스트만 입력해서
// "빠른팩"에 던져놓는 용도라, 서식(굵게/밑줄/취소선) 같은 옵션은 일부러 넣지 않았다 -
// 목표가 "생각날 때 빨리 적어두기"라서 여기서 서식까지 고르게 하면 오히려 느려진다.
// 정리(서식 입히기 등)는 나중에 팩 라이브러리 편집화면에서 하면 된다.
export default function QuickAddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: { type: "check" | "text"; text: string }) => void;
}) {
  const [type, setType] = useState<"check" | "text">("check");
  const [text, setText] = useState("");
  // 이번에 모달을 열어둔 채로 연속 입력한 항목들 - 저장 여부와 무관하게 화면에서만
  // 바로 보여주는 세션용 피드백 목록이라, 닫으면 사라진다(실제 데이터는 onAdd가 담당).
  const [justAdded, setJustAdded] = useState<{ type: "check" | "text"; text: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({ type, text: trimmed });
    setJustAdded((prev) => [...prev, { type, text: trimmed }]);
    setText("");
    // 연속 입력이 목표라서 저장 후에도 입력창은 계속 열어두고 포커스를 바로 되돌린다.
    inputRef.current?.focus();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-3"
          style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium">빠른입력</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setType("check")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px]"
              style={{
                background: type === "check" ? "var(--accent)" : "var(--surface-2)",
                color: type === "check" ? "#fff" : "var(--foreground)",
              }}
            >
              <IconSquareCheck size={15} stroke={1.75} />
              체크형
            </button>
            <button
              type="button"
              onClick={() => setType("text")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px]"
              style={{
                background: type === "text" ? "var(--accent)" : "var(--surface-2)",
                color: type === "text" ? "#fff" : "var(--foreground)",
              }}
            >
              <IconAlignLeft size={15} stroke={1.75} />
              텍스트형
            </button>
          </div>

          {justAdded.length > 0 && (
            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto rounded-lg bg-surface-2 p-2">
              {justAdded.map((entry, idx) => (
                <span key={idx} className="text-[12px] text-text-secondary truncate">
                  ✓ {entry.text}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder="짐 이름을 입력하고 엔터"
              className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2.5 text-[15px] outline-none"
            />
            <button
              type="button"
              onClick={commit}
              disabled={!text.trim()}
              aria-label="추가"
              className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              <IconPlus size={20} stroke={2} color="#fff" />
            </button>
          </div>

          <p className="text-[11px] text-text-muted">
            여기 넣은 짐들은 팩 라이브러리의 &ldquo;빠른팩&rdquo;에 모여요. 나중에 원하는 팩으로 옮겨서 정리해보세요.
          </p>
        </div>
      </div>
    </Portal>
  );
}
