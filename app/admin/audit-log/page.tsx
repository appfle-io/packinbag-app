"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";

interface AuditLogEntry {
  id: string;
  uid: string;
  email: string | null;
  action: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  bag_restore: "가방 복구",
  bag_trash: "가방 속 팩 → 휴지통 이동",
  library_pack_restore: "라이브러리 팩 복구",
  library_pack_trash: "라이브러리 팩 휴지통 이동",
  unlock_code_redeem: "이용권 코드 사용",
  unlock_code_invalidate: "이용권 코드 무효화",
  invite_code_regenerate: "초대코드 재발급",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AuditLogInner() {
  const searchParams = useSearchParams();
  const initialUid = searchParams.get("uid") ?? "";
  const [uidFilter, setUidFilter] = useState(initialUid);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = uid.trim() ? `?uid=${encodeURIComponent(uid.trim())}` : "";
      const data = await adminApiFetch<{ logs: AuditLogEntry[] }>(`/api/admin/audit-logs${query}`);
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "로그를 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(initialUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-[20px] font-semibold mb-1">활동 로그</h1>
      <p className="text-[13px] text-text-secondary mb-6">
        삭제/복구/이용권 사용 등 CS 관련 주요 이벤트 기록이에요. uid로 필터할 수 있어요.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(uidFilter);
        }}
        className="flex gap-2 mb-6"
      >
        <input
          value={uidFilter}
          onChange={(e) => setUidFilter(e.target.value)}
          placeholder="uid로 필터 (비워두면 전체)"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
        />
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-[13px] font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          필터
        </button>
      </form>

      {loading && <p className="text-[13px] text-text-muted">불러오는 중...</p>}
      {error && (
        <p className="text-[13px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-1.5">
          {logs.length === 0 ? (
            <p className="text-[13px] text-text-muted py-10 text-center">기록이 없어요</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg px-3 py-2.5"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </p>
                  <p className="text-[11px] text-text-muted shrink-0">{formatDate(log.createdAt)}</p>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {log.email ?? log.uid} · {log.targetType}:{log.targetId}
                </p>
                {Object.keys(log.meta ?? {}).length > 0 && (
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">
                    {Object.entries(log.meta)
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAuditLogPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-text-muted">불러오는 중...</div>}>
      <AuditLogInner />
    </Suspense>
  );
}
