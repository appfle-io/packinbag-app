"use client";

import { useEffect, useState } from "react";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";

interface AdminStats {
  users: { total: number; newLast7Days: number };
  bags: { total: number; active: number; trashed: number; shared: number };
  packs: { total: number; editor: number; folders: number; libraryTotal: number };
  items: { total: number; checked: number };
  premium: { unusedCodes: number; activeCodes: number; expiredCodes: number; invalidatedCodes: number };
  inquiries: { total: number; pending: number };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-[12px] text-text-secondary">{label}</p>
      <p className="text-[24px] font-semibold">{value.toLocaleString?.() ?? value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-[13px] font-medium text-text-secondary mb-2.5">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminApiFetch<AdminStats>("/api/admin/stats");
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof AdminApiError ? err.message : "통계를 불러오지 못했어요");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-[20px] font-semibold mb-1">대시보드</h1>
      <p className="text-[13px] text-text-secondary mb-6">
        팩인백 전체 현황을 한눈에 확인할 수 있어요.
      </p>

      {loading && <p className="text-[13px] text-text-muted">불러오는 중...</p>}
      {error && (
        <p className="text-[13px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {stats && (
        <>
          <Section title="유저">
            <StatCard label="총 가입자" value={stats.users.total} />
            <StatCard label="최근 7일 신규 가입" value={stats.users.newLast7Days} />
          </Section>

          <Section title="가방">
            <StatCard label="총 가방" value={stats.bags.total} />
            <StatCard label="진행 중" value={stats.bags.active} />
            <StatCard label="휴지통" value={stats.bags.trashed} />
            <StatCard label="공유 중(2인 이상)" value={stats.bags.shared} />
          </Section>

          <Section title="팩 / 짐">
            <StatCard label="가방 속 팩 총합" value={stats.packs.total} sub={`에디터팩 ${stats.packs.editor}개`} />
            <StatCard label="라이브러리 팩" value={stats.packs.libraryTotal} />
            <StatCard label="짐(항목) 총합" value={stats.items.total} />
            <StatCard label="완료된 짐" value={stats.items.checked} />
          </Section>

          <Section title="이용권(프리미엄)">
            <StatCard label="사용 중(활성)" value={stats.premium.activeCodes} />
            <StatCard label="미배포" value={stats.premium.unusedCodes} />
            <StatCard label="만료됨" value={stats.premium.expiredCodes} />
            <StatCard label="무효화됨" value={stats.premium.invalidatedCodes} />
          </Section>

          <Section title="문의">
            <StatCard label="총 문의" value={stats.inquiries.total} />
            <StatCard label="미답변" value={stats.inquiries.pending} />
          </Section>
        </>
      )}
    </div>
  );
}
