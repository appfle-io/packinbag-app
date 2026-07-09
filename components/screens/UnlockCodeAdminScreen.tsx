"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowLeft, IconCopy, IconPlus, IconBan } from "@tabler/icons-react";
import { useSwipeBack } from "@/lib/useSwipeBack";
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

const DURATION_OPTIONS: UnlockDurationType[] = ["unlimited", "7d", "1m", "1y", "custom"];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function durationLabel(entry: UnlockCodeEntry): string {
  if (entry.durationType === "unlimited") return "무제한";
  if (entry.durationType === "custom") return `${entry.durationDays ?? "?"}일`;
  return UNLOCK_DURATION_LABELS[entry.durationType];
}

export default function UnlockCodeAdminScreen({ onBack }: { onBack: () => void }) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(() => onBack());
  const { show } = useToast();
  const [codes, setCodes] = useState<UnlockCodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [count, setCount] = useState("1");
  const [durationType, setDurationType] = useState<UnlockDurationType>("unlimited");
  const [customDays, setCustomDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string[]>([]);
  const [invalidatingCode, setInvalidatingCode] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setCodes(await listUnlockCodes());
    } catch (err) {
      console.error("[팩인백] 이용권 코드 조회 실패:", err);
      show("코드 목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) {
      show("생성할 개수를 확인해주세요");
      return;
    }
    if (durationType === "custom" && !(parseInt(customDays, 10) > 0)) {
      show("기간(일수)을 확인해주세요");
      return;
    }
    setCreating(true);
    try {
      const created = await createUnlockCodesBulk(
        n,
        note,
        durationType,
        durationType === "custom" ? parseInt(customDays, 10) : undefined
      );
      setJustCreated(created);
      setNote("");
      setCount("1");
      await refresh();
      show(n === 1 ? `새 코드가 생성됐어요: ${created[0]}` : `코드 ${n}개가 생성됐어요`);
    } catch (err) {
      console.error("[팩인백] 이용권 코드 생성 실패:", err);
      show("코드 생성에 실패했어요");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show("복사했어요");
    } catch {
      show("복사에 실패했어요");
    }
  };

  const handleInvalidate = async (code: string) => {
    setInvalidatingCode(code);
    try {
      await invalidateUnlockCode(code);
      await refresh();
      show("코드를 무효화했어요");
    } catch (err) {
      console.error("[팩인백] 이용권 코드 무효화 실패:", err);
      show("무효화에 실패했어요");
    } finally {
      setInvalidatingCode(null);
    }
  };

  const unusedCodes = useMemo(() => codes.filter((c) => c.status === "unused"), [codes]);

  // 사용된(claimed/invalidated) 코드를 사용한 사람(이메일) 기준으로 묶기.
  // 한 사람이 코드를 여러 개 썼을 수 있으므로(무효화/만료 후 재발급) person -> 코드 목록(1:N).
  const byPerson = useMemo(() => {
    const groups = new Map<string, UnlockCodeEntry[]>();
    for (const c of codes) {
      if (c.status === "unused") continue;
      const key = c.claimedByEmail ?? "(알 수 없음)";
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }
    // 각 사람 안에서는 최신 사용 순으로, 사람들 사이에는 가장 최근 사용한 사람이 위로.
    const entries = Array.from(groups.entries()).map(([email, list]) => {
      const sorted = [...list].sort((a, b) => (b.claimedAt ?? "").localeCompare(a.claimedAt ?? ""));
      return { email, codes: sorted, latest: sorted[0]?.claimedAt ?? "" };
    });
    entries.sort((a, b) => b.latest.localeCompare(a.latest));
    return entries;
  }, [codes]);

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={22} stroke={1.75} />
        </button>
        <span className="text-[16px] font-medium">이용권 코드 관리</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="text-[12px] text-text-secondary mb-3">
          여기서 생성한 코드를 설정 &gt; 이용권 코드 입력에서 입력한 사용자는 AI 기능을
          무제한으로 쓸 수 있어요. (10자리 대문자+숫자, 랜덤 생성 · 코드 1개는 1명만 사용
          가능해요 · 기간은 사용 시점부터 계산돼요)
        </p>

        <div className="flex gap-1.5 mb-2 flex-wrap">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setDurationType(opt)}
              className="rounded-full px-3 py-1.5 text-[12px] font-medium"
              style={
                durationType === opt
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--surface-2)", color: "var(--text-secondary)" }
              }
            >
              {UNLOCK_DURATION_LABELS[opt]}
            </button>
          ))}
        </div>

        {durationType === "custom" && (
          <div className="flex items-center gap-2 mb-2">
            <input
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="일수"
              className="w-20 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none text-center"
            />
            <span className="text-[12px] text-text-secondary">일 동안 유효</span>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="개수"
            className="w-16 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none text-center"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="공통 메모 (예: 2026 여름 이벤트)"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg px-3 py-2 text-[13px] font-medium flex items-center gap-1 disabled:opacity-50 shrink-0"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <IconPlus size={14} stroke={1.75} />
            생성
          </button>
        </div>

        {justCreated.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-2 p-3 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium">방금 생성한 코드 {justCreated.length}개</p>
              <button
                onClick={() => handleCopy(justCreated.join("\n"))}
                className="text-[11px] flex items-center gap-1"
                style={{ color: "var(--accent)" }}
              >
                <IconCopy size={12} stroke={1.75} />
                전체 복사
              </button>
            </div>
            <p className="text-[12px] tracking-widest leading-relaxed break-all">
              {justCreated.join(", ")}
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-text-muted py-6 text-center">불러오는 중...</p>
        ) : (
          <>
            <p className="text-[12px] font-medium text-text-secondary mb-2">
              미배포 코드 ({unusedCodes.length})
            </p>
            {unusedCodes.length === 0 ? (
              <p className="text-[13px] text-text-muted py-4 text-center mb-6">
                아직 나눠주지 않은 코드가 없어요
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden mb-6">
                {unusedCodes.map((c, idx) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between p-3"
                    style={{
                      borderBottom: idx < unusedCodes.length - 1 ? "1px solid var(--border)" : undefined,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-medium tracking-widest">{c.code}</p>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "var(--border)", color: "var(--text-muted)" }}
                        >
                          {durationLabel(c)}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted truncate">{c.note || "메모 없음"}</p>
                    </div>
                    <button
                      onClick={() => handleCopy(c.code)}
                      aria-label="코드 복사"
                      className="-m-2 p-2 shrink-0"
                    >
                      <IconCopy size={16} stroke={1.75} color="var(--text-muted)" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[12px] font-medium text-text-secondary mb-2">
              사용자별 사용 현황 ({byPerson.length}명)
            </p>
            {byPerson.length === 0 ? (
              <p className="text-[13px] text-text-muted py-4 text-center">
                아직 사용된 코드가 없어요
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {byPerson.map((person) => (
                  <div key={person.email} className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-surface-2">
                      <p className="text-[13px] font-medium truncate">{person.email}</p>
                    </div>
                    {person.codes.map((c, idx) => {
                      const displayStatus = unlockCodeDisplayStatus(c);
                      const badgeStyle =
                        displayStatus === "active"
                          ? { background: "var(--accent)", color: "#fff" }
                          : { background: "var(--border)", color: "var(--text-muted)" };
                      const badgeText =
                        displayStatus === "active"
                          ? "사용중"
                          : displayStatus === "expired"
                          ? "만료됨"
                          : "무효화됨";
                      return (
                        <div
                          key={c.code}
                          className="flex items-center justify-between p-3"
                          style={{
                            borderBottom:
                              idx < person.codes.length - 1 ? "1px solid var(--border)" : undefined,
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-[13px] font-medium tracking-widest">{c.code}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={badgeStyle}>
                                {badgeText}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                              >
                                {durationLabel(c)}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-muted truncate">
                              {c.note || "메모 없음"} · {formatDate(c.claimedAt)} 사용
                              {c.expiresAt && ` · ${formatDate(c.expiresAt)} 만료`}
                              {displayStatus === "invalidated" && ` · ${formatDate(c.invalidatedAt)} 무효화`}
                            </p>
                          </div>
                          {displayStatus === "active" && (
                            <button
                              onClick={() => handleInvalidate(c.code)}
                              disabled={invalidatingCode === c.code}
                              aria-label="코드 무효화"
                              className="-m-2 p-2 shrink-0 disabled:opacity-50 flex items-center gap-1"
                            >
                              <IconBan size={16} stroke={1.75} color="var(--danger)" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
