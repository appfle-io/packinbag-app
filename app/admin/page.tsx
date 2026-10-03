"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertCircle, IconChevronRight, IconClockHour4, IconKey, IconLoader2, IconMessageQuestion, IconRefresh, IconUsers } from "@tabler/icons-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminApiFetch, AdminApiError } from "@/lib/adminApiClient";
import type { AdminInsights, AdminKpis, AdminStats } from "@/lib/adminStats";
import UserListModal from "@/components/admin/UserListModal";

interface DashboardResponse extends AdminStats {
  insights: AdminInsights;
  kpisWeekAgo: AdminKpis | null;
  trend: { vsYesterday: AdminStats | null; vsLastWeek: AdminStats | null };
  generatedAt?: string;
  cached?: boolean;
}

type ModalKind = "allUsers" | "newUsers" | null;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const num = (n: number) => n.toLocaleString("ko-KR");

// 전주 대비 증감(스냅샷이 없으면 표시 안 함)
function Delta({ now, before }: { now: number; before: number | null | undefined }) {
  if (before === null || before === undefined) return <span className="text-micro text-faint">전주 기록 없음</span>;
  const d = now - before;
  if (d === 0) return <span className="text-micro text-faint">전주와 같음</span>;
  return (
    <span className={`text-micro font-semibold ${d > 0 ? "text-brand" : "text-alert"}`}>
      전주보다 {d > 0 ? "+" : ""}
      {num(d)}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-card p-5 ${className}`}>{children}</section>;
}

function CardTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <h2 className="m-0 text-body font-bold text-ink">{children}</h2>
      {hint && <p className="m-0 text-caption text-sub">{hint}</p>}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
  onClick,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-caption text-sub">
        {label}
        {onClick && <IconChevronRight size={16} stroke={1.75} className="text-faint" aria-hidden="true" />}
      </span>
      <span className="text-title font-bold text-ink tabular-nums">{value}</span>
      {sub && <span className="text-caption text-sub">{sub}</span>}
      {delta}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-card border border-line bg-card p-5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-fill`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// 가로 막대(비율). 전체 대비 몇 %인지와 실제 수
function RatioBar({ label, value, total, note }: { label: string; value: number; total: number; note?: string }) {
  const p = pct(value, total);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body text-ink">{label}</span>
        <span className="shrink-0 text-caption text-sub tabular-nums">
          <strong className="text-body font-bold text-ink">{p}%</strong> · {num(value)}
          {note ? ` ${note}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-fill">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function Todo({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex min-h-15 items-center gap-3 rounded-card border border-line bg-card px-4 py-3 text-left transition-colors hover:bg-fill disabled:cursor-default disabled:hover:bg-card"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-semibold text-ink">{title}</span>
        <span className="text-caption text-sub">{detail}</span>
      </span>
      {onClick && <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />}
    </button>
  );
}

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const AXIS = { fontSize: 12, fill: "var(--v2-faint)" };

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminApiFetch<DashboardResponse>(`/api/admin/stats${force ? "?force=1" : ""}`));
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "통계를 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 처음 한 번 불러오기(setState는 비동기 함수 안에서)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false);
  }, [load]);

  const ins = data?.insights;
  const w = data?.kpisWeekAgo ?? null;
  const total = data?.users.total ?? 0;

  const todos = ins
    ? [
        ins.ops.pendingInquiries > 0 && {
          key: "inq",
          icon: <IconMessageQuestion size={20} stroke={1.75} />,
          title: `답변 기다리는 문의 ${ins.ops.pendingInquiries}개`,
          detail: ins.ops.oldestPendingDays !== null ? `가장 오래된 문의가 ${ins.ops.oldestPendingDays}일째 기다리고 있어요` : "문의 관리에서 답변해 주세요",
          onClick: () => router.push("/admin/inquiries?status=pending"),
        },
        ins.monetization.codesExpiringIn7d > 0 && {
          key: "exp",
          icon: <IconClockHour4 size={20} stroke={1.75} />,
          title: `7일 안에 끝나는 이용권 ${ins.monetization.codesExpiringIn7d}개`,
          detail: "연장 안내가 필요한지 확인해 보세요",
          onClick: () => router.push("/admin/unlock-codes?status=active"),
        },
        ins.monetization.unusedCodes < 5 && {
          key: "stock",
          icon: <IconKey size={20} stroke={1.75} />,
          title: `나눠 줄 이용권이 ${ins.monetization.unusedCodes}개 남았어요`,
          detail: "이용권 코드 관리에서 새로 만들 수 있어요",
          onClick: () => router.push("/admin/unlock-codes?status=unused"),
        },
      ].filter(Boolean) as { key: string; icon: React.ReactNode; title: string; detail: string; onClick?: () => void }[]
    : [];

  const daily = ins?.daily ?? [];
  const activeSeries = daily.filter((d) => d.activeUsers7d !== null);

  return (
    <div className="pib-v2 min-h-full bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-title font-bold text-ink">대시보드</h1>
            <p className="m-0 text-caption text-sub">
              실제로 쓰는 사람 · 처음 쓰는 흐름 · 결제로 이어지는 곳을 봐요
              {data?.generatedAt && ` · ${new Date(data.generatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`}
              {data?.cached && " (5분 캐시)"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-card border border-line-strong bg-card px-4 text-body font-semibold text-ink hover:bg-fill disabled:opacity-40"
          >
            {loading ? <IconLoader2 size={18} stroke={2} className="animate-spin" /> : <IconRefresh size={18} stroke={1.9} />}
            새로 집계
          </button>
        </header>

        {error && (
          <p role="alert" className="m-0 flex items-center gap-2 text-body text-alert">
            <IconAlertCircle size={18} stroke={1.9} /> {error}
          </p>
        )}
        {!data && loading && <p className="m-0 py-20 text-center text-body text-sub">집계하고 있어요</p>}

        {data && ins && (
          <>
            {/* 오늘 할 일 */}
            {todos.length > 0 && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {todos.map(({ key, ...t }) => (
                  <Todo key={key} {...t} />
                ))}
              </div>
            )}

            {/* 핵심 숫자 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="최근 7일 활동한 사람"
                value={num(ins.kpis.activeUsers7d)}
                sub={`가입자의 ${pct(ins.kpis.activeUsers7d, total)}% · 30일 ${num(ins.kpis.activeUsers30d)}명`}
                delta={<Delta now={ins.kpis.activeUsers7d} before={w?.activeUsers7d} />}
              />
              <Kpi
                label="오늘 활동한 사람"
                value={num(ins.kpis.activeUsers1d)}
                sub={`7일 활동자 중 ${pct(ins.kpis.activeUsers1d, ins.kpis.activeUsers7d)}%`}
                delta={<Delta now={ins.kpis.activeUsers1d} before={w?.activeUsers1d} />}
              />
              <Kpi
                label="최근 7일 새로 가입"
                value={num(data.users.newLast7Days)}
                sub={`전체 가입자 ${num(total)}명`}
                delta={<Delta now={data.users.newLast7Days} before={data.trend.vsLastWeek ? data.users.newLast7Days - data.trend.vsLastWeek.users.newLast7Days : null} />}
                onClick={() => setModal("newUsers")}
              />
              <Kpi
                label="프리미엄 사용자"
                value={num(ins.kpis.premiumUsers)}
                sub={`가입자의 ${pct(ins.kpis.premiumUsers, total)}% · 구매 ${ins.monetization.viaPurchase} · 이용권 ${ins.monetization.viaCode}`}
                delta={<Delta now={ins.kpis.premiumUsers} before={w?.premiumUsers} />}
              />
            </div>

            {/* 추이 */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card>
                <CardTitle hint="최근 30일, 하루에 몇 명이 가입했는지">일별 가입</CardTitle>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--v2-line)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                      <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: "var(--v2-fill)" }}
                        labelFormatter={(d) => shortDate(String(d))}
                        formatter={(v) => [`${v}명`, "가입"]}
                        contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid var(--v2-line)", background: "var(--v2-card)" }}
                      />
                      <Bar dataKey="signups" fill="var(--v2-brand)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardTitle hint="그날 기준 최근 7일 동안 가방을 움직인 사람 수. 매일 밤 기록이 쌓여요">활동한 사람 추이</CardTitle>
                <div className="h-56">
                  {activeSeries.length >= 2 ? (
                    <ResponsiveContainer>
                      <LineChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--v2-line)" />
                        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                        <Tooltip
                          labelFormatter={(d) => shortDate(String(d))}
                          formatter={(v, name) => [`${v}명`, name === "activeUsers7d" ? "7일 활동" : "프리미엄"]}
                          contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid var(--v2-line)", background: "var(--v2-card)" }}
                        />
                        <Line type="monotone" dataKey="activeUsers7d" stroke="var(--v2-brand)" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="premiumUsers" stroke="var(--v2-sub)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                      <p className="m-0 text-body text-sub">기록이 쌓이는 중이에요</p>
                      <p className="m-0 text-caption text-faint">이틀 이상 쌓이면 선으로 보여요(실선 7일 활동 · 점선 프리미엄)</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* 처음 쓰는 흐름 */}
              <Card>
                <CardTitle hint={`최근 30일에 가입한 ${num(ins.funnel.signedUp)}명이 어디까지 써 봤는지`}>처음 쓰는 흐름</CardTitle>
                <div className="flex flex-col gap-4">
                  <RatioBar label="가방을 만들었어요" value={ins.funnel.madeBag} total={ins.funnel.signedUp} note="명" />
                  <RatioBar label="아이템을 넣었어요" value={ins.funnel.addedItems} total={ins.funnel.signedUp} note="명" />
                  <RatioBar label="체크해 봤어요" value={ins.funnel.checkedItem} total={ins.funnel.signedUp} note="명" />
                  <RatioBar label="누군가와 함께 써요" value={ins.funnel.shared} total={ins.funnel.signedUp} note="명" />
                  <div className="mt-2 rounded-field bg-fill px-4 py-3">
                    <p className="m-0 text-body text-ink">
                      다시 찾아온 비율 <strong className="font-bold">{pct(ins.retention.returned, ins.retention.cohort)}%</strong>
                    </p>
                    <p className="m-0 text-caption text-sub">
                      가입한 지 8~30일 된 {num(ins.retention.cohort)}명 중 최근 7일에 가방을 움직인 {num(ins.retention.returned)}명
                    </p>
                  </div>
                </div>
              </Card>

              {/* 기능 사용 */}
              <Card>
                <CardTitle hint={`휴지통 아닌 가방 ${num(ins.usage.bags)}개 중`}>기능을 얼마나 쓰나</CardTitle>
                <div className="flex flex-col gap-4">
                  <RatioBar label="함께 쓰는 가방(2명 이상)" value={ins.usage.sharedBags} total={ins.usage.bags} note="개" />
                  <RatioBar label="D-Day를 정한 가방" value={ins.usage.ddayBags} total={ins.usage.bags} note="개" />
                  <RatioBar label="한 번 이상 다 싼 가방" value={ins.usage.packedOnceBags} total={ins.usage.bags} note="개" />
                  <RatioBar label="메모 팩이 있는 가방" value={ins.usage.memoBags} total={ins.usage.bags} note="개" />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { k: "가방당 팩", v: String(ins.usage.avgPacksPerBag) },
                      { k: "가방당 아이템", v: String(ins.usage.avgItemsPerBag) },
                      { k: "팩 보관함", v: num(ins.usage.libraryPacks) },
                    ].map((x) => (
                      <div key={x.k} className="flex flex-col gap-1 rounded-field bg-fill px-3 py-3">
                        <span className="text-micro text-sub">{x.k}</span>
                        <span className="text-body-lg font-bold text-ink tabular-nums">{x.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* 결제 · AI */}
            <Card>
              <CardTitle hint="무료 한도에 닿은 사람은 프리미엄 안내를 이미 보고 있는 사람이에요">결제로 이어지는 곳</CardTitle>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { k: "가방 3개를 다 쓴 무료 사용자", v: ins.monetization.freeAtBagLimit, u: "명" },
                  { k: "인원이 가득 찬 무료 가방", v: ins.monetization.freeBagsAtMemberLimit, u: "개" },
                  { k: "오늘 AI를 쓴 사람", v: ins.ai.usersToday, u: `명 · ${num(ins.ai.callsToday)}회` },
                  { k: "나눠 줄 수 있는 이용권", v: ins.monetization.unusedCodes, u: "개" },
                ].map((x) => (
                  <div key={x.k} className="flex flex-col gap-1 rounded-field bg-fill px-4 py-3">
                    <span className="text-caption text-sub">{x.k}</span>
                    <span className="text-heading font-bold text-ink tabular-nums">
                      {num(x.v)}
                      <span className="ml-1 text-caption font-medium text-sub">{x.u}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 전체 규모 */}
            <Card>
              <CardTitle>전체 규모</CardTitle>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                {[
                  { k: "가입자", v: `${num(total)}명`, onClick: () => setModal("allUsers") },
                  { k: "가방", v: `${num(data.bags.active)}개 (휴지통 ${num(data.bags.trashed)})` },
                  { k: "가방 속 팩", v: `${num(data.packs.total)}개 (메모 ${num(data.packs.editor)})` },
                  { k: "아이템", v: `${num(data.items.total)}개 · 체크 ${pct(data.items.checked, data.items.total)}%` },
                  { k: "이용권", v: `사용 중 ${num(data.premium.activeCodes)} · 만료 ${num(data.premium.expiredCodes)} · 무효 ${num(data.premium.invalidatedCodes)}`, onClick: () => router.push("/admin/unlock-codes") },
                  { k: "문의", v: `${num(data.inquiries.total)}개 (미답변 ${num(data.inquiries.pending)})`, onClick: () => router.push("/admin/inquiries") },
                ].map((x) => (
                  <button
                    key={x.k}
                    type="button"
                    disabled={!x.onClick}
                    onClick={x.onClick}
                    className="flex items-baseline justify-between gap-3 border-b border-line bg-transparent py-2 text-left disabled:cursor-default enabled:hover:bg-fill"
                  >
                    <span className="flex items-center gap-1 text-caption text-sub">
                      {x.k === "가입자" && <IconUsers size={14} stroke={1.75} aria-hidden="true" />}
                      {x.k}
                    </span>
                    <span className="text-body text-ink tabular-nums">{x.v}</span>
                  </button>
                ))}
              </div>
              <p className="m-0 pt-4 text-micro text-faint">
                &lsquo;활동&rsquo;은 가방이 저장·체크된 시각으로 셉니다. 함께 쓰는 가방은 멤버 모두를 활동으로 보고, 팩 보관함만 쓴 사람은 빠져요. 운영자 계정은 프리미엄 수에서 뺐어요.
              </p>
            </Card>
          </>
        )}
      </div>

      {modal === "allUsers" && <UserListModal title="전체 가입자" newOnly={false} onClose={() => setModal(null)} />}
      {modal === "newUsers" && <UserListModal title="최근 7일 신규 가입" newOnly={true} onClose={() => setModal(null)} />}
    </div>
  );
}
