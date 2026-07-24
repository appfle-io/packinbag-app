"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconX, IconPlus, IconSquareCheck, IconAlignLeft } from "@tabler/icons-react";
import { Pack } from "@/lib/types";

// 웹(브라우저)에서만 보이는, 가방 화면 맨 아래 고정된 빠른입력 바. 지금까지는 짐을
// 추가하려면 상단 "+" 버튼을 눌러 모달을 열어야 했는데, 웹은 화면 여백이 넓게 남으므로
// 항상 열려있는 입력창을 하단에 하나 두고 바로바로 입력할 수 있게 한다.
//
// 입력창 바로 위에는(=짐 드래그 중 뜨는 PackChipBar와 같은 자리에) 지금 가방에 있는
// 팩들이 칩으로 나열되어 담을 대상을 고를 수 있고, 맨 끝의 "+ 새 팩" 칩을 누르면
// 그 자리에서 빈 팩이 즉시 만들어지며 그 팩이 자동으로 선택된다.
//
// 부모(BagEditorScreen)의 루트 엘리먼트에 position:relative가 걸려있어야, 이 바가
// (데스크탑 트리+디테일 레이아웃에서도) 좌측 사이드바까지 덮지 않고 이 화면 영역
// 안에서만 폭을 채운다 - position:fixed를 쓰면 뷰포트 전체 폭 기준이라 사이드바까지
// 깔려버리는 문제가 있어서 absolute로 뒀다.
export default function BagQuickAddBar({
  packs,
  onAddItem,
  onCreatePack,
}: {
  // 메모팩(kind==='editor')은 짐을 못 담으므로 호출하는 쪽에서 미리 걸러서 넘긴다.
  packs: Pack[];
  onAddItem: (packId: string, data: { type: "check" | "text"; text: string }) => void;
  // 새 빈 팩을 만들고 그 id를 동기적으로 돌려준다(10개 캡 등으로 실패하면 null).
  onCreatePack: () => string | null;
}) {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(packs[0]?.id ?? null);
  const [type, setType] = useState<"check" | "text">("check");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 선택돼있던 팩이 삭제되는 등으로 목록에서 사라지면 첫 번째 팩으로 되돌린다.
  useEffect(() => {
    if (selectedPackId && packs.some((p) => p.id === selectedPackId)) return;
    setSelectedPackId(packs[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packs]);

  const handleCreatePack = () => {
    const newId = onCreatePack();
    if (!newId) return; // 10개 캡 등으로 실패 - 토스트는 onCreatePack 쪽에서 이미 띄움
    setSelectedPackId(newId);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || !selectedPackId) return;
    onAddItem(selectedPackId, { type, text: trimmed });
    setText("");
    inputRef.current?.focus();
  };

  // "취소(X)"는 바 자체를 닫는 게 아니라(항상 떠있는 바라서), 지금 입력 중이던
  // 텍스트만 비워준다.
  const handleCancel = () => {
    setText("");
    inputRef.current?.focus();
  };

  const canSubmit = !!text.trim() && !!selectedPackId;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[82] border-t border-border"
      style={{
        background: "var(--surface)",
        paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 8px))",
      }}
    >
      <div className="px-4 pt-2.5 flex flex-col gap-2">
        {/* 담을 팩 선택 칩 - 짐 드래그 중 상단에 뜨는 칩바와 같은 모양 언어를 쓴다. */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {packs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPackId(p.id)}
              className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap"
              style={{
                background: selectedPackId === p.id ? "var(--accent)" : "var(--surface-2)",
                color: selectedPackId === p.id ? "#fff" : undefined,
              }}
            >
              {p.name || "팩"}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCreatePack}
            className="shrink-0 flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap"
            style={{ background: "var(--surface-2)", color: "var(--accent)" }}
          >
            <IconPlus size={14} stroke={2} />
            새 팩
          </button>
        </div>

        {/* 입력 줄: 왼쪽부터 저장(체크)/취소(X)/타입선택(체크박스,텍스트)/입력창 순. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="저장"
            className="shrink-0 flex items-center justify-center rounded-full disabled:opacity-30"
            style={{ width: 32, height: 32, background: "var(--accent)", color: "#fff" }}
          >
            <IconCheck size={17} stroke={2.5} />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="입력 지우기"
            className="shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            <IconX size={16} stroke={1.75} />
          </button>
          <span className="shrink-0 mx-0.5" style={{ width: 1, height: 20, background: "var(--border)" }} />
          <button
            type="button"
            onClick={() => setType("check")}
            aria-label="체크박스 항목으로"
            className="shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: 32,
              height: 32,
              background: type === "check" ? "var(--accent)" : "var(--surface-2)",
              color: type === "check" ? "#fff" : "var(--text-secondary)",
            }}
          >
            <IconSquareCheck size={16} stroke={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setType("text")}
            aria-label="텍스트 항목으로"
            className="shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: 32,
              height: 32,
              background: type === "text" ? "var(--accent)" : "var(--surface-2)",
              color: type === "text" ? "#fff" : "var(--text-secondary)",
            }}
          >
            <IconAlignLeft size={16} stroke={1.75} />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              !selectedPackId
                ? "먼저 팩을 만들어주세요"
                : type === "check"
                ? "체크박스 항목 빠르게 추가"
                : "텍스트 빠르게 추가"
            }
            disabled={!selectedPackId}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] outline-none disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
