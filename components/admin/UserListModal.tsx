"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";

interface UserListItem {
  uid: string;
  email: string | null;
  nickname: string | null;
  createdAt: string | null;
}

interface UserListResponse {
  users: UserListItem[];
  nextCursor: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserListModal({
  title,
  newOnly,
  onClose,
}: {
  title: string;
  newOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // cursors[i] = i번째 페이지를 가져올 때 쓴 cursor (0번째 페이지는 항상 null)
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cursor = cursors[page];
        const params = new URLSearchParams();
        if (newOnly) params.set("newOnly", "1");
        if (cursor) params.set("cursor", cursor);
        const data = await adminApiFetch<UserListResponse>(`/api/admin/users-list?${params.toString()}`);
        if (cancelled) return;
        setUsers(data.users);
        setNextCursor(data.nextCursor);
      } catch (err) {
        if (!cancelled) setError(err instanceof AdminApiError ? err.message : "목록을 불러오지 못했어요");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goNext = () => {
    if (!nextCursor) return;
    setCursors((prev) => (prev.length === page + 1 ? [...prev, nextCursor] : prev));
    setPage((p) => p + 1);
  };

  const goPrev = () => {
    if (page === 0) return;
    setPage((p) => p - 1);
  };

  const goToUser = (email: string | null) => {
    if (!email) return;
    onClose();
    router.push(`/admin/users?email=${encodeURIComponent(email)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl flex flex-col max-h-[80vh]"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-[15px] font-semibold">{title}</p>
          <button onClick={onClose} className="-m-2 p-2 text-text-muted" aria-label="닫기">
            <IconX size={18} stroke={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && <p className="text-[13px] text-text-muted text-center py-8">불러오는 중...</p>}
          {error && (
            <p className="text-[13px] text-center py-8" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          {!loading && !error && users.length === 0 && (
            <p className="text-[13px] text-text-muted text-center py-8">해당하는 유저가 없어요</p>
          )}
          {!loading &&
            !error &&
            users.map((u) => (
              <button
                key={u.uid}
                onClick={() => goToUser(u.email)}
                disabled={!u.email}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-surface-2 disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{u.nickname ?? "(닉네임 없음)"}</p>
                  <p className="text-[11px] text-text-muted truncate">{u.email ?? "-"}</p>
                </div>
                <p className="text-[11px] text-text-muted shrink-0">{formatDate(u.createdAt)}</p>
              </button>
            ))}
        </div>

        <div
          className="flex items-center justify-between px-5 py-3 border-t shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={goPrev}
            disabled={page === 0 || loading}
            className="flex items-center gap-1 text-[12px] text-text-secondary disabled:opacity-40"
          >
            <IconChevronLeft size={15} stroke={1.75} />
            이전
          </button>
          <p className="text-[11px] text-text-muted">{page + 1} 페이지</p>
          <button
            onClick={goNext}
            disabled={!nextCursor || loading}
            className="flex items-center gap-1 text-[12px] text-text-secondary disabled:opacity-40"
          >
            다음
            <IconChevronRight size={15} stroke={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
