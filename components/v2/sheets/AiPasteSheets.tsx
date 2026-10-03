"use client";

import { useEffect, useState } from "react";
import { IconClipboard, IconLoader2 } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import type { Bag, ImportedBagResult } from "@/lib/types";
import { AI_FREE_DAILY_LIMIT, currentAiUsageCount, isUnlimitedAiUser } from "@/lib/aiUsageService";
import { Button, Sheet } from "@/components/v2/ui";

const STEP_MS = 1400;

// 붙여넣은 글을 AI로 정리하는 시트의 공통 틀(메모로 새 가방 · 가방에 AI 가져오기).
// - 열 때마다 비운다. autoReadClipboard면 열자마자 클립보드를 읽어 채운다(실패하면 직접 붙여넣기 안내)
// - "붙여넣기" 버튼: 누른 순간 클립보드를 읽는다(자동 읽기가 막힌 브라우저에서도 사용자 동작이라 대개 된다)
// - 분석 중에는 닫기·끌어 닫기를 막고 진행 문구를 돌린다. 실패하면 문구를 보여주고 다시 시도할 수 있다
function AiPasteSheet({
  open,
  onClose,
  title,
  description,
  submitLabel,
  loadingMessages,
  autoReadClipboard = false,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  loadingMessages: string[];
  autoReadClipboard?: boolean;
  // 실패하면 throw(문구는 Error.message)
  onSubmit: (text: string) => Promise<void>;
}) {
  const { profile } = useAuth();
  const unlimited = isUnlimitedAiUser(profile?.email, profile);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [clipboardFailed, setClipboardFailed] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText("");
      setError(null);
      setClipboardFailed(false);
    }
  }

  // 열자마자 클립보드 읽기(권한 거부·앱 웹뷰 제약이면 조용히 직접 붙여넣기로)
  useEffect(() => {
    if (!open || !autoReadClipboard) return;
    let cancelled = false;
    const read = navigator.clipboard?.readText?.();
    if (!read) return;
    read
      .then((clip) => {
        if (cancelled) return;
        if (clip.trim()) setText((prev) => prev || clip);
        else setClipboardFailed(true);
      })
      .catch(() => !cancelled && setClipboardFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, autoReadClipboard]);

  useEffect(() => {
    if (!loading) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % loadingMessages.length), STEP_MS);
    return () => window.clearInterval(t);
  }, [loading, loadingMessages.length]);

  const paste = () => {
    navigator.clipboard
      ?.readText?.()
      .then((clip) => {
        if (clip.trim()) {
          setText(clip);
          setClipboardFailed(false);
        } else setClipboardFailed(true);
      })
      .catch(() => setClipboardFailed(true));
  };

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setStep(0);
    try {
      await onSubmit(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      showClose={!loading}
      footer={
        loading ? undefined : (
          <Button block disabled={!text.trim()} onClick={submit}>
            {submitLabel}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-caption text-sub">{description}</p>

        {loading ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-16">
            <IconLoader2 size={28} stroke={1.75} className="animate-spin text-brand" aria-hidden="true" />
            <p className="m-0 text-body text-sub">{loadingMessages[step]}</p>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="정리할 내용"
              placeholder="여기에 붙여넣기"
              rows={8}
              className="min-h-40 w-full resize-none rounded-field border border-line bg-card px-4 py-3 text-body outline-none placeholder:text-faint focus:border-ink"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-micro text-faint">
                {clipboardFailed && !text
                  ? "클립보드를 읽지 못했어요. 길게 눌러 직접 붙여넣어 주세요"
                  : !unlimited
                    ? `오늘 AI ${currentAiUsageCount(profile)} / ${AI_FREE_DAILY_LIMIT}회 사용`
                    : ""}
              </span>
              <Button variant="text" size="sm" className="px-2" leading={<IconClipboard size={18} stroke={1.75} />} onClick={paste}>
                붙여넣기
              </Button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="m-0 text-caption text-alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

async function postJson<T>(url: string, idToken: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "분석에 실패했어요");
  return data as T;
}

const NOTE_MESSAGES = ["메모를 꼼꼼히 읽고 있어요", "아이템 종류를 살펴보고 있어요", "어울리는 팩으로 나누고 있어요", "가방에 아이템을 채워 넣고 있어요"];

// 홈 > 새 가방 > 메모로 만들기. 구 NoteImportModal 대체(같은 /api/import-note, 같은 결과 형태)
export function NoteImportSheet({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (result: ImportedBagResult) => void;
}) {
  const { user } = useAuth();
  return (
    <AiPasteSheet
      open={open}
      onClose={onClose}
      title="메모로 가방 만들기"
      description="메모 앱에 적어 둔 준비물 목록을 붙여넣으면 AI가 팩별로 나눠 새 가방을 만들어요."
      submitLabel="AI로 정리하기"
      loadingMessages={NOTE_MESSAGES}
      onSubmit={async (text) => {
        if (!user) throw new Error("로그인이 필요해요");
        const data = await postJson<ImportedBagResult>("/api/import-note", await user.getIdToken(), { text });
        onResult(data);
      }}
    />
  );
}

export interface ClipboardImportResult {
  packs: { name: string; items: { text: string; checked: boolean }[] }[];
  skippedDuplicateCount: number;
}

const CLIPBOARD_MESSAGES = ["붙여넣은 내용을 읽고 있어요", "이미 있는 아이템과 비교하고 있어요", "새 아이템만 골라내고 있어요", "어울리는 팩으로 나누고 있어요"];

// 가방 > 더보기 > AI 가져오기. 구 AiClipboardModal 대체(같은 /api/clipboard-organize, 같은 결과 형태)
export function ClipboardImportSheet({
  open,
  bag,
  onClose,
  onApply,
}: {
  open: boolean;
  bag: Bag;
  onClose: () => void;
  onApply: (result: ClipboardImportResult) => void;
}) {
  const { user } = useAuth();
  return (
    <AiPasteSheet
      open={open}
      onClose={onClose}
      title="AI로 가져오기"
      description="복사해 둔 목록에서 이 가방에 아직 없는 아이템만 골라 팩별로 넣어 드려요."
      submitLabel="새 아이템만 넣기"
      loadingMessages={CLIPBOARD_MESSAGES}
      autoReadClipboard
      onSubmit={async (text) => {
        if (!user) throw new Error("로그인이 필요해요");
        const existingItems = bag.packs
          .filter((p) => p.kind !== "editor")
          .flatMap((p) => p.items.map((i) => i.text).filter((t) => t.trim()));
        const data = await postJson<Partial<ClipboardImportResult>>("/api/clipboard-organize", await user.getIdToken(), {
          text,
          existingItems,
        });
        onApply({ packs: data.packs ?? [], skippedDuplicateCount: data.skippedDuplicateCount ?? 0 });
      }}
    />
  );
}
