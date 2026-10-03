"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconLoader2, IconPlus } from "@tabler/icons-react";
import type { Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { Badge, Button, Sheet, cx } from "@/components/v2/ui";

interface MissingItem {
  category: string;
  text: string;
  reason: string;
  suggestedPackName: string;
}

type Result =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; items: MissingItem[]; advice: string | null };

// 가방 > 더보기 > 빠진 것 확인. 구 AiBagAuditModal 대체(같은 /api/ai-audit-bag).
// - 열 때 가방을 한 번 찍어 두고 그걸로 한 번만 묻는다. 구 모달은 가방이 바뀔 때마다(체크·담기 포함) 다시 물어서
//   "담기"를 누를 때마다 AI를 다시 부르고 횟수도 다시 썼다
// - 빠진 것마다 이유 · 넣을 팩, 오른쪽 "담기" → 그 이름의 팩에 넣는다(없으면 만든다: onAddItemToPack 규칙 그대로)
// - 하루 횟수 초과(403 limitReached)면 시트를 닫고 프리미엄 안내로
export function AuditSheet({
  open,
  bag,
  onClose,
  onAddItemToPack,
  onLimit,
}: {
  open: boolean;
  bag: Bag;
  onClose: () => void;
  onAddItemToPack: (packName: string, itemText: string) => void;
  onLimit: (message: string) => void;
}) {
  const { user } = useAuth();
  const [result, setResult] = useState<Result>({ status: "loading" });
  const [added, setAdded] = useState<Set<string>>(new Set());
  // 열릴 때의 가방(이걸로만 묻는다)
  const [snapshot, setSnapshot] = useState<Bag | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSnapshot(bag);
      setResult({ status: "loading" });
      setAdded(new Set());
    } else {
      setSnapshot(null);
    }
  }

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    (async () => {
      if (!user) throw new Error("로그인이 필요해요");
      const w = snapshot.aiRecommendCache?.weatherInfo;
      const res = await fetch("/api/ai-audit-bag", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({
          bagName: snapshot.name,
          travelDate: snapshot.travelDate,
          weatherSummary: w ? `${snapshot.aiRecommendCache?.city} 날씨: ${w.weatherText}, ${w.tempMin}°C ~ ${w.tempMax}°C` : undefined,
          packs: snapshot.packs
            .filter((p) => p.kind !== "editor" && p.type !== "folder")
            .map((p) => ({ name: p.name, items: p.items.map((i) => i.text) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        if (res.status === 403 && data?.limitReached) {
          onClose();
          onLimit(data.error ?? "오늘 AI 사용 횟수를 다 썼어요");
          return;
        }
        throw new Error(data?.error ?? "AI 분석에 실패했어요");
      }
      setResult({ status: "done", items: data.missingItems ?? [], advice: data.tripAdvice ?? null });
    })().catch((err) => {
      if (!cancelled) setResult({ status: "error", message: err instanceof Error ? err.message : "오류가 생겼어요" });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 찍은 가방으로 한 번만 묻는다
  }, [snapshot]);

  const add = (item: MissingItem) => {
    onAddItemToPack(item.suggestedPackName, item.text);
    setAdded((prev) => new Set(prev).add(item.text));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="빠진 것 확인"
      size="tall"
      footer={
        <Button variant="secondary" block onClick={onClose}>
          닫기
        </Button>
      }
    >
      {result.status === "loading" ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-20 text-center">
          <IconLoader2 size={28} stroke={1.75} className="animate-spin text-brand" aria-hidden="true" />
          <p className="m-0 text-body font-semibold text-ink">가방을 살펴보고 있어요</p>
          <p className="m-0 text-caption text-sub">날짜 · 날씨 · 지금 아이템을 보고 놓치기 쉬운 것을 찾아요</p>
        </div>
      ) : result.status === "error" ? (
        <p role="alert" className="m-0 py-20 text-center text-body text-alert">
          {result.message}
        </p>
      ) : result.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
            <IconCheck size={22} stroke={2.4} />
          </span>
          <p className="m-0 text-body font-semibold text-ink">빠진 것이 없어요</p>
          <p className="m-0 text-caption text-sub">필요한 건 다 챙겼어요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {result.advice && <p className="m-0 rounded-card bg-brand-soft px-4 py-3 text-caption text-ink">{result.advice}</p>}
          <p className="m-0 text-micro font-semibold text-faint">챙기면 좋은 것 {result.items.length}개</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {result.items.map((item, i) => {
              const done = added.has(item.text);
              return (
                <li
                  key={`${item.text}-${i}`}
                  className={cx("flex items-start gap-3 py-3", i < result.items.length - 1 && "border-b border-line")}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink">{item.text}</span>
                      {item.category && <Badge>{item.category}</Badge>}
                    </span>
                    {item.reason && <span className="text-caption text-sub">{item.reason}</span>}
                    <span className="text-micro text-faint">넣을 팩 · {item.suggestedPackName}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={done ? "text" : "primary"}
                    disabled={done}
                    className="shrink-0 px-4"
                    leading={done ? <IconCheck size={16} stroke={2.4} /> : <IconPlus size={16} stroke={2.4} />}
                    onClick={() => add(item)}
                  >
                    {done ? "담음" : "담기"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
