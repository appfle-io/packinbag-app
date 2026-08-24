"use client";

import { useState, useEffect } from "react";
import { IconCheck } from "@tabler/icons-react";

export default function GuideCheckDemo() {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({
    0: true,
    1: false,
    2: false,
  });

  const sampleItems = [
    { id: 0, text: "110V 돼지코 어댑터 (2개)" },
    { id: 1, text: "스마트폰 고속 충전기 & 케이블" },
    { id: 2, text: "보조배터리 20000mAh" },
  ];

  // 주기적으로 1번 항목 자동 토글 데모
  useEffect(() => {
    const timer = setInterval(() => {
      setCheckedItems((prev) => ({
        ...prev,
        1: !prev[1],
      }));
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const toggle = (id: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="w-full flex flex-col gap-1.5 select-none">
      {sampleItems.map((item) => {
        const isChecked = !!checkedItems[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 text-left ${
              isChecked
                ? "bg-surface-2/20 border-border/40 text-text-muted opacity-75"
                : "bg-surface/30 border-border/50 hover:border-border text-foreground"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`h-4.5 w-4.5 rounded flex items-center justify-center shrink-0 transition-colors duration-200 ${
                  isChecked
                    ? "bg-accent text-white"
                    : "border border-border-strong bg-surface/50"
                }`}
              >
                {isChecked && <IconCheck size={13} stroke={3} />}
              </div>
              <span
                className={`text-[13px] font-medium transition-all duration-200 truncate ${
                  isChecked ? "line-through text-text-muted" : "text-foreground"
                }`}
              >
                {item.text}
              </span>
            </div>

            <span className="text-[11px] text-text-muted shrink-0">
              {isChecked ? "완료" : "탭하여 체크"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
