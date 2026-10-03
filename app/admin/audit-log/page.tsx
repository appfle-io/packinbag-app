"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconFilter } from "@tabler/icons-react";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";
import { Badge, Button, cx } from "@/components/v2/ui";
import { ADMIN_FIELD, AdminCard, AdminEmpty, AdminError, AdminLoading, AdminPage } from "@/components/admin/AdminPage";

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
  bag_trash: "가방 속 팩 → 휴지통",
  library_pack_restore: "보관함 팩 복구",
  library_pack_trash: "보관함 팩 → 휴지통",
  unlock_code_redeem: "이용권 사용",
  unlock_code_invalidate: "이용권 무효화",
  invite_code_regenerate: "초대 코드 재발급",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function AuditLogInner() {
  const searchParams = useSearchParams();
  const initialUid = searchParams.get("uid") ?? "";
  const [uidFilter, setUidFilter] = useState(initialUid);
  const [appliedUid, setAppliedUid] = useState(initialUid);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (uid: string) => {
    setLoading(true);
    setError(null);
    setAppliedUid(uid.trim());
    try {
      const query = uid.trim() ? `?uid=${encodeURIComponent(uid.trim())}` : "";
      const data = await adminApiFetch<{ logs: AuditLogEntry[] }>(`/api/admin/audit-logs${query}`);
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "기록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 처음 한 번 불러오기(로딩 표시 후 비동기)
    load(initialUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPage title="활동 로그" description="삭제 · 복구 · 이용권처럼 문의 응대에 필요한 기록이에요">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(uidFilter);
        }}
        className="flex gap-2"
      >
        <input value={uidFilter} onChange={(e) => setUidFilter(e.target.value)} aria-label="uid" placeholder="uid로 거르기 (비우면 전체)" className={ADMIN_FIELD} />
        <Button type="submit" size="sm" variant="secondary" className="shrink-0" leading={<IconFilter size={18} stroke={1.75} />}>
          거르기
        </Button>
      </form>

      {error && <AdminError>{error}</AdminError>}
      {loading ? (
        <AdminLoading />
      ) : logs.length === 0 ? (
        <AdminEmpty>{appliedUid ? "이 사용자의 기록이 없어요" : "기록이 없어요"}</AdminEmpty>
      ) : (
        <AdminCard title={appliedUid ? `기록 ${logs.length}개 · ${appliedUid}` : `최근 기록 ${logs.length}개`}>
          <ul className="m-0 flex list-none flex-col p-0">
            {logs.map((log, i) => {
              const meta = Object.entries(log.meta ?? {});
              return (
                <li key={log.id} className={cx("flex flex-col gap-1 py-3", i < logs.length - 1 && "border-b border-line")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Badge tone={log.action.includes("invalidate") || log.action.includes("trash") ? "neutral" : "brand"}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => {
                          setUidFilter(log.uid);
                          load(log.uid);
                        }}
                        className="bg-transparent text-caption text-sub hover:text-ink hover:underline"
                        title="이 사용자 기록만 보기"
                      >
                        {log.email ?? log.uid}
                      </button>
                    </span>
                    <span className="text-micro text-faint tabular-nums">{formatDate(log.createdAt)}</span>
                  </div>
                  <span className="truncate text-caption text-faint">
                    {log.targetType}:{log.targetId}
                    {meta.length > 0 && ` · ${meta.map(([k, v]) => `${k}=${String(v)}`).join(" · ")}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </AdminCard>
      )}
    </AdminPage>
  );
}

export default function AdminAuditLogPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AuditLogInner />
    </Suspense>
  );
}
