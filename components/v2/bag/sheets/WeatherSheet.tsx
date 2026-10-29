"use client";

import { useEffect, useState } from "react";
import { IconMapPin, IconRefresh, IconSparkles } from "@tabler/icons-react";
import type { WeatherAiResult, WeatherInfo } from "@/lib/weatherService";
import type { WeatherStatus } from "@/hooks/bag";
import { Button, CheckMark, SectionHeader, Sheet, cx } from "@/components/v2/ui";

interface Row {
  key: string;
  text: string;
  sub?: string;
}

// 장소 직접 입력 칸(장소를 못 찾았을 때 · "장소 바꾸기")
function PlaceForm({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (t: string) => void; onCancel?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          aria-label="장소"
          placeholder="예: 서귀포, 오사카, 설악산"
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 rounded-field border border-line bg-card px-4 text-body outline-none placeholder:text-faint focus:border-ink"
        />
        <Button type="submit" size="sm" disabled={!value.trim() && !initial}>
          찾기
        </Button>
      </div>
      <div className="flex items-center gap-3">
        {initial && (
          <Button type="button" variant="text" size="sm" className="px-0" onClick={() => onSubmit("")}>
            가방 이름으로 찾기
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="text" size="sm" className="px-0 text-sub" onClick={onCancel}>
            취소
          </Button>
        )}
      </div>
    </form>
  );
}

