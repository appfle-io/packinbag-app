"use client";

import { IconSearch, IconX } from "@tabler/icons-react";
import { cx } from "./cx";

export interface HeaderSearch {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  placeholder: string;
}

// 탭·목록 화면 공통 헤더. 기준은 가방 탭: 제목과 버튼이 한 줄, 그 아래 칩.
// 화면마다 여백을 따로 정하지 않도록 헤더 간격은 여기서만 정한다.
//
//  ┌ px-5 pt-2 pb-3 ─────────────────────────────────────────┐
//  │ [leading] above(경로, 있을 때만)              [actions]  │
//  │           제목(text-title)                              │
//  ├ px-5 pb-4 (children 있을 때만) ─────────────────────────┤
//  │ 칩 등                                                    │
//  └──────────────────────────────────────────────────────────┘
//  검색을 열면 제목 줄 전체가 [검색창][취소]로 바뀐다(높이 동일).
export function ScreenHeader({
  leading,
  actions,
  above,
  title,
  children,
  search,
}: {
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  above?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  search?: HeaderSearch;
}) {
  const searching = !!search?.open;
  return (
    <header className="flex shrink-0 flex-col">
      {searching && search ? (
        <div className="flex min-h-14 items-end gap-2 px-5 pt-2 pb-3">
          <div className="min-w-0 flex-1">
            <SearchField value={search.value} onChange={search.onChange} placeholder={search.placeholder} autoFocus />
          </div>
          <button
            type="button"
            onClick={search.onClose}
            className="h-11 shrink-0 bg-transparent px-2 text-body font-semibold text-ink active:opacity-60"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="flex min-h-14 items-end justify-between gap-2 px-5 pt-2 pb-3">
          <div className="flex min-w-0 items-end gap-1">
            {/* 뒤로 버튼은 아이콘이 제목 왼쪽 끝과 맞도록 여백을 당긴다 */}
            {leading && <div className="-ml-3 shrink-0">{leading}</div>}
            <div className="flex min-w-0 flex-col">
              {above}
              {typeof title === "string" ? <h1 className="m-0 truncate text-title font-bold">{title}</h1> : title}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      {children && !searching && <div className="flex flex-col gap-3 px-5 pb-4">{children}</div>}
    </header>
  );
}

// 헤더 아래 스크롤 본문. 폭 제한과 시작 여백을 모든 목록 화면이 똑같이 쓴다.
// 아래 여백 = 기본 8칸 + 떠 있는 탭바 높이(--pib-dock, 탭바가 없는 곳은 0). scroll-padding도 같이 더해
// 포커스·검색 이동(scrollIntoView)으로 옮겨 간 줄이 탭바 뒤에 멈추지 않는다.
// dockless: 탭바 바로 위에 따로 붙는 줄(팩 탭 빠른팩)이 탭바 자리를 맡을 때
export function ScreenBody({ children, className, dockless }: { children: React.ReactNode; className?: string; dockless?: boolean }) {
  return (
    <main className={cx("pib-v2-no-scrollbar dock-scroll-pad min-h-0 flex-1 overflow-y-auto overscroll-contain", dockless && "dock-none")}>
      <div className={cx("dock-pad-body mx-auto flex w-full max-w-2xl flex-col px-5 pt-2", className)}>{children}</div>
    </main>
  );
}

// 헤더 안 가로 스크롤 줄(칩 등). 화면 끝까지 스크롤되도록 좌우 여백을 상쇄한다.
// data-own-swipe-back: 가로 스크롤이 탭 전환 스와이프로 오인되지 않게 막는다(AppShell).
export function HeaderScroller({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div data-own-swipe-back role="group" aria-label={label} className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      {children}
    </div>
  );
}

// 검색창. 헤더 검색 모드와 시트 안 검색이 같은 모양을 쓴다.
function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-field bg-fill px-3">
      <IconSearch size={18} stroke={1.9} className="shrink-0 text-sub" aria-hidden="true" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        placeholder={placeholder}
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
      />
      {value && (
        <button type="button" aria-label="검색어 지우기" onClick={() => onChange("")} className="flex size-8 shrink-0 items-center justify-center text-faint">
          <IconX size={16} stroke={1.9} />
        </button>
      )}
    </label>
  );
}
