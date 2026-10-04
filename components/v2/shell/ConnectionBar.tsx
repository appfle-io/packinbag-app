"use client";

import { useEffect, useState } from "react";
import { IconChevronDown, IconCloudOff, IconWifi, IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { RECONNECTED_EVENT, useConnectivity } from "@/lib/v2/connectivity";
import { cx } from "@/components/v2/ui";

const BAR = "flex w-full shrink-0 select-none items-start gap-2 border-b border-line pl-4 font-ui text-caption text-ink";
const CLOSE = "inline-flex size-11 shrink-0 items-center justify-center bg-transparent text-sub active:opacity-60";

// 한 줄 제목 + 누르면 펼쳐지는 설명. 좁은 화면에서 긴 문장이 "…"로 잘려 뒤를 못 읽던 문제(10/4)
function Summary({ title, detail, open, onToggle }: { title: string; detail: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center bg-transparent py-3 text-left">
      <span className="flex min-w-0 items-center gap-1">
        <span className={cx("min-w-0", !open && "truncate")}>{title}</span>
        <IconChevronDown size={14} stroke={2} aria-hidden="true" className={cx("shrink-0 text-faint transition-transform duration-200", open && "rotate-180")} />
      </span>
      {open && <span className="pt-1 text-sub">{detail}</span>}
    </button>
  );
}

// 지금 연결 상태를 알려 주는 한 줄(리디자인 v2 · 연결 흐름 F). 구 OfflineStatusBar 대체.
// - 계정 모드 + 끊김: "연결이 끊겼어요". 누르면 설명. 다시 연결되면 줄이 사라지고 토스트
// - 오프라인 모드 + 연결됨: "인터넷에 연결됐어요" + 로그인(로그인하면 이 기기 데이터를 계정에 합친다)
// - 오프라인 모드 + 끊김(폐쇄망에서 쓰는 중): 아무것도 띄우지 않는다
export function ConnectionBar() {
  const { user, isOfflineMode, switchToOnlineMode } = useAuth();
  const { show } = useToast();
  const connectivity = useConnectivity();
  const [dismissedLogin, setDismissedLogin] = useState(false);
  const [open, setOpen] = useState(false);

  // 계정 모드에서 끊겼다가 다시 연결되면 한 번 알려 준다(바뀐 내용은 Firestore가 알아서 올린다)
  useEffect(() => {
    if (isOfflineMode || !user) return;
    const onBack = () => show("다시 연결됐어요. 바뀐 내용을 맞추고 있어요");
    window.addEventListener(RECONNECTED_EVENT, onBack);
    return () => window.removeEventListener(RECONNECTED_EVENT, onBack);
  }, [isOfflineMode, user, show]);

  if (!user) return null;

  if (!isOfflineMode && connectivity === "offline") {
    return (
      <div role="status" aria-live="polite" className={cx(BAR, "bg-fill pr-4")}>
        <span className="flex h-11 shrink-0 items-center" aria-hidden="true">
          <IconCloudOff size={16} stroke={1.9} className="text-sub" />
        </span>
        <Summary
          title="연결이 끊겨 저장된 내용을 보고 있어요"
          detail="체크·수정·새 가방은 이 기기에 저장해 두었다가 다시 연결되면 자동으로 올라가요. AI·사진 올리기·공유·초대는 연결된 뒤에 쓸 수 있어요."
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
      </div>
    );
  }

  if (isOfflineMode && connectivity === "online" && !dismissedLogin) {
    return (
      <aside role="status" aria-live="polite" className={cx(BAR, "bg-brand-soft")}>
        <span className="flex h-11 shrink-0 items-center" aria-hidden="true">
          <IconWifi size={16} stroke={1.9} className="text-brand" />
        </span>
        <Summary
          title="인터넷에 연결됐어요"
          detail="로그인하면 이 기기에서 만든 가방과 팩을 계정으로 옮길 수 있어요. 다른 기기에서도 이어서 쓸 수 있어요."
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
        <button type="button" onClick={switchToOnlineMode} className="h-11 shrink-0 bg-transparent px-2 font-semibold text-brand active:opacity-60">
          로그인
        </button>
        <button type="button" onClick={() => setDismissedLogin(true)} aria-label="닫기" className={CLOSE}>
          <IconX size={18} stroke={1.9} />
        </button>
      </aside>
    );
  }

  return null;
}
