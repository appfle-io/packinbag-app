"use client";

// 이벤트 화면(2026-10-19). 설정 > 이벤트 목록 · 이벤트 보기 · 홈 캐러셀 카드. 명세 docs/spec/events.md(EVT-)
// 본문 HTML은 스크립트를 막은 iframe(sandbox="")에 내려받기 주소로 띄운다 — 링크 · 스크립트 · 폼은 동작하지 않는다.
// 앱 화면 모드(라이트 · 다크)는 iframe의 color-scheme으로 넘긴다(본문은 prefers-color-scheme으로 색을 바꿈, 이벤트 가이드 2절)
import { useEffect, useState } from "react";
import { IconChevronLeft, IconGift } from "@tabler/icons-react";
import { useTheme } from "@/components/ThemeProvider";
import SlideScreen from "@/components/SlideScreen";
import { Badge, Button, IconButton, ScreenHeader, SectionHeader, cx } from "@/components/v2/ui";
import { SubScreen } from "@/components/v2/settings/SubScreen";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { openExternalLink } from "@/lib/openExternalLink";
import { loadEvents } from "@/lib/eventsService";
import { eventEyebrow, eventPeriodLabel, eventStatus, isSafeEventLink, markEventSeen, splitEvents, type AppEvent } from "@/lib/events";

