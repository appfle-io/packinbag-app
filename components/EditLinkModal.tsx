"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { updateLinkMeta, validateLinkLabel, LINK_LABEL_MAX_LENGTH } from "@/lib/shortLinkService";
import { useOverlayLayer, SHEET_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// 이미 만들어진 짧은/커스텀 URL(본인이 만든 것만, LinkActionMenu의 "수정"에서 진입)의 표시
// 이름과 실제 연결되는 주소(longUrl)를 고치는 시트. 코드(주소 뒷부분, /s 또는 /c/{code})
// 자체는 이미 공유된 링크가 깨지지 않도록 여기서 바꿀 수 없다 - longUrl과 label만 독립적으로
// 수정 가능하다(app/api/update-short-link, 서버가 요청자가 만든 사람 본인인지 다시 검증).
export default function EditLinkModal({
  kind,
  code,
  initialLabel,
  initialLongUrl,
  user,
  onSuccess,
  onClose,
}: {
  kind: "s" | "c";
  code: string;
  initialLabel: string | null;
  initialLongUrl: string;
  user: User;
  onSuccess: (result: { label: string | null; longUrl: string }) => void;
  onClose: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [longUrl, setLongUrl] = useState(initialLongUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const labelError = validateLinkLabel(label);
    if (labelError) {
      setError(labelError);
      return;
    }
    if (!longUrl.trim()) {
      setError("연결될 주소를 입력해주세요");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateLinkMeta(user, {
        kind,
        code,
        label: label.trim(),
        longUrl: longUrl.trim(),
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "링크 수정에 실패했어요");
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
            <span className="text-[14px] font-medium">링크 수정</span>
            <button onClick={onClose} aria-label="닫기" className="-m-2 p-2">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-text-muted">표시 이름 (선택)</span>
            <input
              autoFocus
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError(null);
              }}
              maxLength={LINK_LABEL_MAX_LENGTH}
              placeholder="예: 참고자료_정리내용"
              className="rounded-lg border border-border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: "var(--surface-2)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-text-muted">연결되는 주소</span>
            <input
              value={longUrl}
              onChange={(e) => {
                setLongUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://..."
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
