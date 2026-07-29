"use client";

import { useEffect, useState, useCallback } from "react";
import { IconX, IconShieldCheck, IconAlertTriangle, IconTrash, IconRefresh } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthProvider";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

export interface TemplateInspectLog {
  id: string;
  userUid: string;
  userEmail?: string;
  userNickname: string;
  packName: string;
  items: string[];
  safe: boolean;
  reason?: string;
  createdAt: string;
}

export default function TemplateInspectLogsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [logs, setLogs] = useState<TemplateInspectLog[]>([]);
  const [loading, setLoading] = useState(true);
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/template-logs", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("불러오기 실패");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("[팩인백] 템플릿 심사 로그 조회 실패:", err);
      show("템플릿 심사 이력을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [user, show]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDeleteLog = async (id: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/template-logs?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("삭제 실패");
      setLogs((prev) => prev.filter((item) => item.id !== id));
      show("심사 기록을 삭제했어요");
    } catch (err) {
      console.error("[팩인백] 심사 기록 삭제 실패:", err);
      show("기록 삭제에 실패했어요");
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 md:p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
                <IconShieldCheck size={18} color="var(--accent)" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">👑 템플릿 공유 등록 이력 & 모니터링</h3>
                <p className="text-[12px] text-text-muted">유저가 공유 등록을 시도한 팩과 AI 유해성 심사 내역</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5" aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>

          {/* 본문 목록 */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {loading ? (
              <div className="py-16 text-center text-[13px] text-text-muted">
                심사 이력을 불러오는 중입니다...
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-text-muted">
                아직 공유 등록된 템플릿 심사 기록이 없어요.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 p-3.5 rounded-xl border border-border bg-surface shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13.5px] font-bold truncate">{log.packName}</span>
                      {log.safe ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <IconShieldCheck size={13} />
                          <span>승인</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          <IconAlertTriangle size={13} />
                          <span>차단</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1 me-1 rounded text-text-muted hover:text-danger hover:bg-black/5 shrink-0"
                      aria-label="기록 삭제"
                    >
                      <IconTrash size={15} stroke={1.75} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11.5px] text-text-muted border-b border-border pb-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-text-primary">{log.userNickname}</span>
                      <span>({log.userEmail || log.userUid})</span>
                    </div>
                    <span className="shrink-0">{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
                  </div>

                  {!log.safe && log.reason && (
                    <div className="text-[12px] p-2 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20">
                      ⚠️ AI 차단 사유: {log.reason}
                    </div>
                  )}

                  <div className="flex flex-col gap-1 bg-surface-2 p-2 rounded-lg text-[12px]">
                    <span className="font-semibold text-[11px] text-text-muted">짐 항목 ({log.items?.length ?? 0}개):</span>
                    {log.items && log.items.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {log.items.map((itemText, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-surface border border-border text-[11.5px] text-text-secondary"
                          >
                            • {itemText}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-text-muted italic">(항목 없음)</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
