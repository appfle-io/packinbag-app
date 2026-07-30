"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { createCustomShortLink, validateCustomCode } from "@/lib/shortLinkService";
import { useOverlayLayer, SHEET_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// LinkActionMenu의 "커스텀 URL로 변경"을 누르면 뜨는 입력 시트. /c/{code} 형태로 사용자가
// 직접 코드를 입력하고, 저장 전 클라이언트에서 1차 검증(validateCustomCode) 후 서버에서
// 다시 검증 + 중복 체크한다(app/api/custom-shorten-url). 성공하면 onSuccess로 완성된
// shortUrl을 부모에 넘기고, 부모가 실제 텍스트 교체(onReplace)를 수행한다.
export default function CustomUrlModal({
  url,
  user,
  onSuccess,
  onClose,
}: {
  url: string;
  user: User;
  onSuccess: (shortUrl: string) => void;
  onClose: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 미리보기용 도메인 - 실제 저장 후 받는 shortUrl과 도메인이 다를 수도 있지만(SHORT_URL_BASE_URL
  // 환경변수), 입력하는 동안 보여주는 용도라 지금 접속 중인 origin으로 충분하다.
  const previewOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const handleSave = async () => {
    const validationError = validateCustomCode(code);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const shortUrl = await createCustomShortLink(user, url, code.trim());
      onSuccess(shortUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "커스텀 URL 생성에 실패했어요");
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
            <span className="text-[14px] font-medium">커스텀 URL 만들기</span>
            <button onClick={onClose} aria-label="닫기" className="-m-2 p-2">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <p className="text-[12px] text-text-muted truncate">{url}</p>

          <div
            className="flex items-center rounded-lg border border-border overflow-hidden"
            style={{ background: "var(--surface-2)" }}
          >
            <span className="pl-3 pr-1 text-[13px] text-text-muted shrink-0 truncate max-w-[45%]">
              {previewOrigin}/c/
            </span>
            <input
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              maxLength={20}
              placeholder="원하는 주소"
              className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-[13px] outline-none"
            />
          </div>

          {error ? (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : (
            <p className="text-[11px] text-text-muted">
              한글/영문/숫자/하이픈(-)/밑줄(_)만 사용, 2~20자
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !code.trim()}
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
