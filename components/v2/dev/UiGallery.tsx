"use client";

import { useState } from "react";
import { IconPlus, IconSearch, IconUsers, IconDots, IconRotateClockwise, IconPackage } from "@tabler/icons-react";
import {
  Avatar,
  Badge,
  Button,
  CheckMark,
  Chip,
  IconButton,
  ListRow,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  Sheet,
  Toggle,
} from "@/components/v2/ui";

const COLORS = [
  { name: "canvas", cls: "bg-canvas" },
  { name: "card", cls: "bg-card" },
  { name: "fill", cls: "bg-fill" },
  { name: "line", cls: "bg-line" },
  { name: "line-strong", cls: "bg-line-strong" },
  { name: "ink", cls: "bg-ink" },
  { name: "sub", cls: "bg-sub" },
  { name: "faint", cls: "bg-faint" },
  { name: "brand", cls: "bg-brand" },
  { name: "brand-soft", cls: "bg-brand-soft" },
  { name: "alert", cls: "bg-alert" },
];

const TYPE = [
  { name: "title 28/36", cls: "text-title font-bold", sample: "아기 외출가방" },
  { name: "heading 22/30", cls: "text-heading font-bold", sample: "팩 불러오기" },
  { name: "body-lg 17/24", cls: "text-body-lg font-semibold", sample: "강조 본문" },
  { name: "body 15/22", cls: "text-body", sample: "기저귀 5개" },
  { name: "caption 13/18", cls: "text-caption text-sub", sample: "마지막으로 다 싼 날 · 어제" },
  { name: "micro 12/16", cls: "text-micro text-sub", sample: "탭 라벨 · 배지" },
];

type Theme = "light" | "dark";

export default function UiGallery() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
  );
  const [chip, setChip] = useState("전체");
  const [items, setItems] = useState([
    { t: "기저귀 5개", done: true },
    { t: "물티슈", done: true },
    { t: "보온병 (뜨거운 물)", done: false },
    { t: "여벌 옷 1벌", done: false },
  ]);
  const [owner, setOwner] = useState("J");
  const [noti, setNoti] = useState(true);
  const [sheet, setSheet] = useState(false);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const done = items.filter((i) => i.done).length;

  return (
    <div className="pib-v2 h-dvh overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 pt-safe pb-16">
        <header className="flex items-end justify-between pt-8">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-caption text-sub">redesign/minimal · 개발용</p>
            <h1 className="m-0 text-title font-bold">v2 컴포넌트</h1>
          </div>
          <SegmentedControl
            label="테마"
            value={theme}
            onChange={applyTheme}
            options={[
              { value: "light", label: "라이트" },
              { value: "dark", label: "다크" },
            ]}
            className="w-40"
          />
        </header>

        <section className="flex flex-col gap-3">
          <SectionHeader>색</SectionHeader>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {COLORS.map((c) => (
              <div key={c.name} className="flex flex-col gap-1">
                <div className={`h-12 rounded-field ring-1 ring-line ${c.cls}`} />
                <span className="text-micro text-sub">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>글자</SectionHeader>
          {TYPE.map((t) => (
            <div key={t.name} className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
              <span className={t.cls}>{t.sample}</span>
              <span className="shrink-0 text-micro text-faint">{t.name}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>버튼</SectionHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button leading={<IconPackage size={18} stroke={1.9} />}>팩 불러오기</Button>
            <Button variant="secondary" leading={<IconRotateClockwise size={18} stroke={1.9} />}>
              다시 싸기
            </Button>
            <Button variant="text">팩으로 나눠 담기</Button>
            <Button variant="danger">삭제</Button>
            <Button disabled>추가할 팩을 고르세요</Button>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="검색">
              <IconSearch size={22} stroke={1.75} />
            </IconButton>
            <IconButton label="함께 챙기는 사람">
              <IconUsers size={22} stroke={1.75} />
            </IconButton>
            <IconButton label="더보기">
              <IconDots size={22} stroke={1.75} />
            </IconButton>
            <IconButton label="팩 불러오기" variant="soft">
              <IconPackage size={20} stroke={1.75} />
            </IconButton>
            <IconButton label="새 가방" variant="solid">
              <IconPlus size={20} stroke={2} />
            </IconButton>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>칩 · 배지 · 아바타</SectionHeader>
          <div className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {[
              ["전체", 11],
              ["남은 것", 6],
              ["미분류", 2],
              ["기저귀 · 위생", 1],
              ["먹거리", 1],
            ].map(([l, n]) => (
              <Chip key={l} label={String(l)} count={Number(n)} selected={chip === l} onClick={() => setChip(String(l))} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Badge>반복</Badge>
            <Badge tone="brand">D-3</Badge>
            <Badge tone="solid">다 쌌어요</Badge>
            <Avatar name="Appflo" tone="brand" size="sm" />
            <Avatar name="J" size="sm" online />
            <Avatar name="Appflo" tone="brand" online />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader action={<span className="text-caption text-sub">{done} / {items.length}</span>}>체크 목록</SectionHeader>
          <ProgressBar value={done / items.length} label="챙긴 비율" />
          <div className="flex flex-col">
            {items.map((it, i) => (
              <ListRow
                key={it.t}
                title={it.t}
                muted={it.done}
                divider={i < items.length - 1}
                aria-pressed={it.done}
                leading={<CheckMark checked={it.done} />}
                trailing={i === 2 ? <Badge>J</Badge> : undefined}
                onClick={() => setItems((prev) => prev.map((p, j) => (j === i ? { ...p, done: !p.done } : p)))}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>목록 줄</SectionHeader>
          <div className="flex flex-col">
            <ListRow
              title="주말 캠핑"
              subtitle="싸는 중 · 어제 체크"
              leading={<ProgressRing value={31 / 40} label="주말 캠핑" />}
              trailing="31/40"
            />
            <ListRow title="아기 외출 기본" subtitle="아이템 14개 · 기저귀, 물티슈, 분유" leading={<CheckMark checked shape="square" />} />
            <ListRow title="보관함" trailing="2" chevron divider={false} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>선택 · 스위치</SectionHeader>
          <SegmentedControl
            label="담당자"
            value={owner}
            onChange={setOwner}
            options={[
              { value: "없음", label: "없음" },
              { value: "나", label: "나" },
              { value: "J", label: "J" },
            ]}
          />
          <div className="rounded-card border border-line bg-card px-4">
            <Toggle checked={noti} onChange={setNoti} label="디데이 알림" description="날짜가 있는 가방만 · 3일 전, 전날" />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>바텀시트</SectionHeader>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            시트 열기
          </Button>
        </section>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="팩 불러오기"
        footer={
          <Button block onClick={() => setSheet(false)}>
            팩 2개 추가 · 아이템 20개
          </Button>
        }
      >
        <div className="flex flex-col">
          <ListRow title="아기 외출 기본" subtitle="기저귀, 물티슈, 분유, 젖병 외 10개" leading={<CheckMark checked shape="square" />} trailing="14개" />
          <ListRow title="해외여행 서류" subtitle="여권, 항공권, 환전, 여행자보험 외 2개" leading={<CheckMark checked shape="square" />} trailing="6개" />
          <ListRow title="세면도구" subtitle="칫솔, 치약, 샴푸, 폼클렌징 외 5개" leading={<CheckMark checked={false} shape="square" />} trailing="9개" disabled />
          <ListRow title="상비약" subtitle="해열제, 밴드, 소독약 외 5개" leading={<CheckMark checked={false} shape="square" />} trailing="8개" divider={false} />
        </div>
      </Sheet>
    </div>
  );
}