function CheckRows({
  rows,
  existing,
  isSelected,
  onToggle,
}: {
  rows: Row[];
  existing: Set<string>;
  isSelected: (r: Row) => boolean;
  onToggle: (r: Row) => void;
}) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map((r, i) => {
        const exists = existing.has(r.text);
        return (
          <li key={r.key}>
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected(r)}
              disabled={exists}
              onClick={() => onToggle(r)}
              className={cx(
                "flex min-h-12 w-full items-center gap-3 bg-transparent py-2 text-left",
                i < rows.length - 1 && "border-b border-line",
                exists && "opacity-50",
              )}
            >
              <CheckMark checked={isSelected(r)} shape="square" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body text-ink">{r.text}</span>
                {r.sub && <span className="text-caption text-sub">{r.sub}</span>}
              </span>
              {exists && <span className="shrink-0 text-caption text-faint">이미 있음</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// 날씨 · 명소 추천 시트(2026-10-20, _secrets/docs/spec/bag.md § BAG-WX). 열릴 때만 날씨를 확인한다(useBagWeather.load - 저장된 결과가 있으면 호출 없음).
// 날씨는 조회한 날부터 3일. 기본 추천(무료 계산)이 먼저 보이고, AI는 버튼을 눌러야 부른다(하루 횟수)
export function WeatherSheet({
  open,
  onClose,
  status,
  info,
  ai,
  aiLoading,
  aiError,
  existingTexts,
  manualPlace,
  onLoad,
  onSetPlace,
  onAskAi,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  status: WeatherStatus;
  info: WeatherInfo | null;
  ai: WeatherAiResult | null;
  aiLoading: boolean;
  aiError: string | null;
  // 이미 가방에 있는 아이템 이름(추천에서 "이미 있음"으로 표시)
  existingTexts: Set<string>;
  // 직접 입력한 장소(없으면 "")
  manualPlace: string;
  // false를 돌려주면(프리미엄 아님) 시트를 닫는다
  onLoad: (force?: boolean) => Promise<boolean>;
  onSetPlace: (text: string) => void;
  onAskAi: () => void;
  onAdd: (items: string[], places: string[]) => void;
}) {
  // 열릴 때마다 선택 초기화 + 날씨 확인
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [editingPlace, setEditingPlace] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDeselected(new Set());
      setEditingPlace(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    onLoad().then((ok) => {
      if (!ok) onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 챙길 것: AI 추천(이유가 더 자세함) 먼저, 그다음 기본 추천 중 겹치지 않는 것
  const itemRows: Row[] = [];
  const seen = new Set<string>();
  for (const r of [
    ...(ai?.items ?? []).map((i) => ({ text: i.text, sub: i.reason })),
    ...(info?.recommendations ?? []).map((r) => ({ text: r.text, sub: r.reason })),
  ]) {
    const t = r.text.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    itemRows.push({ key: `i:${t}`, text: t, sub: r.sub || undefined });
  }
  const placeRows: Row[] = (ai?.places ?? [])
    .map((p) => ({ key: `p:${p.name.trim()}`, text: p.name.trim(), sub: p.desc || undefined }))
    .filter((r) => r.text && !seen.has(r.text));

  const isSelected = (r: Row) => !existingTexts.has(r.text) && !deselected.has(r.key);
  const toggle = (r: Row) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(r.key)) next.delete(r.key);
      else next.add(r.key);
      return next;
    });
  const pickedItems = itemRows.filter(isSelected).map((r) => r.text);
  const pickedPlaces = placeRows.filter(isSelected).map((r) => r.text);
  const pickedCount = pickedItems.length + pickedPlaces.length;
  const days = info?.days ?? [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="날씨 · 명소 추천"
      size="tall"
      footer={
        status === "ready" ? (
          <Button
            block
            disabled={pickedCount === 0}
            onClick={() => {
              onAdd(pickedItems, pickedPlaces);
              onClose();
            }}
          >
            {pickedCount > 0 ? `${pickedCount}개 담기` : "담을 것을 골라 주세요"}
          </Button>
        ) : undefined
      }
    >
      {status === "loading" || status === "idle" ? (
        <p className="m-0 py-10 text-center text-body text-sub">날씨를 확인하고 있어요</p>
      ) : status === "no-place" ? (
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-body text-ink">{manualPlace ? `'${manualPlace}'을(를) 찾지 못했어요` : "가방 이름에서 장소를 찾지 못했어요"}</p>
            <p className="m-0 text-caption text-sub">날씨를 볼 장소를 적어 주세요. 도시나 지역 이름이 잘 찾아져요.</p>
          </div>
          <PlaceForm key="no-place" initial={manualPlace} onSubmit={onSetPlace} />
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
          <div className="flex flex-col gap-6">
            {/* 날씨: 오늘 · 내일 · 모레 */}
            <div className="flex flex-col gap-3 rounded-card bg-fill px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1 text-caption text-sub">
                  <IconMapPin size={14} stroke={1.9} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{info.city} · 오늘부터 3일</span>
                </span>
                <button
                  type="button"
                  aria-label="새로고침"
                  title="새로고침"
                  onClick={() => onLoad(true)}
                  className="-my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-field bg-transparent text-sub active:bg-line"
                >
                  <IconRefresh size={18} stroke={1.9} />
                </button>
              </div>
              {days.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {days.map((d) => (
                    <div key={d.date} className="flex min-w-0 flex-col gap-1">
                      <span className="text-micro text-faint">{d.label}</span>
                      <span className="truncate text-body font-semibold">{d.weatherText}</span>
                      <span className="text-caption text-ink">
                        {d.tempMin}° / {d.tempMax}°
                      </span>
                      {d.rainProb != null && <span className="text-micro text-sub">비 {d.rainProb}%</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-body-lg font-semibold">
                  {info.weatherText} · {info.tempMin}° / {info.tempMax}°
                </span>
              )}
              {ai?.summary && <p className="m-0 text-caption text-ink">{ai.summary}</p>}
            </div>

            {editingPlace ? (
              <PlaceForm
                key="edit-place"
                initial={manualPlace}
                onSubmit={(t) => {
                  setEditingPlace(false);
                  onSetPlace(t);
                }}
                onCancel={() => setEditingPlace(false)}
              />
            ) : (
              <Button variant="text" size="sm" className="-mt-4 self-start px-0" onClick={() => setEditingPlace(true)}>
                장소 바꾸기
              </Button>
            )}

            <section className="flex flex-col">
              <SectionHeader>챙길 것</SectionHeader>
              <CheckRows rows={itemRows} existing={existingTexts} isSelected={isSelected} onToggle={toggle} />
            </section>

            {placeRows.length > 0 && (
              <section className="flex flex-col">
                <SectionHeader>가볼 곳</SectionHeader>
                <CheckRows rows={placeRows} existing={existingTexts} isSelected={isSelected} onToggle={toggle} />
              </section>
            )}

            <div className="flex flex-col items-start gap-1">
              {ai ? (
                <Button
                  variant="text"
                  size="sm"
                  className="px-0"
                  disabled={aiLoading}
                  onClick={onAskAi}
                  leading={<IconSparkles size={16} stroke={1.9} />}
                >
                  {aiLoading ? "AI가 고르는 중…" : "AI 추천 다시 받기"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  block
                  disabled={aiLoading}
                  onClick={onAskAi}
                  leading={<IconSparkles size={18} stroke={1.9} />}
                >
                  {aiLoading ? "AI가 고르는 중…" : "AI로 자세히 추천받기"}
                </Button>
              )}
              <span className="text-micro text-faint">
                {ai ? "누를 때마다 AI 하루 사용 횟수를 1회 써요" : "준비물 5~10개와 가볼 곳을 날씨에 맞춰 골라 줘요 · 누를 때마다 AI 하루 사용 횟수를 1회 써요"}
              </span>
              {aiError && <span className="text-caption text-alert">{aiError}</span>}
            </div>
            <p className="m-0 text-caption text-faint">
              준비물은 &lsquo;날씨 추천&rsquo; 팩, 가볼 곳은 &lsquo;가볼 곳&rsquo; 팩에 담겨요. 두 팩은 이름을 바꿀 수 없어요.
            </p>
          </div>
        )
      )}
    </Sheet>
  );
}
