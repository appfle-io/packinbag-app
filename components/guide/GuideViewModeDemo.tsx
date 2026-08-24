"use client";

import { useState } from "react";
import { IconLayoutGrid, IconLayoutList, IconUsers } from "@tabler/icons-react";
import ProgressRing from "@/components/ProgressRing";

export default function GuideViewModeDemo() {
  const [mode, setMode] = useState<"large" | "medium" | "small">("medium");

  const sampleBags = [
    {
      id: "b1",
      name: "2026.08 도쿄 여행",
      dday: "D-7",
      packs: [
        { name: "전자기기 & 충전", count: "12/12", color: "#3b82f6" },
        { name: "세면 & 위생용품", count: "4/4", color: "#10b981" },
        { name: "비상약 & 영양제", count: "3/5", color: "#f59e0b" },
      ],
      total: "19/21",
      ratio: 0.9,
      members: 3,
    },
    {
      id: "b2",
      name: "제주 주말 힐링",
      dday: "D-21",
      packs: [
        { name: "의류 & 패션", count: "6/8", color: "#ec4899" },
        { name: "렌터카 & 숙소 메모", count: "메모", color: "#8b5cf6" },
      ],
      total: "6/8",
      ratio: 0.75,
      members: 2,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 상단 뷰 모드 조작 바 */}
      <div className="flex items-center justify-between p-2 rounded-xl bg-surface/40 border border-border/60">
        <span className="text-[11.5px] text-text-muted">
          상단 버튼을 눌러보세요:
        </span>

        <button
          type="button"
          onClick={() => {
            setMode((prev) =>
              prev === "large" ? "medium" : prev === "medium" ? "small" : "large"
            );
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-foreground hover:border-accent text-[12px] font-semibold transition-all cursor-pointer shadow-2xs"
        >
          {mode === "large" ? (
            <IconLayoutList size={15} className="text-accent" />
          ) : mode === "small" ? (
            <IconLayoutGrid size={15} stroke={2.4} className="text-accent" />
          ) : (
            <IconLayoutGrid size={15} className="text-accent" />
          )}
          <span>
            {mode === "large" ? "1열 (크게)" : mode === "small" ? "3열 (작게)" : "2열 (보통)"}
          </span>
        </button>
      </div>

      {/* 가방 카드 그리드 데모 */}
      <div
        className={`grid gap-2 transition-all duration-200 ${
          mode === "large"
            ? "grid-cols-1"
            : mode === "small"
            ? "grid-cols-3"
            : "grid-cols-2"
        }`}
      >
        {sampleBags.map((bag) => (
          <div
            key={bag.id}
            className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1.5 shadow-2xs relative overflow-hidden"
          >
            {/* 상단: 제목 & D-Day */}
            <div className="flex items-start justify-between gap-1">
              <span className="text-[12.5px] font-semibold text-foreground truncate">
                {bag.name}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-accent-soft text-accent shrink-0">
                {bag.dday}
              </span>
            </div>

            {/* 내부 팩 목록 (가변 1열/2열) */}
            <div className="flex flex-col gap-1 py-1">
              {bag.packs.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1 text-[11px] text-text-secondary min-w-0">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="truncate flex-1">{p.name}</span>
                  <span className="text-[9.5px] text-text-muted shrink-0">{p.count}</span>
                </div>
              ))}
            </div>

            {/* 하단 정보 */}
            <div className="flex items-center justify-between text-[10.5px] text-text-muted mt-auto pt-1 border-t border-border/40">
              <span className="flex items-center gap-0.5">
                <IconUsers size={12} /> {bag.members}
              </span>
              <div className="flex items-center gap-1.5">
                <ProgressRing ratio={bag.ratio} size={15} />
                <span className="font-medium text-foreground">{bag.total}</span>
              </div>
            </div>

            {/* 하단 2px 진행률 바 */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border/40">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${Math.round(bag.ratio * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
