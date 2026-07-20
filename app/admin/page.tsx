"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";
import UserListModal from "@/components/admin/UserListModal";

interface StatsShape {
  users: { total: number; newLast7Days: number };
  bags: { total: number; active: number; trashed: number; shared: number };
  packs: { total: number; editor: number; folders: number; libraryTotal: number };
  items: { total: number; checked: number };
  premium: { unusedCodes: number; activeCodes: number; expiredCodes: number; invalidatedCodes: number };
  inquiries: { total: number; pending: number };
}

interface AdminStats extends StatsShape {
  // 스냅샷이 없는 날(첫 배포 직후, cron 실패 등)에는 각 값이 null로 내려온다.
  trend: {
    vsYesterday: StatsShape | null;
    vsLastWeek: StatsShape | null;
  };
}

// 대시보드에서 열 수 있는 모달 종류. 유저 목록(전체/최근 7일)만 모달로 보여주고,
// 이용권/문의는 각 관리 화면으로 필터를 붙여서 이동시킨다(아래 StatCard onClick 참고).
type ModalKind = "allUsers" | "newUsers" | null;

// ---- 증감 뱃지 ----
function TrendBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label} -
      </span>
    );
  }
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? "#16a34a" : value < 0 ? "var(--danger)" : "var(--text-muted)";
  return (
    <span className="text-[11px]" style={{ color }}>
      {label} {sign}
      {value.toLocaleString()}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  trendYesterday,
  trendLastWeek,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trendYesterday?: number | null;
  trendLastWeek?: number | null;
  onClick?: () => void;
}) {
  const showTrend = trendYesterday !== undefined || trendLastWeek !== undefined;
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      className={`rounded-xl p-4 flex flex-col gap-1 transition-colors ${
        clickable ? "cursor-pointer hover:bg-surface-2" : ""
      }`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[12px] text-text-secondary">{label}</p>
        {clickable && <IconChevronRight size={13} stroke={2} className="text-text-muted shrink-0" />}
      </div>
      <p className="text-[24px] font-semibold">{value.toLocaleString?.() ?? value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
      {showTrend && (
        <div className="flex gap-2.5 mt-0.5">
          <TrendBadge label="전일" value={trendYesterday} />
          <TrendBadge label="전주" value={trendLastWeek} />
        </div>
      )}
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

// ---- 파이 차트 ----
interface PieDatum {
  name: string;
  value: number;
  color: string;
}

function StatPie({ title, data }: { title: string; data: PieDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-[12px] text-text-secondary mb-1">{title}</p>
      <div style={{ width: "100%", height: 170 }}>
        {total > 0 ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${Number(value ?? 0).toLocaleString()}개`, String(name)]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[12px] text-text-muted">데이터 없음</div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name} {total > 0 ? Math.round((d.value / total) * 100) : 0}% ({d.value.toLocaleString()})
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

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

  const y = stats?.trend?.vsYesterday ?? null;
  const w = stats?.trend?.vsLastWeek ?? null;

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
            <StatCard
              label="총 가입자"
              value={stats.users.total}
              trendYesterday={y?.users.total}
              trendLastWeek={w?.users.total}
              onClick={() => setModal("allUsers")}
            />
            <StatCard
              label="최근 7일 신규 가입"
              value={stats.users.newLast7Days}
              onClick={() => setModal("newUsers")}
            />
          </Section>

          <Section title="가방">
            <StatCard
              label="총 가방"
              value={stats.bags.total}
              trendYesterday={y?.bags.total}
              trendLastWeek={w?.bags.total}
            />
            <StatCard
              label="진행 중"
              value={stats.bags.active}
              trendYesterday={y?.bags.active}
              trendLastWeek={w?.bags.active}
            />
            <StatCard
              label="휴지통"
              value={stats.bags.trashed}
              trendYesterday={y?.bags.trashed}
              trendLastWeek={w?.bags.trashed}
            />
            <StatCard
              label="공유 중(2인 이상)"
              value={stats.bags.shared}
              trendYesterday={y?.bags.shared}
              trendLastWeek={w?.bags.shared}
            />
          </Section>

          <Section title="팩 / 짐">
            <StatCard
              label="가방 속 팩 총합"
              value={stats.packs.total}
              sub={`에디터팩 ${stats.packs.editor}개`}
              trendYesterday={y?.packs.total}
              trendLastWeek={w?.packs.total}
            />
            <StatCard
              label="라이브러리 팩"
              value={stats.packs.libraryTotal}
              trendYesterday={y?.packs.libraryTotal}
              trendLastWeek={w?.packs.libraryTotal}
            />
            <StatCard
              label="짐(항목) 총합"
              value={stats.items.total}
              trendYesterday={y?.items.total}
              trendLastWeek={w?.items.total}
            />
            <StatCard
              label="완료된 짐"
              value={stats.items.checked}
              trendYesterday={y?.items.checked}
              trendLastWeek={w?.items.checked}
            />
          </Section>

          <Section title="이용권(프리미엄)">
            <StatCard
              label="사용 중(활성)"
              value={stats.premium.activeCodes}
              trendYesterday={y?.premium.activeCodes}
              trendLastWeek={w?.premium.activeCodes}
              onClick={() => router.push("/admin/unlock-codes?status=active")}
            />
            <StatCard
              label="미배포"
              value={stats.premium.unusedCodes}
              onClick={() => router.push("/admin/unlock-codes?status=unused")}
            />
            <StatCard
              label="만료됨"
              value={stats.premium.expiredCodes}
              onClick={() => router.push("/admin/unlock-codes?status=expired")}
            />
            <StatCard
              label="무효화됨"
              value={stats.premium.invalidatedCodes}
              onClick={() => router.push("/admin/unlock-codes?status=invalidated")}
            />
          </Section>

          <Section title="문의">
            <StatCard
              label="총 문의"
              value={stats.inquiries.total}
              trendYesterday={y?.inquiries.total}
              trendLastWeek={w?.inquiries.total}
              onClick={() => router.push("/admin/inquiries")}
            />
            <StatCard
              label="미답변"
              value={stats.inquiries.pending}
              trendYesterday={y?.inquiries.pending}
              trendLastWeek={w?.inquiries.pending}
              onClick={() => router.push("/admin/inquiries?status=pending")}
            />
          </Section>

          <div className="mb-8">
            <h2 className="text-[13px] font-medium text-text-secondary mb-2.5">현황 한눈에 보기</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <StatPie
                title="가방 상태"
                data={[
                  { name: "진행 중", value: stats.bags.active, color: "#2563eb" },
                  { name: "휴지통", value: stats.bags.trashed, color: "#9ca3af" },
                ]}
              />
              <StatPie
                title="팩 구성"
                data={[
                  { name: "일반 팩", value: stats.packs.total - stats.packs.editor, color: "#2563eb" },
                  { name: "에디터 팩", value: stats.packs.editor, color: "#f97316" },
                  { name: "폴더", value: stats.packs.folders, color: "#9ca3af" },
                ]}
              />
              <StatPie
                title="짐 완료율"
                data={[
                  { name: "완료", value: stats.items.checked, color: "#16a34a" },
                  { name: "미완료", value: stats.items.total - stats.items.checked, color: "#e5e7eb" },
                ]}
              />
              <StatPie
                title="이용권 코드 상태"
                data={[
                  { name: "활성", value: stats.premium.activeCodes, color: "#16a34a" },
                  { name: "미배포", value: stats.premium.unusedCodes, color: "#2563eb" },
                  { name: "만료", value: stats.premium.expiredCodes, color: "#9ca3af" },
                  { name: "무효화", value: stats.premium.invalidatedCodes, color: "#dc2626" },
                ]}
              />
            </div>
          </div>
        </>
      )}

      {modal === "allUsers" && (
        <UserListModal title="총 가입자" newOnly={false} onClose={() => setModal(null)} />
      )}
      {modal === "newUsers" && (
        <UserListModal title="최근 7일 신규 가입" newOnly={true} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
