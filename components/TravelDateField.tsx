"use client";

import { useState } from "react";
import { IconCalendarEvent, IconX } from "@tabler/icons-react";
import { ReminderOffset } from "@/lib/types";
import { formatDDayLabel } from "@/lib/dday";

const OFFSET_OPTIONS: { key: ReminderOffset; label: string }[] = [
  { key: 3, label: "3일 전" },
  { key: 1, label: "1일 전" },
  { key: 0, label: "당일 아침" },
];

// 가방 상단, BagNotice 아래에 붙는 여행일 설정. 비어있을 땐 "디데이 추가 +" 힌트만 보인다.
// 알림(Push) 발송 로직은 아직 없고, 날짜/알림 시점 저장까지만 담당한다.
export default function TravelDateField({
  travelDate,
  reminderOffsets,
  onChange,
}: {
  travelDate?: string;
  reminderOffsets?: ReminderOffset[];
  onChange: (travelDate: string | undefined, reminderOffsets: ReminderOffset[] | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(travelDate ?? "");
  const [draftOffsets, setDraftOffsets] = useState<ReminderOffset[]>(reminderOffsets ?? [1]);

  const openEditor = () => {
    setDraftDate(travelDate ?? "");
    setDraftOffsets(reminderOffsets ?? [1]);
    setEditing(true);
  };

  const toggleOffset = (key: ReminderOffset) => {
    setDraftOffsets((prev) =>
      prev.includes(key) ? prev.filter((o) => o !== key) : [...prev, key].sort((a, b) => b - a)
    );
  };

  const commit = () => {
    if (!draftDate) {
      onChange(undefined, undefined);
    } else {
      onChange(draftDate, draftOffsets);
    }
    setEditing(false);
  };

  const clear = () => {
    onChange(undefined, undefined);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mb-3 rounded-lg border border-border bg-surface p-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <IconCalendarEvent size={15} stroke={1.75} color="var(--text-secondary)" />
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] outline-none"
          />
          {travelDate && (
            <button onClick={clear} aria-label="여행 날짜 삭제" className="p-1">
              <IconX size={15} stroke={1.75} color="var(--text-muted)" />
            </button>
          )}
        </div>

        {draftDate && (
          <div className="flex flex-wrap gap-1.5">
            {OFFSET_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleOffset(key)}
                className="rounded-full px-2.5 py-1 text-[11px] border"
                style={{
                  borderColor: draftOffsets.includes(key) ? "var(--accent)" : "var(--border)",
                  background: draftOffsets.includes(key) ? "var(--accent-soft)" : "transparent",
                  color: draftOffsets.includes(key) ? "var(--accent-strong)" : "var(--text-secondary)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1.5 text-[12px] border border-border"
          >
            취소
          </button>
          <button
            onClick={commit}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  if (!travelDate) {
    return (
      <button
        onClick={openEditor}
        className="flex items-center gap-1 text-[12px] mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        <IconCalendarEvent size={13} stroke={1.75} />
        디데이 추가 +
      </button>
    );
  }

  const badge = formatDDayLabel(travelDate);

  return (
    <button onClick={openEditor} className="flex items-center gap-1.5 mb-3">
      {badge && (
        <span
          className="text-[11px] font-medium rounded-full px-2 py-0.5"
          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          {badge}
        </span>
      )}
      <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
        {travelDate}
      </span>
    </button>
  );
}
