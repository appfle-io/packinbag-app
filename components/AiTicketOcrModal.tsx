"use client";

import { useState, useRef } from "react";
import { IconPlane, IconUpload, IconX, IconLoader2, IconCheck, IconAlertTriangle, IconFileText, IconSparkles } from "@tabler/icons-react";
import { User } from "firebase/auth";

interface OcrResult {
  bagName: string;
  travelDate?: string;
  airlineInfo?: string;
  packs: Array<{ name: string; items: Array<{ text: string; checked: boolean }> }>;
  tripMemo?: string;
}

interface AiTicketOcrModalProps {
  user: User | null;
  onClose: () => void;
  onCreateBagWithData: (data: {
    name: string;
    travelDate?: string;
    notice?: string;
    packs: Array<{ name: string; items: Array<{ text: string; checked: boolean }> }>;
  }) => Promise<void>;
  onShowPremiumLimit?: (msg: string) => void;
}

export default function AiTicketOcrModal({
  user,
  onClose,
  onCreateBagWithData,
  onShowPremiumLimit,
}: AiTicketOcrModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [creating, setCreating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (selected: File | null) => {
    if (!selected) return;
    if (selected.size > 4 * 1024 * 1024) {
      setError("파일 용량은 4MB 이하여야 해요");
      return;
    }
    setFile(selected);
    setError(null);

    if (selected.type.startsWith("image/")) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !user) return;
    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai-ticket-ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type || "image/jpeg",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.limitReached && onShowPremiumLimit) {
          onClose();
          onShowPremiumLimit(data.error);
          return;
        }
        throw new Error(data.error || "티켓 분석에 실패했어요");
      }

      setOcrResult(data);
    } catch (err: any) {
      setError(err.message || "오류가 발생했어요");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!ocrResult) return;
    setCreating(true);
    try {
      await onCreateBagWithData({
        name: ocrResult.bagName,
        travelDate: ocrResult.travelDate,
        notice: ocrResult.tripMemo || ocrResult.airlineInfo,
        packs: ocrResult.packs,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "가방 생성에 실패했어요");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-border rounded-2xl p-5 shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent-strong flex items-center justify-center">
              <IconPlane size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">항공권 / 티켓으로 가방 만들기</h3>
              <p className="text-[11px] text-text-muted">티켓 캡처를 올리면 AI가 맞춤 짐을 완성해요</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 -mr-1.5 rounded-full hover:bg-surface-2">
            <IconX size={18} />
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {error && (
            <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-[12px] flex items-center gap-2 font-medium">
              <IconAlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!ocrResult ? (
            <>
              {/* 업로드 박스 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent/50 bg-surface-2/50 rounded-2xl p-6 text-center cursor-pointer transition-colors space-y-2"
              >
                {previewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="티켓 미리보기"
                      className="max-h-48 mx-auto rounded-xl object-contain shadow-xs"
                    />
                    <p className="text-[12px] text-accent font-bold">다른 이미지 선택</p>
                  </div>
                ) : file ? (
                  <div className="space-y-2">
                    <IconFileText size={40} className="text-accent mx-auto" />
                    <p className="text-[13px] font-bold text-foreground truncate">{file.name}</p>
                    <p className="text-[11px] text-text-muted">다른 파일로 변경하려면 클릭하세요</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center mx-auto">
                      <IconUpload size={22} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-foreground">
                        항공권 / 승차권 이미지 선택
                      </p>
                      <p className="text-[11px] text-text-muted mt-1">
                        예약 확인 캡처, 탑승권, KTX 표, 여행 일정표 (JPG, PNG, PDF)
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className="w-full py-3 rounded-xl bg-accent text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
              >
                {loading ? (
                  <>
                    <IconLoader2 size={18} className="animate-spin" />
                    티켓 정보를 정밀 분석하고 있어요...
                  </>
                ) : (
                  <>
                    <IconSparkles size={16} />
                    AI로 티켓 분석 & 짐 목록 생성
                  </>
                )}
              </button>
            </>
          ) : (
            /* 분석 완료 결과 미리보기 */
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[12px]">
                  <IconCheck size={16} stroke={2.5} />
                  티켓 분석 성공
                </div>
                <h4 className="text-[16px] font-bold text-foreground">{ocrResult.bagName}</h4>
                {ocrResult.travelDate && (
                  <p className="text-[12px] text-text-muted">출발일: {ocrResult.travelDate}</p>
                )}
                {ocrResult.airlineInfo && (
                  <p className="text-[12px] text-text-secondary font-medium">
                    {ocrResult.airlineInfo}
                  </p>
                )}
              </div>

              {ocrResult.tripMemo && (
                <div className="p-3 rounded-xl bg-surface-2 border border-border text-[12px] text-text-secondary leading-relaxed">
                  {ocrResult.tripMemo}
                </div>
              )}

              <p className="text-[12px] font-bold text-text-secondary px-1">
                생성될 팩 목록 ({ocrResult.packs.length}개)
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {ocrResult.packs.map((pack, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                    <p className="text-[13px] font-bold text-foreground">{pack.name}</p>
                    <p className="text-[12px] text-text-muted truncate">
                      {pack.items.map((i) => i.text).join(", ")}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setOcrResult(null)}
                  className="py-2.5 rounded-xl border border-border font-bold text-[13px] text-foreground hover:bg-surface-2 transition-colors"
                >
                  다시 올리기
                </button>
                <button
                  onClick={handleConfirmCreate}
                  disabled={creating}
                  className="py-2.5 rounded-xl bg-accent text-white font-bold text-[13px] flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
                >
                  {creating ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />}
                  가방 만들기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
