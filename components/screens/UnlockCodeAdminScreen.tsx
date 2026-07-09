"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft, IconCopy, IconPlus } from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { useToast } from "@/components/Toast";
import {
  UnlockCodeEntry,
  createUnlockCode,
  listUnlockCodes,
} from "@/lib/aiUsageService";

export default function UnlockCodeAdminScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(() => onBack());
  const { show } = useToast();
  const [codes, setCodes] = useState<UnlockCodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setCodes(await listUnlockCodes());
    } catch (err) {
      console.error("[팩인백] 이용권 코드 조회 실패:", err);
      show("코드 목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const code = await createUnlockCode(note);
      setNote("");
      await refresh();
      show(`새 코드가 생성됐어요: ${code}`);
    } catch (err) {
      console.error("[팩인백] 이용권 코드 생성 실패:", err);
      show("코드 생성에 실패했어요");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      show("코드를 복사했어요");
    } catch {
      show("복사에 실패했어요");
    }
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={22} stroke={1.75} />
        </button>
        <span className="text-[16px] font-medium">이용권 코드 관리</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="text-[12px] text-text-secondary mb-3">
          여기서 생성한 코드를 설정 &gt; 이용권 코드 입력에서 입력한 사용자는 AI 기능을
          무제한으로 쓸 수 있어요. (10자리 대문자+숫자, 랜덤 생성)
        </p>

        <div className="flex gap-2 mb-6">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (예: 베타테스터 - OO님)"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg px-3 py-2 text-[13px] font-medium flex items-center gap-1 disabled:opacity-50 shrink-0"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <IconPlus size={14} stroke={1.75} />
            새 코드
          </button>
        </div>

        {loading ? (
          <p className="text-[13px] text-text-muted py-6 text-center">불러오는 중...</p>
        ) : codes.length === 0 ? (
          <p className="text-[13px] text-text-muted py-6 text-center">
            아직 생성한 코드가 없어요
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {codes.map((c, idx) => (
              <div
                key={c.code}
                className="flex items-center justify-between p-3"
                style={{ borderBottom: idx < codes.length - 1 ? "1px solid var(--border)" : undefined }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium tracking-widest">{c.code}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    {c.note || "메모 없음"}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(c.code)}
                  aria-label="코드 복사"
                  className="-m-2 p-2 shrink-0"
                >
                  <IconCopy size={16} stroke={1.75} color="var(--text-muted)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
