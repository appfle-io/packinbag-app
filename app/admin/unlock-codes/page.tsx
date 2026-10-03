"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconBan, IconCopy, IconPlus } from "@tabler/icons-react";
import { useToast } from "@/components/Toast";
import {
  UnlockCodeEntry,
  UnlockDurationType,
  UNLOCK_DURATION_LABELS,
  createUnlockCodesBulk,
  invalidateUnlockCode,
  listUnlockCodes,
  unlockCodeDisplayStatus,
} from "@/lib/aiUsageService";
import { Badge, Button, Chip, IconButton, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { ADMIN_FIELD, AdminCard, AdminEmpty, AdminLoading, AdminPage } from "@/components/admin/AdminPage";

type StatusFilter = "all" | "unused" | "active" | "expired" | "invalidated";
const VALID_FILTERS: StatusFilter[] = ["all", "unused", "active", "expired", "invalidated"];
const FILTER_LABELS: Record<StatusFilter, string> = { all: "전체", unused: "나눠 주기 전", active: "사용 중", expired: "만료", invalidated: "무효화" };
const DURATION_OPTIONS: UnlockDurationType[] = ["unlimited", "7d", "1m", "1y", "custom"];
const STATUS_LABEL = { active: "사용 중", expired: "만료", invalidated: "무효화" } as const;

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

function durationLabel(entry: UnlockCodeEntry) {
  if (entry.durationType === "unlimited") return "무제한";
  if (entry.durationType === "custom") return `${entry.durationDays ?? "?"}일`;
  return UNLOCK_DURATION_LABELS[entry.durationType];
}

function UnlockCodesInner() {
  const searchParams = useSearchParams();
  const param = searchParams.get("status") as StatusFilter | null;
  const { show } = useToast();
  const [filter, setFilter] = useState<StatusFilter>(param && VALID_FILTERS.includes(param) ? param : "all");
  const [codes, setCodes] = useState<UnlockCodeEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [note, setNote] = useState("");
  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState<UnlockDurationType>("unlimited");
  const [customDays, setCustomDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string[]>([]);
  const [invalidateCode, setInvalidateCode] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listUnlockCodes(100);
      setCodes(res.codes);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error("[팩인백] 이용권 코드 조회 실패:", err);
      show("코드 목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 처음 한 번 불러오기(로딩 표시 후 비동기)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore || codes.length === 0) return;
    setLoadingMore(true);
    try {
      const res = await listUnlockCodes(100, codes[codes.length - 1].createdAt);
      setCodes((prev) => [...prev, ...res.codes]);
      setHasMore(res.hasMore);
    } catch {
      show("코드를 더 불러오지 못했어요");
    } finally {
      setLoadingMore(false);
    }
  };

  const create = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) return show("만들 개수를 확인해 주세요");
    if (duration === "custom" && !(parseInt(customDays, 10) > 0)) return show("기간(일)을 확인해 주세요");
    setCreating(true);
    try {
      const created = await createUnlockCodesBulk(n, note, duration, duration === "custom" ? parseInt(customDays, 10) : undefined);
      setJustCreated(created);
      setNote("");
      setCount("1");
      await refresh();
      show(n === 1 ? `코드를 만들었어요: ${created[0]}` : `코드 ${n}개를 만들었어요`);
    } catch (err) {
      console.error("[팩인백] 이용권 코드 생성 실패:", err);
      show("코드를 만들지 못했어요");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show("복사했어요");
    } catch {
      show("복사하지 못했어요");
    }
  };

  const invalidate = async (code: string) => {
    try {
      await invalidateUnlockCode(code);
      await refresh();
      show("코드를 무효화했어요");
    } catch (err) {
      console.error("[팩인백] 이용권 코드 무효화 실패:", err);
      show("무효화하지 못했어요");
    }
  };

  const unused = useMemo(() => codes.filter((c) => c.status === "unused"), [codes]);
  const byPerson = useMemo(() => {
    const groups = new Map<string, UnlockCodeEntry[]>();
    for (const c of codes) {
      if (c.status === "unused") continue;
      if (filter !== "all" && filter !== "unused" && unlockCodeDisplayStatus(c) !== filter) continue;
      const key = c.claimedByEmail ?? "(알 수 없음)";
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries())
      .map(([email, list]) => {
        const sorted = [...list].sort((a, b) => (b.claimedAt ?? "").localeCompare(a.claimedAt ?? ""));
        return { email, codes: sorted, latest: sorted[0]?.claimedAt ?? "" };
      })
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [codes, filter]);

  const showUnused = filter === "all" || filter === "unused";
  const showUsed = filter !== "unused";

  return (
    <AdminPage title="이용권 코드" description="10자리 코드 · 한 코드는 한 사람만 · 기간은 입력한 날부터 세요" wide>
      {/* 만들기 */}
      <AdminCard title="코드 만들기">
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="기간" className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <Chip key={o} label={UNLOCK_DURATION_LABELS[o]} selected={duration === o} onClick={() => setDuration(o)} />
            ))}
            {duration === "custom" && (
              <span className="flex items-center gap-2">
                <input
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  aria-label="일수"
                  className={cx(ADMIN_FIELD, "h-9 w-20 px-3 text-center")}
                />
                <span className="text-caption text-sub">일</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              aria-label="개수"
              className={cx(ADMIN_FIELD, "w-20 text-center")}
            />
            <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="메모" placeholder="메모 (예: 2026 가을 이벤트)" className={cx(ADMIN_FIELD, "min-w-48 flex-1")} />
            <Button size="sm" disabled={creating} leading={<IconPlus size={18} stroke={2} />} onClick={create}>
              {creating ? "만드는 중" : "만들기"}
            </Button>
          </div>
          {justCreated.length > 0 && (
            <div className="flex flex-col gap-2 rounded-field bg-brand-soft px-4 py-3">
              <span className="flex items-center justify-between gap-2">
                <span className="text-caption font-semibold text-brand">방금 만든 코드 {justCreated.length}개</span>
                <Button variant="text" size="sm" className="px-2" leading={<IconCopy size={16} stroke={1.75} />} onClick={() => copy(justCreated.join("\n"))}>
                  모두 복사
                </Button>
              </span>
              <p className="m-0 break-all font-mono text-body tracking-widest text-ink">{justCreated.join(", ")}</p>
            </div>
          )}
        </div>
      </AdminCard>

      <div role="group" aria-label="상태" className="flex flex-wrap gap-2">
        {VALID_FILTERS.map((f) => (
          <Chip key={f} label={FILTER_LABELS[f]} selected={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : (
        <div className={cx("grid grid-cols-1 gap-3", showUnused && showUsed && "lg:grid-cols-2")}>
          {showUnused && (
            <AdminCard title={`나눠 주기 전 ${unused.length}`}>
              {unused.length === 0 ? (
                <AdminEmpty>나눠 줄 코드가 없어요</AdminEmpty>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {unused.map((c, i) => (
                    <li key={c.code} className={cx("flex items-center gap-2 py-2", i < unused.length - 1 && "border-b border-line")}>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-body font-semibold tracking-widest text-ink">{c.code}</span>
                          <Badge>{durationLabel(c)}</Badge>
                        </span>
                        <span className="truncate text-caption text-sub">{c.note || "메모 없음"}</span>
                      </span>
                      <IconButton label="복사" onClick={() => copy(c.code)}>
                        <IconCopy size={20} stroke={1.75} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          )}

          {showUsed && (
            <AdminCard title={`사람별 사용 ${byPerson.length}명`}>
              {byPerson.length === 0 ? (
                <AdminEmpty>사용된 코드가 없어요</AdminEmpty>
              ) : (
                <div className="flex flex-col gap-4">
                  {byPerson.map((p) => (
                    <div key={p.email} className="flex flex-col">
                      <span className="truncate pb-1 text-caption font-semibold text-sub">{p.email}</span>
                      <ul className="m-0 flex list-none flex-col p-0">
                        {p.codes.map((c, i) => {
                          const st = unlockCodeDisplayStatus(c) as keyof typeof STATUS_LABEL;
                          return (
                            <li key={c.code} className={cx("flex items-center gap-2 py-2", i < p.codes.length - 1 && "border-b border-line")}>
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-body font-semibold tracking-widest text-ink">{c.code}</span>
                                  <Badge tone={st === "active" ? "brand" : "neutral"}>{STATUS_LABEL[st] ?? st}</Badge>
                                  <Badge>{durationLabel(c)}</Badge>
                                </span>
                                <span className="truncate text-caption text-sub">
                                  {c.note || "메모 없음"} · {formatDate(c.claimedAt)} 사용
                                  {c.expiresAt && ` · ${formatDate(c.expiresAt)} 만료`}
                                  {st === "invalidated" && ` · ${formatDate(c.invalidatedAt)} 무효화`}
                                </span>
                              </span>
                              {st === "active" && (
                                <IconButton label="무효화" className="text-alert" onClick={() => setInvalidateCode(c.code)}>
                                  <IconBan size={20} stroke={1.75} />
                                </IconButton>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          )}
        </div>
      )}

      {hasMore && !loading && (
        <Button variant="secondary" className="self-center" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? "불러오는 중" : "이전 코드 더 보기"}
        </Button>
      )}

      <ConfirmSheet
        open={!!invalidateCode}
        onClose={() => setInvalidateCode(null)}
        title="이 코드를 무효화할까요?"
        message="그 사람은 바로 무료로 돌아가요. 되돌릴 수 없어요."
        confirmLabel="무효화"
        danger
        onConfirm={() => invalidateCode && invalidate(invalidateCode)}
      />
    </AdminPage>
  );
}

export default function AdminUnlockCodesPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <UnlockCodesInner />
    </Suspense>
  );
}
