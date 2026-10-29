"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconChevronDown, IconUserPlus } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import AppBridge from "@/components/AppBridge";
import { openViaBridge } from "@/lib/v2/appBridge";
import { Badge, CheckMark, ProgressBar, cx } from "@/components/v2/ui";
import { GuestShell } from "./GuestShell";
import { GuestMemoBlock } from "./GuestMemoBlock";
import { ddayText } from "@/lib/v2/widgetStyles";

// 가방 보기 링크(/v/{토큰}) v2(2026-10-15, share.md 확인 필요 9). 예전 GuestBagClientView를 대신한다.
// - 서버(app/v/[token])가 보이는 필드만 넘긴다(초대코드 · 멤버 · 그룹장 · 가방 사진 없음)
// - 체크는 이 브라우저에만(guest_check_{bagId}), 가방에는 쓰지 않는다
// - 주소에 ?code= / ?join=이 있으면 "참여하기", 없으면 "앱에서 열기"

export function GuestBagViewV2({ bag }: { bag: Bag }) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const code = (q.get("code") || q.get("join") || "").trim();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소는 처음 한 번만 읽는다
      if (code) setInviteCode(code);
    } catch {}
  }, []);

  const packs = useMemo(() => (bag.packs ?? []).filter((p) => p.type !== "folder"), [bag.packs]);
  const storageKey = `guest_check_${bag.id}`;
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    packs.forEach((p) => p.items?.forEach((i) => (init[i.id] = !!i.checked)));
    return init;
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 이 브라우저에 남긴 체크를 처음 한 번 읽는다
      if (saved && typeof saved === "object") setChecks((prev) => ({ ...prev, ...saved }));
    } catch {}
  }, [storageKey]);
  const toggle = (id: string) =>
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

  // 처음엔 모두 접힘
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = packs.length > 0 && packs.every((p) => open.has(p.id));
  const togglePack = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const checkItems = packs.filter((p) => p.kind !== "editor").flatMap((p) => (p.items ?? []).filter((i) => i.type !== "text"));
  const done = checkItems.filter((i) => checks[i.id]).length;
  // 위젯과 같은 문구 · 기기 날짜 기준(예전엔 날짜를 UTC로 읽어 하루 어긋날 수 있었음), 당일을 1일로 세기도 따른다(2026-10-29)
  const dday = ddayText(bag.travelDate, new Date(), !!bag.ddayCountTodayAsDayOne) ?? "";
  const entryUrl = inviteCode ? `/?invite=${encodeURIComponent(inviteCode)}` : `/?openBag=${bag.id}`;

  return (
    <GuestShell
      wakeLock
      badge={<Badge tone="brand">{inviteCode ? "초대" : "보기 전용"}</Badge>}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-semibold">{inviteCode ? "함께 챙기기" : "팩인백에서 열기"}</span>
            <span className="truncate text-caption text-sub">
              {inviteCode ? "참여하면 같은 가방을 실시간으로 함께 챙겨요" : "가방 멤버라면 앱에서 바로 열려요"}
            </span>
          </div>
          <Link
            href={entryUrl}
            onClick={(e) => {
              // 아이폰은 앱으로, 앱 안 브라우저(카톡 등)는 기본 브라우저로(lib/v2/appBridge)
              if (openViaBridge(entryUrl)) e.preventDefault();
            }}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-card bg-ink px-5 text-body font-semibold text-on-ink no-underline"
          >
            {inviteCode ? <IconUserPlus size={18} stroke={2} /> : null}
            {inviteCode ? "참여하기" : "열기"}
            {!inviteCode && <IconArrowRight size={16} stroke={2} />}
          </Link>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pt-5 pb-8">
        <section className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <h1 className="m-0 min-w-0 flex-1 text-title font-bold break-words">{bag.name}</h1>
            {dday && <Badge tone="solid" className="mt-2">{dday}</Badge>}
          </div>
          {bag.travelDate && <p className="m-0 text-caption text-sub">{bag.travelDate}</p>}
          {bag.notice && <p className="m-0 rounded-card bg-fill px-4 py-3 text-body whitespace-pre-wrap text-sub">{bag.notice}</p>}
          {checkItems.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center justify-between text-caption">
                <span className="text-sub">챙긴 것</span>
                <span className="font-semibold text-brand">
                  {done} / {checkItems.length}
                </span>
              </div>
              <ProgressBar value={checkItems.length ? done / checkItems.length : 0} label="챙긴 비율" />
            </div>
          )}
        </section>

        <div className="flex items-center justify-between">
          <span className="text-caption text-faint">체크는 이 브라우저에만 저장돼요</span>
          {packs.length > 1 && (
            <button
              type="button"
              onClick={() => setOpen(allOpen ? new Set() : new Set(packs.map((p) => p.id)))}
              className="h-11 rounded-field px-2 text-caption font-semibold text-brand active:bg-fill"
            >
              {allOpen ? "모두 접기" : "모두 펴기"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {packs.map((p) => {
            const isMemo = p.kind === "editor";
            const items = p.items ?? [];
            const checkable = items.filter((i) => i.type !== "text");
            const packDone = checkable.filter((i) => checks[i.id]).length;
            const isOpen = open.has(p.id);
            return (
              <section key={p.id} className="overflow-hidden rounded-card border border-line bg-card">
                <button
                  type="button"
                  onClick={() => togglePack(p.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-14 w-full items-center gap-2 px-4 text-left active:bg-fill"
                >
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">{p.name}</span>
                  {isMemo ? (
                    <Badge>메모</Badge>
                  ) : (
                    checkable.length > 0 && (
                      <Badge tone={packDone === checkable.length ? "brand" : "neutral"}>
                        {packDone}/{checkable.length}
                      </Badge>
                    )
                  )}
                  <IconChevronDown
                    size={18}
                    stroke={1.9}
                    className={cx("shrink-0 text-faint transition-transform duration-200 ease-snappy", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-line px-4 pt-2 pb-3">
                    {isMemo ? (
                      <GuestMemoBlock pack={p} />
                    ) : items.length === 0 ? (
                      <p className="m-0 py-2 text-caption text-faint">아이템이 없어요</p>
                    ) : (
                      <ul className="m-0 flex list-none flex-col p-0">
                        {items.map((i) =>
                          i.type === "text" ? (
                            <li key={i.id} className={cx("py-2 text-body text-sub", i.bold && "font-semibold")}>
                              {i.text}
                            </li>
                          ) : (
                            <li key={i.id}>
                              <button
                                type="button"
                                onClick={() => toggle(i.id)}
                                aria-pressed={!!checks[i.id]}
                                className="flex min-h-12 w-full items-center gap-3 rounded-field text-left active:bg-fill"
                              >
                                <CheckMark checked={!!checks[i.id]} />
                                <span className={cx("min-w-0 flex-1 text-body", checks[i.id] ? "text-faint line-through" : "text-ink", i.bold && "font-semibold")}>
                                  {i.text}
                                </span>
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
      {/* 초대 링크로 들어오면 앱 · 기본 브라우저로 넘긴다(로그인 없는 카톡 안 브라우저 대신) */}
      <AppBridge path={entryUrl} auto={!!inviteCode} />
    </GuestShell>
  );
}
