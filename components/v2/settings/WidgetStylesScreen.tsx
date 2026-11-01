"use client";

// 설정 > 위젯 > 가방 바로가기(2026-10-18, 1.7 "위젯 꾸미기" → 1.12에 위젯 허브 아래로). 저장한 꾸미기를 위젯 모양 그대로 칸으로 보여 주고, 눌러서 고친다.
// iOS 홈 화면에서 "가방 바로가기" 위젯을 길게 눌러 위젯 편집 → 가방 · 꾸미기를 고른다(꾸미기를 고치면 그걸 쓰는 위젯이 모두 바뀜).
// 무료: 1개 · 기본 바탕만(2번째부터 잠김, 지우지는 않음). 지금은 FREE_LAUNCH라 모두 프리미엄
import { useMemo, useState } from "react";
import { IconChevronRight, IconLock, IconPlus } from "@tabler/icons-react";
import type { Bag, WidgetStyle } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";
import SlideScreen from "@/components/SlideScreen";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import {
  SAMPLE_WIDGET_BAG,
  deleteWidgetPhoto,
  newWidgetStyle,
  wallpaperState,
  widgetBagStats,
  widgetStyleLocked,
} from "@/lib/v2/widgetStyles";
import { SubScreen } from "./SubScreen";
import { WidgetPreview } from "./WidgetPreview";
import { WidgetStyleEditor } from "./WidgetStyleEditor";
import { useWidgetStyleSave } from "./useWidgetStyleSave";

const BG_LABEL: Record<string, string> = { plain: "기본 바탕", photo: "사진", solid: "단색" };

export function WidgetStylesScreen({ onBack, bags }: { onBack: () => void; bags: Bag[] }) {
  const { updateWidgetStyles } = useAuth();
  const { show } = useToast();
  const { guard } = useOnlineGuard();
  const { premium, styles, saving, setSaving, canAdd, limitMessage, save } = useWidgetStyleSave();
  const [editing, setEditing] = useState<{ style: WidgetStyle; isNew: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sampleBag = useMemo(() => {
    const b = bags.find((x) => !x.trashedByOwnerAt);
    return b ? widgetBagStats(b) : SAMPLE_WIDGET_BAG;
  }, [bags]);

  const openNew = () => {
    if (!canAdd) {
      show(limitMessage);
      return;
    }
    setEditing({ style: newWidgetStyle(), isNew: true });
  };

  const doSave = async (draft: WidgetStyle, photo: Blob | null) => {
    if (await save(draft, photo)) setEditing(null);
  };

  const doDelete = async () => {
    if (!editing || saving) return;
    const target = styles.find((s) => s.id === editing.style.id);
    setSaving(true);
    try {
      await updateWidgetStyles(styles.filter((s) => s.id !== editing.style.id));
      if (target?.photoPath) void deleteWidgetPhoto(target.photoPath);
      setEditing(null);
      show("꾸미기를 지웠어요. 이걸 쓰던 위젯은 기본 모양이 돼요");
    } catch (err) {
      console.error("[팩인백] 위젯 꾸미기 지우기 실패:", err);
      show("지우지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubScreen title="가방 바로가기" onBack={onBack} bodyClassName="gap-6">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-sub">누르면 그 가방이 바로 열리는 작은 위젯</p>
        {/* 꾸미는 법: 두 단계만 위에 */}
        <div className="flex items-center gap-2 rounded-card bg-brand-soft px-4 py-3 text-caption font-semibold text-brand">
          <span className="flex flex-1 items-center gap-2">
            <StepDot n={1} />
            여기서 꾸미기 만들기
          </span>
          <IconChevronRight size={16} stroke={2} aria-hidden="true" />
          <span className="flex flex-1 items-center gap-2">
            <StepDot n={2} />
            위젯 길게 눌러 고르기
          </span>
        </div>
      </div>

      {!premium && (
        <p className="m-0 rounded-card bg-brand-soft px-4 py-3 text-caption text-ink">
          무료는 꾸미기 1개 · 기본 바탕만 쓸 수 있어요. 사진 · 단색 배경과 여러 개 저장은 프리미엄이에요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
        {/* 기본(지울 수 없음): 꾸미기를 안 고른 위젯 모양 */}
        <div className="flex flex-col gap-2">
          <WidgetPreview style={null} stats={sampleBag} className="w-full" />
          <span className="flex flex-col px-1">
            <span className="text-body font-semibold">기본</span>
            <span className="text-micro text-faint">꾸미기를 안 고른 위젯</span>
          </span>
        </div>

        {styles.map((s, i) => {
          const locked = widgetStyleLocked(i, premium);
          const shown = premium ? s : { ...s, bg: "plain" as const };
          return (
            <button
              key={s.id}
              type="button"
              disabled={locked}
              onClick={() => setEditing({ style: s, isNew: false })}
              className="flex flex-col gap-2 text-left disabled:cursor-default"
            >
              <span className={locked ? "relative w-full opacity-50" : "relative w-full"}>
                <WidgetPreview style={shown} stats={sampleBag} className="w-full" />
                {locked && (
                  <span className="absolute inset-0 flex items-center justify-center text-ink">
                    <IconLock size={22} stroke={1.75} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="flex flex-col px-1">
                <span className="truncate text-body font-semibold">{s.name}</span>
                <span className="text-micro text-faint">
                  {locked ? "프리미엄 · 잠김" : !premium ? "기본 바탕(무료)" : wallpaperState(s) === "marking" ? "투명 · 자리 재는 중" : wallpaperState(s) ? "투명" : BG_LABEL[s.bg]}
                </span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={openNew}
          className={
            canAdd
              ? "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-widget border-2 border-dashed border-line-strong text-sub active:bg-fill"
              : "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-widget border-2 border-dashed border-line text-faint"
          }
        >
          <IconPlus size={24} stroke={1.75} aria-hidden="true" />
          <span className="text-caption font-semibold">새로 만들기</span>
          <span className="text-micro text-faint">기본 · 사진 · 단색 · 투명</span>
        </button>
      </div>

      <p className="m-0 text-micro text-faint">꾸미기를 고치면 그걸 쓰는 위젯이 모두 바뀌어요. 개인 잠금한 가방은 위젯에서 고를 수 없어요.</p>

      <SlideScreen active={!!editing} onBackdropClick={() => !saving && setEditing(null)} swipeBack>
        {editing && (
          <WidgetStyleEditor
            key={editing.style.id}
            initial={editing.style}
            isNew={editing.isNew}
            premium={premium}
            bags={bags}
            saving={saving}
            onBack={() => !saving && setEditing(null)}
            onSave={(style, photo) => guard(() => void doSave(style, photo))}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
        {/* 지우기 확인은 편집 화면(SlideScreen) 안에 둔다. 밖에 두면 이 화면 층 + SHEET_OFFSET(10)이라
            편집 화면 층(+20)보다 낮아 뒤에 숨었다(사용자 제보 2026-10-18, lib/overlayLayer) */}
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="이 꾸미기를 지울까요?"
          message="이걸 쓰던 위젯은 기본 모양으로 바뀌어요."
          confirmLabel="지우기"
          danger
          onConfirm={() => void doDelete()}
        />
      </SlideScreen>
    </SubScreen>
  );
}

function StepDot({ n }: { n: number }) {
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-micro font-bold text-on-brand">{n}</span>;
}
