"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";
import { Button, Sheet, cx } from "@/components/v2/ui";

// 대시보드 "가입자" · "최근 7일 새로 가입"을 누르면 뜨는 가입자 목록(admin.md ADM-ULIST).
// 2026-10-16: 구 UI 색 · 글자 크기 → v2 Sheet · 토큰(admin.md 확인 필요 5). 1024px 이상은 가운데 창, 그 아래는 바텀시트.
// 이메일 · 가입 시각은 서버가 Auth 계정 값으로 준다(app/api/admin/users-list)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 페이지가 바뀔 때만 다시 받는다
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
    <Sheet
      open
      onClose={onClose}
      title={title}
      size="tall"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="text" size="sm" className="px-2" disabled={page === 0 || loading} leading={<IconChevronLeft size={16} stroke={1.9} />} onClick={goPrev}>
            이전
          </Button>
          <span className="text-caption text-sub tabular-nums">{page + 1} 페이지</span>
          <Button variant="text" size="sm" className="px-2" disabled={!nextCursor || loading} onClick={goNext}>
            다음
            <IconChevronRight size={16} stroke={1.9} aria-hidden="true" />
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="m-0 py-16 text-center text-body text-sub">불러오고 있어요</p>
      ) : error ? (
        <p role="alert" className="m-0 py-16 text-center text-body text-alert">
          {error}
        </p>
      ) : users.length === 0 ? (
        <p className="m-0 py-16 text-center text-body text-sub">해당하는 유저가 없어요</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {users.map((u, i) => (
            <li key={u.uid}>
              <button
                type="button"
                onClick={() => goToUser(u.email)}
                disabled={!u.email}
                className={cx(
                  "flex min-h-15 w-full items-center justify-between gap-3 rounded-field bg-transparent px-2 py-2 text-left hover:bg-fill disabled:opacity-40 disabled:hover:bg-transparent",
                  i < users.length - 1 && "border-b border-line",
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-body font-semibold text-ink">{u.nickname ?? "(닉네임 없음)"}</span>
                  <span className="truncate text-caption text-sub">{u.email ?? "-"}</span>
                </span>
                <span className="shrink-0 text-micro text-faint tabular-nums">{formatDate(u.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
