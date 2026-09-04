"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { createShortLink, validateLinkLabel, LINK_LABEL_MAX_LENGTH } from "@/lib/shortLinkService";
import { useOverlayLayer, SHEET_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// LinkActionMenu의 "짧은 URL로 변경"을 누르면 뜨는 입력 시트. CustomUrlModal과 거의 동일하지만
// 코드는 서버가 무작위로 발급하므로(/s/{7자리}) 입력칸이 없고, 표시 이름(label)만 선택으로
// 받는다 - 비워두면 화면에서는 링크 그대로 보여준다(components/LinkifiedText.tsx/
// PackNoteEditorScreen.tsx가 lib/linkLabelCache.ts로 조회해서 렌더링). 성공하면 onSuccess로
// 완성된 shortUrl/label을 부모에 넘기고, 부모가 실제 텍스트 교체(onReplace)를 수행한다.
export default function ShortenUrlModal({
  url,
  user,
  onSuccess,
  onClose,
}: {
  url: string;
  user: User;
  onSuccess: (result: { shortUrl: string; label: string | null }) => void;
  onClose: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const labelError = validateLinkLabel(label);
    if (labelError) {
      setError(labelError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trimmedLabel = label.trim();
      const shortUrl = await createShortLink(user, url, trimmedLabel || undefined);
      onSuccess({ shortUrl, label: trimmedLabel || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "링크 축약에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-end justify-center sm:items-center"
        style={{ zIndex: ambientLayer + SHEET_OFFSET, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-3"
          style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium">짧은 URL 만들기</span>
            <button onClick={onClose} aria-label="닫기" className="-m-2 p-2">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <p className="text-[12px] text-text-muted truncate">{url}</p>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-text-muted">표시 이름 (선택)</span>
            <input
              autoFocus
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              maxLength={LINK_LABEL_MAX_LENGTH}
              placeholder="예: 참고자료_정리내용 (비워두면 링크 그대로 보여요)"
              className="rounded-lg border border-border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: "var(--surface-2)" }}
            />
          </div>

          {error && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
