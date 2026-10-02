"use client";

import { useEffect, useState } from "react";
import { IconRefresh, IconSparkles } from "@tabler/icons-react";
import type { WeatherInfo } from "@/lib/weatherService";
import type { WeatherStatus } from "@/hooks/bag";
import { Button, CheckMark, Sheet, cx } from "@/components/v2/ui";

// 날씨로 준비물 추천 시트. 열릴 때만 날씨를 확인한다(useBagWeather.load - 캐시가 있으면 호출 없음).
export function WeatherSheet({
  open,
  onClose,
  status,
  info,
  forecastDate,
  hasTravelDate,
  aiItems,
  aiLoading,
  aiError,
  existingTexts,
  onLoad,
  onAskAi,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  status: WeatherStatus;
  info: WeatherInfo | null;
  forecastDate: string | undefined;
  hasTravelDate: boolean;
  aiItems: string[];
  aiLoading: boolean;
  aiError: string | null;
  // 이미 가방에 있는 아이템 이름(추천에서 "이미 있음"으로 표시)
  existingTexts: Set<string>;
  // false를 돌려주면(프리미엄 아님) 시트를 닫는다
  onLoad: (force?: boolean) => Promise<boolean>;
  onAskAi: () => void;
  onAdd: (texts: string[]) => void;
}) {
  // 열릴 때마다 선택 초기화 + 날씨 확인
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDeselected(new Set());
  }
  useEffect(() => {
    if (!open) return;
    onLoad().then((ok) => {
      if (!ok) onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const suggestions = Array.from(
    new Set([...(info?.recommendations ?? []).map((r) => r.text.trim()), ...aiItems.map((t) => t.trim())].filter(Boolean)),
  );
  const isSelected = (t: string) => !existingTexts.has(t) && !deselected.has(t);
  const picked = suggestions.filter(isSelected);
  const toggle = (t: string) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const dateLabel = forecastDate
    ? `${Number(forecastDate.slice(5, 7))}월 ${Number(forecastDate.slice(8, 10))}일 예보`
    : "오늘 날씨";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="날씨로 준비물 추천"
      size="tall"
      footer={
        status === "ready" ? (
          <Button
            block
            disabled={picked.length === 0}
            onClick={() => {
              onAdd(picked);
              onClose();
            }}
          >
            {picked.length > 0 ? `${picked.length}개 담기` : "담을 아이템을 골라 주세요"}
          </Button>
        ) : undefined
      }
    >
      {status === "loading" || status === "idle" ? (
        <p className="m-0 py-10 text-center text-body text-sub">날씨를 확인하고 있어요</p>
      ) : status === "no-place" ? (
        <div className="flex flex-col gap-2 py-6 text-center">
          <p className="m-0 text-body text-ink">가방 이름에서 장소를 찾지 못했어요</p>
          <p className="m-0 text-caption text-sub">이름에 도시를 넣어 주세요. 예: 오사카 여행, 제주 캠핑</p>
        </div>
      ) : status === "failed" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="m-0 text-body text-ink">날씨를 가져오지 못했어요</p>
          <Button variant="secondary" size="sm" onClick={() => onLoad(true)} leading={<IconRefresh size={16} stroke={1.9} />}>
            다시 시도
          </Button>
        </div>
      ) : (
        info && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 rounded-card bg-fill px-4 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-caption text-sub">
                  {info.city} · {dateLabel}
                </span>
                <span className="text-body-lg font-semibold">
                  {info.weatherText} · {info.tempMin}° / {info.tempMax}°
                </span>
                {hasTravelDate && !forecastDate && (
                  <span className="text-micro text-faint">출발일 예보는 16일 전부터 볼 수 있어요</span>
                )}
              </div>
              <button
                type="button"
                aria-label="새로고침"
                title="새로고침"
                onClick={() => onLoad(true)}
                className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-field bg-transparent text-sub active:bg-line"
              >
                <IconRefresh size={18} stroke={1.9} />
              </button>
            </div>

            <ul className="m-0 flex list-none flex-col p-0">
              {suggestions.map((t) => {
                const exists = existingTexts.has(t);
                return (
                  <li key={t}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected(t)}
                      disabled={exists}
                      onClick={() => toggle(t)}
                      className={cx(
                        "flex min-h-12 w-full items-center gap-3 border-b border-line bg-transparent text-left",
                        exists && "opacity-50",
                      )}
                    >
                      <CheckMark checked={isSelected(t)} shape="square" />
                      <span className="min-w-0 flex-1 text-body">{t}</span>
                      {exists && <span className="text-caption text-faint">이미 있음</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col items-start gap-1">
              <Button
                variant="text"
                size="sm"
                className="px-0"
                disabled={aiLoading}
                onClick={onAskAi}
                leading={<IconSparkles size={16} stroke={1.9} />}
              >
                {aiLoading ? "AI가 고르는 중…" : aiItems.length > 0 ? "AI 추천 다시 받기" : "AI로 더 추천받기"}
              </Button>
              <span className="text-micro text-faint">누를 때마다 AI 하루 사용 횟수를 1회 써요</span>
              {aiError && <span className="text-caption text-alert">{aiError}</span>}
            </div>
            <p className="m-0 text-caption text-faint">담은 아이템은 &lsquo;날씨 추천&rsquo; 팩으로 모여요.</p>
          </div>
        )
      )}
    </Sheet>
  );
}