function Cover({ event, className }: { event: AppEvent; className: string }) {
  if (!event.coverUrl) {
    return (
      <span className={cx("flex shrink-0 items-center justify-center bg-fill text-faint", className)} aria-hidden="true">
        <IconGift size={22} stroke={1.75} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- Storage 내려받기 주소(바깥 이미지)라 next/image를 쓰지 않는다
  return <img src={event.coverUrl} alt="" loading="lazy" className={cx("shrink-0 bg-fill object-cover", className)} />;
}

// 홈 캐러셀 한 장(EVT-HOME). 가방 카드와 같은 틀 · 높이, 오른쪽에 정사각 커버
export function EventSlideCard({ event, onOpen }: { event: AppEvent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full select-none items-stretch gap-4 rounded-card border border-line bg-card p-5 text-left transition-colors duration-160 ease-snappy active:bg-fill"
    >
      <span className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-micro font-semibold text-brand">{eventEyebrow(event)}</span>
          <span className="line-clamp-2 text-heading font-bold text-ink">{event.title}</span>
        </span>
        {event.summary && <span className="line-clamp-2 text-caption text-sub">{event.summary}</span>}
      </span>
      <Cover event={event} className="size-24 self-center rounded-field" />
    </button>
  );
}

// 버튼 열기: 앱 경로는 그 주소로 이동, https는 바깥(iOS 앱은 사파리)
function openEventLink(url: string) {
  if (!isSafeEventLink(url)) return;
  if (url.startsWith("/")) window.location.assign(url);
  else openExternalLink(url);
}

// 이벤트 보기(EVT-VIEW). 머리 + 본문(칸 안에서 세로 스크롤) + 아래 버튼
export function EventDetailScreen({ event, onBack }: { event: AppEvent; onBack: () => void }) {
  const swipeRef = useSwipeBack<HTMLDivElement>(onBack);
  const { mode } = useTheme();
  const ended = eventStatus(event) === "ended";
  const showButton = !ended && !!event.buttonLabel && isSafeEventLink(event.buttonUrl);
  // 시스템 모드면 iframe이 기기 설정을 그대로 따른다(지정하지 않음)
  const scheme = mode === "dark" ? "dark" : mode === "light" ? "light" : undefined;

  useEffect(() => {
    markEventSeen(event.id);
  }, [event.id]);

  return (
    <div ref={swipeRef} className="pib-v2 relative flex h-full min-h-0 w-full flex-1 flex-col bg-canvas">
      <ScreenHeader
        title="이벤트"
        leading={
          <IconButton label="뒤로" onClick={onBack}>
            <IconChevronLeft size={22} stroke={1.9} />
          </IconButton>
        }
      />
      <div className="relative min-h-0 flex-1">
        {event.bodyType === "html" && event.bodyUrl ? (
          <iframe
            src={event.bodyUrl}
            title={event.title}
            sandbox=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full border-0 bg-canvas"
            // 앱 화면 모드(런타임)
            style={scheme ? { colorScheme: scheme } : undefined}
          />
        ) : event.bodyType === "image" && event.bodyUrl ? (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- Storage 내려받기 주소라 next/image를 쓰지 않는다 */}
              <img src={event.bodyUrl} alt={event.title} className="block h-auto w-full rounded-card" />
            </div>
          </div>
        ) : (
          <p className="m-0 py-16 text-center text-body text-sub">내용을 불러오지 못했어요</p>
        )}
      </div>
      {(showButton || ended) && (
        <div className="shrink-0 border-t border-line bg-canvas">
          <div className="pb-safe-8 mx-auto w-full max-w-2xl px-5 pt-3">
            {ended ? (
              <p className="m-0 text-center text-caption text-sub">끝난 이벤트예요 · {eventPeriodLabel(event)}</p>
            ) : (
              <Button block onClick={() => event.buttonUrl && openEventLink(event.buttonUrl)}>
                {event.buttonLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event, ended, last, onOpen }: { event: AppEvent; ended?: boolean; last: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "flex min-h-16 w-full items-center gap-3 bg-transparent py-2 text-left transition-colors duration-160 ease-snappy active:bg-fill",
        !last && "border-b border-line",
      )}
    >
      <Cover event={event} className={cx("size-14 rounded-field", ended && "opacity-50")} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx("truncate text-body font-semibold", ended ? "text-sub" : "text-ink")}>{event.title}</span>
          {ended && <Badge className="shrink-0">끝남</Badge>}
        </span>
        <span className="truncate text-caption text-sub">{eventPeriodLabel(event)}</span>
      </span>
    </button>
  );
}

// 설정 > 이벤트(EVT-LIST). 열 때마다(active가 켜질 때) 서버에서 다시 받는다
export function EventsScreen({ active: screenActive, onBack }: { active: boolean; onBack: () => void }) {
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [opened, setOpened] = useState<AppEvent | null>(null);
  // 닫히는 동안 내용이 비지 않게 마지막 이벤트를 붙잡아 둔다
  const [shown, setShown] = useState<AppEvent | null>(null);
  if (opened && opened !== shown) setShown(opened);

  useEffect(() => {
    if (!screenActive) return;
    let alive = true;
    void loadEvents(true).then((list) => alive && setEvents(list));
    return () => {
      alive = false;
    };
  }, [screenActive]);

  const { active, ended } = splitEvents(events ?? []);

  return (
    <SubScreen title="이벤트" onBack={onBack} bodyClassName="gap-8">
      {events === null ? (
        <p className="m-0 py-16 text-center text-body text-sub">불러오고 있어요</p>
      ) : (
        <>
          <section className="flex flex-col">
            <SectionHeader>진행 중 {active.length > 0 ? active.length : ""}</SectionHeader>
            {active.length === 0 ? (
              <p className="m-0 py-8 text-center text-body text-sub">지금은 진행 중인 이벤트가 없어요</p>
            ) : (
              active.map((e, i) => <EventRow key={e.id} event={e} last={i === active.length - 1} onOpen={() => setOpened(e)} />)
            )}
          </section>
          {ended.length > 0 && (
            <section className="flex flex-col">
              <SectionHeader>지난 이벤트 {ended.length}</SectionHeader>
              {ended.map((e, i) => (
                <EventRow key={e.id} event={e} ended last={i === ended.length - 1} onOpen={() => setOpened(e)} />
              ))}
            </section>
          )}
        </>
      )}
      <SlideScreen active={!!opened} onBackdropClick={() => setOpened(null)} swipeBack>
        {shown && <EventDetailScreen event={shown} onBack={() => setOpened(null)} />}
      </SlideScreen>
    </SubScreen>
  );
}
