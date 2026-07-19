"use client";

import { IconCalendarEvent, IconMessages, IconNotes, IconPhoto } from "@tabler/icons-react";

// 파일/디데이/메모/댓글 중 아직 비어있는 것들의 "추가 +" 트리거를 한 줄에 모아서 보여준다.
// 우선순위(파일 > 디데이 > 메모 > 댓글)대로 왼쪽부터 나열되고, 이미 내용이 채워진 항목은
// (BagQuickAddRow가 아니라) 각자 원래 자리에서 평소 모습대로 보여지므로 여기 목록에서 빠진다.
// 넷 다 채워지면 이 줄 자체가 사라진다.
export default function BagQuickAddRow({
  showFile,
  showTravelDate,
  showNotice,
  showComment,
  onAddFile,
  onAddTravelDate,
  onAddNotice,
  onAddComment,
}: {
  showFile: boolean;
  showTravelDate: boolean;
  showNotice: boolean;
  showComment: boolean;
  onAddFile: () => void;
  onAddTravelDate: () => void;
  onAddNotice: () => void;
  onAddComment: () => void;
}) {
  const items = [
    showFile && { key: "file", label: "파일 추가", Icon: IconPhoto, onClick: onAddFile },
    showTravelDate && { key: "dday", label: "디데이 추가", Icon: IconCalendarEvent, onClick: onAddTravelDate },
    showNotice && { key: "notice", label: "메모 추가", Icon: IconNotes, onClick: onAddNotice },
    showComment && { key: "comment", label: "댓글 추가", Icon: IconMessages, onClick: onAddComment },
  ].filter(Boolean) as { key: string; label: string; Icon: typeof IconPhoto; onClick: () => void }[];

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap mb-3">
      {items.map(({ key, label, Icon, onClick }) => (
        <button
          key={key}
          onClick={onClick}
          className="flex items-center gap-1 text-[12px] shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          <Icon size={13} stroke={1.75} />
          {label} +
        </button>
      ))}
    </div>
  );
}
