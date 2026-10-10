"use client";

import { useState } from "react";
import type { Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, SectionHeader, Sheet } from "@/components/v2/ui";
import {
  endLiveActivity,
  getLiveActivityState,
  startLiveActivity,
  type LiveActivityFont,
  type LiveActivitySize,
  type LiveActivityState,
  type LiveActivityTheme,
} from "@/lib/v2/nativeBridge";

// 가방 더보기 > 잠금화면에 띄우기(iOS 실시간 현황, 2026-10-10). 팩 하나를 잠금화면 · 다이내믹 아일랜드에 띄우고 거기서 바로 체크한다.
// 최대 8시간(iOS 규칙), 다 챙기면 자동으로 내려간다. 꾸미기(배경 · 글꼴 · 글자 크기)는 이 기기에 기억한다.
const STYLE_KEY = "pib_live_activity_style";
const THEMES: { id: LiveActivityTheme; label: string }[] = [
  { id: "system", label: "시스템" },
  { id: "light", label: "라이트" },
  { id: "dark", label: "다크" },
];
const FONTS: { id: LiveActivityFont; label: string }[] = [
  { id: "system", label: "기본" },
  { id: "pretendard", label: "프리텐다드" },
  { id: "gmarket", label: "지마켓 산스" },
  { id: "gaegu", label: "개구" },
  { id: "d2coding", label: "D2코딩" },
];
const SIZES: { id: LiveActivitySize; label: string }[] = [
  { id: "small", label: "작게" },
  { id: "medium", label: "보통" },
  { id: "large", label: "크게" },
];

type Style = { theme: LiveActivityTheme; font: LiveActivityFont; size: LiveActivitySize };

function loadStyle(): Style {
  try {
    const saved = JSON.parse(localStorage.getItem(STYLE_KEY) ?? "null");
    if (saved && typeof saved === "object") return { theme: "system", font: "system", size: "medium", ...saved };
  } catch {}
  return { theme: "system", font: "system", size: "medium" };
}

export function LiveActivitySheet({ open, onClose, bag }: { open: boolean; onClose: () => void; bag: Bag }) {
  const { user } = useAuth();
  const { show } = useToast();
  const packs = bag.packs.filter(
    (p) => p.kind !== "editor" && p.type !== "folder" && p.items.some((i) => i.type !== "text"),
  );
  const [packId, setPackId] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>(loadStyle);
  const [state, setState] = useState<LiveActivityState | null>(null);
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // 열릴 때마다 지금 떠 있는지 확인한다
  const key = open ? bag.id : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setPackId(null);
      getLiveActivityState().then(setState);
    }
  }

  const activeHere = !!state?.active && state.bagId === bag.id;
  const selected = packId ?? (activeHere ? state?.packId : undefined) ?? packs[0]?.id ?? null;

  const changeStyle = (next: Partial<Style>) => {
    const merged = { ...style, ...next };
    setStyle(merged);
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(merged));
    } catch {}
  };

  const start = async () => {
    if (!user || !selected) return;
    setBusy(true);
    try {
      await startLiveActivity(bag, user.uid, { packId: selected, ...style });
      show("잠금화면에 띄웠어요");
      onClose();
    } catch (err) {
      show(err instanceof Error && err.message ? err.message : "잠금화면에 띄우지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await endLiveActivity();
      show("잠금화면에서 내렸어요");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="잠금화면에 띄우기"
      footer={
        <div className="flex flex-col gap-2">
          <Button block disabled={busy || !selected || state?.enabled === false} onClick={start}>
            {activeHere ? "이 설정으로 다시 띄우기" : "잠금화면에 띄우기"}
          </Button>
          {state?.active && (
            <Button block variant="secondary" disabled={busy} onClick={stop}>
              잠금화면에서 내리기
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {state?.enabled === false && (
          <p className="m-0 rounded-card bg-fill px-4 py-3 text-caption text-sub">
            실시간 현황이 꺼져 있어요. 아이폰 설정 &gt; 팩인백 &gt; 실시간 현황을 켜 주세요.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader>팩</SectionHeader>
          {packs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {packs.map((p) => (
                <Chip key={p.id} label={p.name} selected={p.id === selected} onClick={() => setPackId(p.id)} />
              ))}
            </div>
          ) : (
            <p className="m-0 text-caption text-sub">체크 아이템이 있는 팩이 없어요.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>배경</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <Chip key={t.id} label={t.label} selected={style.theme === t.id} onClick={() => changeStyle({ theme: t.id })} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>글꼴</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <Chip key={f.id} label={f.label} selected={style.font === f.id} onClick={() => changeStyle({ font: f.id })} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader>글자 크기</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <Chip key={s.id} label={s.label} selected={style.size === s.id} onClick={() => changeStyle({ size: s.id })} />
            ))}
          </div>
        </section>

        <p className="m-0 text-micro text-faint">
          잠금화면에서 바로 체크할 수 있어요. 최대 8시간 동안 보이고, 다 챙기면 자동으로 내려가요.
        </p>
      </div>
    </Sheet>
  );
}
