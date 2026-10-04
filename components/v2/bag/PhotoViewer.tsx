"use client";

import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconDownload, IconLoader2, IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { downloadFileFromUrl } from "@/lib/downloadFile";
import { useZoomPan } from "@/lib/useZoomPan";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { cx } from "@/components/v2/ui";

// 사진 크게 보기(가방 사진). 구 ImageLightbox 대체(같은 props).
// - 위: 닫기 · "2 / 5" · 저장, 아래 여백은 안전영역까지. 버튼은 모두 44px
// - 핀치·더블탭·휠로 확대(useZoomPan), 확대 중에는 이전·다음 버튼을 숨긴다
// - 화면 모드와 상관없이 늘 어두운 바탕(사진 보기 관례)
const GLASS = "inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25 disabled:opacity-40";

export function PhotoViewer({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const many = images.length > 1;
  const { scale, tx, ty, interacting, reset, bind } = useZoomPan();
  const [saving, setSaving] = useState(false);
  const layer = useOverlayLayer();
  useEscapeToClose(onClose);

  // 넘길 때마다 확대를 푼다
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // 키보드 좌우(PC)
  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onNavigate((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") onNavigate((index + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, index, images.length, onNavigate]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await downloadFileFromUrl(images[index]);
    setSaving(false);
  };

  const zoomed = scale > 1;

  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-label="사진 크게 보기" className="pib-v2 pib-v2-overlay fixed inset-0" style={{ zIndex: layer + POPOVER_OFFSET }}>
        {/* .pib-v2가 루트 바탕을 덮어서(층 밖 CSS) 어두운 바탕은 따로 깐다 */}
        <div aria-hidden="true" className="absolute inset-0 bg-black/90" />
        {/* 확대·이동 영역 */}
        <div className="absolute inset-0 flex touch-none items-center justify-center overflow-hidden px-4 py-16" {...bind}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]}
            alt={`사진 ${index + 1}`}
            draggable={false}
            className={cx("max-h-full max-w-full select-none rounded-field object-contain", zoomed ? "cursor-grab" : "cursor-zoom-in")}
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transition: interacting ? "none" : "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          />
        </div>

        {/* 위 줄 */}
        <div className="pt-safe absolute inset-x-0 top-0 z-10">
          <div className="flex items-center justify-between px-3 pt-2">
            <button type="button" onClick={onClose} aria-label="닫기" className={GLASS}>
              <IconX size={22} stroke={1.9} />
            </button>
            {many && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-caption font-semibold text-white tabular-nums">
                {index + 1} / {images.length}
              </span>
            )}
            <button type="button" onClick={save} disabled={saving} aria-label="사진 저장" className={GLASS}>
              {saving ? <IconLoader2 size={20} stroke={1.9} className="animate-spin" /> : <IconDownload size={20} stroke={1.9} />}
            </button>
          </div>
        </div>

        {/* 이전 · 다음 */}
        {many && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => onNavigate((index - 1 + images.length) % images.length)}
              aria-label="이전 사진"
              className={cx(GLASS, "absolute top-1/2 left-3 z-10 -translate-y-1/2")}
            >
              <IconChevronLeft size={22} stroke={1.9} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate((index + 1) % images.length)}
              aria-label="다음 사진"
              className={cx(GLASS, "absolute top-1/2 right-3 z-10 -translate-y-1/2")}
            >
              <IconChevronRight size={22} stroke={1.9} />
            </button>
          </>
        )}
      </div>
    </Portal>
  );
}
