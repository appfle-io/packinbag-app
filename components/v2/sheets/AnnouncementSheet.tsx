"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { Announcement } from "@/lib/types";
import { Button, IconButton, Sheet } from "@/components/v2/ui";

export interface AnnouncementEntry {
  id: string;
  announcement: Announcement;
  // 다시 보지 않기(영구)
  onDismiss: () => void;
}

// 리디자인 v2 앱 시작 공지 시트. 구 InitialGuideCarouselModal(가이드·설치·공지 슬라이드)을 대체한다.
// v2에서는 가이드·설치 슬라이드를 띄우지 않으므로 공지만 받는다.
// - 한 번에 공지 하나. 여러 개면 위에 "1 / 3"과 이전·다음
// - "다시 보지 않기": 그 공지를 영구로 숨기고 다음 공지로. "확인/다음 공지": 이번에만 넘기고 다음으로(다음 실행 때 다시 보임)
// - 바깥을 누르거나 아래로 끌어 닫으면 남은 공지도 이번에는 모두 넘긴다
export function AnnouncementSheet({ open, entries, onClose }: { open: boolean; entries: AnnouncementEntry[]; onClose: () => void }) {
  // 열릴 때의 목록을 잡아 두고 그 안에서 넘긴다(닫히는 동안에도 내용 유지)
  const [list, setList] = useState(entries);
  const [index, setIndex] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setList(entries);
      setIndex(0);
    }
  }

  const safe = Math.min(index, Math.max(0, list.length - 1));
  const current = list[safe];

  const removeCurrent = () => {
    const next = list.filter((_, i) => i !== safe);
    if (next.length === 0) {
      onClose();
      return;
    }
    setList(next);
    setIndex(Math.min(safe, next.length - 1));
  };

  return (
    <Sheet
      open={open && list.length > 0}
      onClose={onClose}
      title="공지"
      showClose={false}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              current?.onDismiss();
              removeCurrent();
            }}
          >
            다시 보지 않기
          </Button>
          <Button className="flex-1" onClick={removeCurrent}>
            {list.length > 1 ? "다음 공지" : "확인"}
          </Button>
        </div>
      }
    >
      {current && (
        <article className="flex flex-col gap-3">
          {list.length > 1 && (
            <div className="flex items-center justify-end gap-1 text-caption text-sub">
              <IconButton label="이전 공지" disabled={safe === 0} onClick={() => setIndex(safe - 1)}>
                <IconChevronLeft size={20} stroke={1.9} />
              </IconButton>
              <span className="min-w-12 text-center tabular-nums">
                {safe + 1} / {list.length}
              </span>
              <IconButton label="다음 공지" disabled={safe === list.length - 1} onClick={() => setIndex(safe + 1)}>
                <IconChevronRight size={20} stroke={1.9} />
              </IconButton>
            </div>
          )}
          <h3 className="m-0 text-body-lg font-bold text-ink">{current.announcement.title}</h3>
          <p className="m-0 whitespace-pre-wrap text-body text-sub">{current.announcement.content}</p>
        </article>
      )}
    </Sheet>
  );
}
