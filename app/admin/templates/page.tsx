"use client";

import { useEffect, useState, useCallback } from "react";
import { IconShieldCheck, IconAlertTriangle, IconTrash, IconSparkles, IconRefresh } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";

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

export default function AdminTemplatesPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [logs, setLogs] = useState<TemplateInspectLog[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10">
            <IconSparkles size={20} color="var(--accent)" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold">템플릿 심사 & 모니터링</h1>
            <p className="text-[12px] text-text-muted">유저들이 공유한 팩 템플릿 목록과 AI 유해성 심사 내역</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-[12.5px] hover:border-accent"
        >
          <IconRefresh size={15} />
          <span>새로고침</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[14px] text-text-muted">
          심사 이력을 불러오는 중입니다...
        </div>
      ) : logs.length === 0 ? (
        <div className="py-20 text-center text-[14px] text-text-muted rounded-xl border border-border bg-surface">
          아직 공유 등록된 템플릿 심사 기록이 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2.5 p-4 rounded-xl border border-border bg-surface shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14.5px] font-bold truncate">{log.packName}</span>
                  {log.safe ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                      <IconShieldCheck size={13} />
                      <span>승인됨</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 shrink-0">
                      <IconAlertTriangle size={13} />
                      <span>차단됨</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteLog(log.id)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-black/5 shrink-0"
                  title="기록 삭제"
                >
                  <IconTrash size={16} stroke={1.75} />
                </button>
              </div>

              <div className="flex items-center justify-between text-[12px] text-text-muted border-b border-border pb-2">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-text-primary">{log.userNickname}</span>
                  <span className="text-text-muted">({log.userEmail || log.userUid})</span>
                </div>
                <span className="shrink-0">{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
              </div>

              {!log.safe && log.reason && (
                <div className="text-[12.5px] p-2.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 font-medium">
                  ⚠️ AI 차단 사유: {log.reason}
                </div>
              )}

              <div className="flex flex-col gap-1.5 bg-surface-2 p-2.5 rounded-lg text-[12px]">
                <span className="font-semibold text-[11.5px] text-text-muted">
                  포함된 짐 항목 ({log.items?.length ?? 0}개):
                </span>
                {log.items && log.items.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {log.items.map((itemText, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md bg-surface border border-border text-[12px] text-text-secondary"
                      >
                        • {itemText}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-text-muted italic">(짐 항목 없음)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
