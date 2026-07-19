"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { IconCalendarEvent, IconX } from "@tabler/icons-react";
import { ReminderOffset } from "@/lib/types";
import { formatDDayLabel } from "@/lib/dday";
import { useAuth } from "@/contexts/AuthProvider";
import ToggleSwitch from "@/components/ToggleSwitch";

export interface TravelDateFieldHandle {
  open: () => void;
}

const OFFSET_OPTIONS: { key: ReminderOffset; label: string }[] = [
  { key: 3, label: "3일 전" },
  { key: 1, label: "1일 전" },
  { key: 0, label: "당일 아침" },
];

// 가방 상단, 제목 아래에 붙는 여행일 설정. 비어있을 땐 "디데이 추가 +" 힌트만 보인다.
// hideEmptyPrompt가 true면 비어있을 때 이 힌트 자체를 숨긴다(BagQuickAddRow가 대신
// "디데이 추가 +" 트리거를 보여줄 때 씀) - 대신 ref.open()으로 외부에서 편집을 열 수 있다.
// 마진은 이 컴포넌트가 직접 갖지 않는다(BagEditorScreen에서 BagNotice와 함께 하나의
// 묶음으로 마진을 관리해서, 디데이만/메모만/둘다 있을 때 간격이 자연스럽게 붙는다).
// 알림(Push) 발송 로직은 아직 없고, 날짜/알림 시점 저장까지만 담당한다.
const TravelDateField = forwardRef<
  TravelDateFieldHandle,
  {
    travelDate?: string;
    reminderOffsets?: ReminderOffset[];
    onChange: (travelDate: string | undefined, reminderOffsets: ReminderOffset[] | undefined) => void;
    // true면 편집 진입을 막고 배지/날짜만 보여준다.
    readOnly?: boolean;
    hideEmptyPrompt?: boolean;
  }
>(function TravelDateField({ travelDate, reminderOffsets, onChange, readOnly, hideEmptyPrompt }, ref) {
  const { profile, updateDdayCountTodayAsDayOne } = useAuth();
  // 여행 당일도 "1일째"로 셀지 (D+ 표시 방식). 계정에 저장되어 기기 간 동일하게 적용된다.
  const countTodayAsDayOne = !!profile?.ddayCountTodayAsDayOne;
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(travelDate ?? "");
  const [draftOffsets, setDraftOffsets] = useState<ReminderOffset[]>(reminderOffsets ?? [1]);

  const openEditor = () => {
    if (readOnly) return;
    setDraftDate(travelDate ?? "");
    setDraftOffsets(reminderOffsets ?? [1]);
    setEditing(true);
  };

  useImperativeHandle(ref, () => ({ open: openEditor }));

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
      <div className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2.5">
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

        {/* 여행일이 지난 뒤 D+ 표시 방식 설정. 계정 단위로 저장되어 모든 가방에 동일하게
            적용된다(가방마다 따로 설정하는 값이 아님). */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium">여행 당일도 1일째로 계산</p>
            <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              끄면 여행 다음날부터 D+1, 켜면 여행 당일부터 D+1로 세요
            </p>
          </div>
          <ToggleSwitch
            checked={countTodayAsDayOne}
            onChange={(v) => updateDdayCountTodayAsDayOne(v)}
            ariaLabel="여행 당일도 1일째로 계산"
          />
        </div>

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
    if (readOnly || hideEmptyPrompt) return null;
    return (
      <button
        onClick={openEditor}
        className="flex items-center gap-1 text-[12px]"
        style={{ color: "var(--text-muted)" }}
      >
        <IconCalendarEvent size={13} stroke={1.75} />
        디데이 추가 +
      </button>
    );
  }

  const badge = formatDDayLabel(travelDate, countTodayAsDayOne);

  // 디데이답게 - 캘린더 아이콘 + D배지 + 날짜를 한 알약(버튼)으로 꾸며서 눈에 띄게 한다.
  return (
    <button
      onClick={openEditor}
      className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1"
      style={{
        background: "var(--accent-soft)",
        border: "1px solid var(--accent)",
        cursor: readOnly ? "default" : undefined,
        alignSelf: "flex-start",
      }}
    >
      <IconCalendarEvent size={13} stroke={2} color="var(--accent-strong)" />
      {badge && (
        <span className="text-[12px] font-bold" style={{ color: "var(--accent-strong)" }}>
          {badge}
        </span>
      )}
      <span className="text-[11px]" style={{ color: "var(--accent-strong)", opacity: 0.85 }}>
        {travelDate}
      </span>
    </button>
  );
});

export default TravelDateField;
