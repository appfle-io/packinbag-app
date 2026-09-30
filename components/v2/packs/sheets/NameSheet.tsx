"use client";

import { useState } from "react";
import { Button, Sheet } from "@/components/v2/ui";

export interface NameRequest {
  title: string;
  initial: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
}

const MAX_NAME = 40;

// 이름 하나만 받는 시트(새 폴더, 이름 바꾸기). request가 null이면 닫힘.
export function NameSheet({ request, onClose }: { request: NameRequest | null; onClose: () => void }) {
  const [cached, setCached] = useState<NameRequest | null>(request);
  const [name, setName] = useState(request?.initial ?? "");
  // 새로 열릴 때마다 입력칸을 그 요청의 초기값으로 채운다
  if (request && request !== cached) {
    setCached(request);
    setName(request.initial);
  }
  const r = request ?? cached;
  const trimmed = name.trim();

  const submit = () => {
    if (!r || !trimmed) return;
    if (trimmed !== r.initial) r.onSubmit(trimmed);
    onClose();
  };

  return (
    <Sheet
      open={!!request}
      onClose={onClose}
      title={r?.title}
      footer={
        <Button block disabled={!trimmed} onClick={submit}>
          {r?.confirmLabel ?? "저장"}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={name}
          maxLength={MAX_NAME}
          autoFocus
          aria-label="이름"
          placeholder={r?.placeholder}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          enterKeyHint="done"
          className="h-12 w-full rounded-field border border-line bg-card px-4 text-body outline-none focus:border-ink"
        />
      </form>
    </Sheet>
  );
}
