"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";

interface BagSummary {
  id: string;
  name: string;
  ownerId: string;
  isOwner: boolean;
  memberCount: number;
  packCount: number;
  itemCount: number;
  locked: boolean;
  trashedByOwnerAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LibraryPackSummary {
  id: string;
  name: string;
  type: string;
  kind: string;
  itemCount: number;
  trashedAt: string | null;
  createdAt: string | null;
}

interface UserLookupResult {
  uid: string;
  email: string;
  nickname: string | null;
  createdAt: string | null;
  aiUsage: { date: string; count: number } | null;
  unlockCode: {
    code: string;
    status: string;
    note: string;
    durationType: string;
    expiresAt: string | null;
    invalidatedAt: string | null;
  } | null;
  ownedBags: BagSummary[];
  memberOfBags: BagSummary[];
  libraryPacks: { total: number; trashed: number; items: LibraryPackSummary[] };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BagRow({ bag }: { bag: BagSummary }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium truncate flex items-center gap-1.5">
          {bag.name}
          {bag.isOwner && (
            <span
              className="text-[10px] rounded-full px-1.5 py-0.5"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
            >
              소유
            </span>
          )}
          {bag.trashedByOwnerAt && (
            <span
              className="text-[10px] rounded-full px-1.5 py-0.5"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              휴지통
            </span>
          )}
          {bag.locked && (
            <span
              className="text-[10px] rounded-full px-1.5 py-0.5"
              style={{ background: "var(--border)", color: "var(--text-muted)" }}
            >
              잠김
            </span>
          )}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">
          멤버 {bag.memberCount}명 · 팩 {bag.packCount}개 · 짐 {bag.itemCount}개
          {bag.trashedByOwnerAt ? ` · 휴지통행: ${formatDate(bag.trashedByOwnerAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

function AdminUsersInner() {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email");
  const [email, setEmail] = useState(emailFromQuery ?? "");
  const [result, setResult] = useState<UserLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = async (targetEmail: string) => {
    if (!targetEmail.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await adminApiFetch<UserLookupResult>(
        `/api/admin/user-lookup?email=${encodeURIComponent(targetEmail.trim())}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "조회에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  // 대시보드 유저 목록 모달에서 특정 유저를 눌러 /admin/users?email=... 로 넘어온 경우,
  // 이메일 입력창에 채워주고 바로 조회까지 실행해준다.
  useEffect(() => {
    if (emailFromQuery) {
      runSearch(emailFromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(email);
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-[20px] font-semibold mb-1">유저 조회</h1>
      <p className="text-[13px] text-text-secondary mb-6">
        이메일로 검색하면 그 유저의 가방/팩/이용권 현황을 한 번에 볼 수 있어요.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="유저 이메일"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {loading ? "조회 중..." : "조회"}
        </button>
      </form>

      {error && (
        <p className="text-[13px] mb-4" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-6">
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium">{result.nickname ?? "(닉네임 없음)"}</p>
                <p className="text-[12px] text-text-secondary">{result.email}</p>
              </div>
              <Link
                href={`/admin/audit-log?uid=${result.uid}`}
                className="text-[12px] font-medium shrink-0"
                style={{ color: "var(--accent)" }}
              >
                활동 로그 보기 →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[11px] text-text-muted">가입일</p>
                <p className="text-[13px]">{formatDate(result.createdAt)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">오늘 AI 사용</p>
                <p className="text-[13px]">{result.aiUsage?.count ?? 0}회</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">이용권</p>
                <p className="text-[13px]">
                  {result.unlockCode
                    ? `${result.unlockCode.code} (${result.unlockCode.status})`
                    : "없음"}
                </p>
              </div>
            </div>
            {result.unlockCode && (
              <p className="text-[11px] text-text-muted mt-1">
                만료: {result.unlockCode.expiresAt ? formatDate(result.unlockCode.expiresAt) : "무제한"}
                {result.unlockCode.invalidatedAt && ` · 무효화: ${formatDate(result.unlockCode.invalidatedAt)}`}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-[13px] font-medium text-text-secondary mb-2">
              소유 가방 ({result.ownedBags.length})
            </h3>
            <div className="flex flex-col gap-1.5">
              {result.ownedBags.length === 0 ? (
                <p className="text-[12px] text-text-muted">없음</p>
              ) : (
                result.ownedBags.map((b) => <BagRow key={b.id} bag={b} />)
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-medium text-text-secondary mb-2">
              참여 중인 가방 ({result.memberOfBags.length})
            </h3>
            <div className="flex flex-col gap-1.5">
              {result.memberOfBags.length === 0 ? (
                <p className="text-[12px] text-text-muted">없음</p>
              ) : (
                result.memberOfBags.map((b) => <BagRow key={b.id} bag={b} />)
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-medium text-text-secondary mb-2">
              라이브러리 팩 (활성 {result.libraryPacks.total} · 휴지통 {result.libraryPacks.trashed})
            </h3>
            <div className="flex flex-col gap-1.5">
              {result.libraryPacks.items.length === 0 ? (
                <p className="text-[12px] text-text-muted">없음</p>
              ) : (
                result.libraryPacks.items.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <p className="text-[13px] truncate">{p.name}</p>
                    <p className="text-[11px] text-text-muted shrink-0">
                      짐 {p.itemCount}개{p.trashedAt ? " · 휴지통" : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-text-muted">불러오는 중...</div>}>
      <AdminUsersInner />
    </Suspense>
  );
}
