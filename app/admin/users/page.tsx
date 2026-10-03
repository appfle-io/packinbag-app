"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconChevronRight, IconSearch } from "@tabler/icons-react";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";
import { Badge, Button, cx } from "@/components/v2/ui";
import { ADMIN_FIELD, AdminCard, AdminEmpty, AdminError, AdminLoading, AdminPage } from "@/components/admin/AdminPage";

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
  return new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Rows<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) return <p className="m-0 text-caption text-faint">{empty}</p>;
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item, i) => (
        <li key={i} className={cx("py-3", i < items.length - 1 && "border-b border-line")}>
          {render(item)}
        </li>
      ))}
    </ul>
  );
}

function BagLine({ bag }: { bag: BagSummary }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-body font-semibold text-ink">{bag.name || "이름 없는 가방"}</span>
        {bag.isOwner && <Badge tone="brand">소유</Badge>}
        {bag.trashedByOwnerAt && <Badge>휴지통</Badge>}
        {bag.locked && <Badge>잠김</Badge>}
      </span>
      <span className="text-caption text-sub">
        멤버 {bag.memberCount}명 · 팩 {bag.packCount}개 · 아이템 {bag.itemCount}개
        {bag.updatedAt ? ` · 최근 ${formatDate(bag.updatedAt)}` : ""}
        {bag.trashedByOwnerAt ? ` · 휴지통 ${formatDate(bag.trashedByOwnerAt)}` : ""}
      </span>
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

  const runSearch = async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await adminApiFetch<UserLookupResult>(`/api/admin/user-lookup?email=${encodeURIComponent(target.trim())}`));
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "조회하지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  // 대시보드 가입자 목록에서 눌러 ?email=로 들어오면 바로 조회
  useEffect(() => {
    if (emailFromQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소로 들어온 이메일을 한 번 조회(로딩 표시 후 비동기)
      runSearch(emailFromQuery);
    }
  }, [emailFromQuery]);

  const todayAi = result?.aiUsage ? result.aiUsage.count : 0;

  return (
    <AdminPage title="유저 조회" description="이메일로 찾으면 그 사람의 가방 · 팩 · 이용권을 한 번에 봐요">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(email);
        }}
        className="flex gap-2"
      >
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" aria-label="유저 이메일" placeholder="유저 이메일" className={ADMIN_FIELD} />
        <Button type="submit" size="sm" disabled={loading || !email.trim()} leading={<IconSearch size={18} stroke={1.9} />} className="shrink-0">
          조회
        </Button>
      </form>

      {error && <AdminError>{error}</AdminError>}
      {loading && <AdminLoading />}
      {!loading && !result && !error && <AdminEmpty>이메일을 입력해 주세요</AdminEmpty>}

      {result && (
        <>
          <AdminCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-heading font-bold text-ink">{result.nickname ?? "(닉네임 없음)"}</span>
                <span className="text-caption text-sub">{result.email}</span>
                <span className="text-micro text-faint">{result.uid}</span>
              </div>
              <Link href={`/admin/audit-log?uid=${result.uid}`} className="inline-flex h-11 items-center gap-1 text-body font-semibold text-brand">
                활동 로그
                <IconChevronRight size={16} stroke={1.9} />
              </Link>
            </div>
            <dl className="m-0 mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-3">
              {[
                { k: "가입", v: formatDate(result.createdAt) },
                { k: "마지막 AI 사용", v: result.aiUsage ? `${result.aiUsage.date} · ${todayAi}회` : "없음" },
                {
                  k: "이용권",
                  v: result.unlockCode
                    ? `${result.unlockCode.code} · ${result.unlockCode.status} · ${result.unlockCode.expiresAt ? `${formatDate(result.unlockCode.expiresAt)} 만료` : "무제한"}`
                    : "없음",
                },
              ].map((x) => (
                <div key={x.k} className="flex flex-col gap-1">
                  <dt className="text-micro text-sub">{x.k}</dt>
                  <dd className="m-0 text-body text-ink">{x.v}</dd>
                </div>
              ))}
            </dl>
          </AdminCard>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <AdminCard title={`만든 가방 ${result.ownedBags.length}`}>
              <Rows items={result.ownedBags} empty="없어요" render={(b) => <BagLine bag={b} />} />
            </AdminCard>
            <AdminCard title={`참여한 가방 ${result.memberOfBags.length}`}>
              <Rows items={result.memberOfBags} empty="없어요" render={(b) => <BagLine bag={b} />} />
            </AdminCard>
          </div>

          <AdminCard title={`팩 보관함 ${result.libraryPacks.total}`} hint={result.libraryPacks.trashed > 0 ? `휴지통 ${result.libraryPacks.trashed}개` : undefined}>
            <Rows
              items={result.libraryPacks.items}
              empty="없어요"
              render={(p) => (
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-body text-ink">{p.name || "이름 없음"}</span>
                  <span className="shrink-0 text-caption text-sub">
                    {p.type === "folder" ? "폴더" : p.kind === "editor" ? "메모" : `아이템 ${p.itemCount}개`}
                    {p.trashedAt ? " · 휴지통" : ""}
                  </span>
                </div>
              )}
            />
          </AdminCard>
        </>
      )}
    </AdminPage>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminUsersInner />
    </Suspense>
  );
}
