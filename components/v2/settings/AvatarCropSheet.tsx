"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button, Sheet } from "@/components/v2/ui";
import { AVATAR_ZOOM_MAX, AVATAR_ZOOM_MIN, cropImageStyle, initialCrop, panCrop, zoomCrop, type AvatarCrop } from "@/lib/v2/avatarCrop";
import { renderAvatarJpeg } from "@/lib/v2/avatarPhoto";

type Point = { x: number; y: number };
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// 프로필 사진 자르기(SET-PROF-12): 동그란 틀에서 끌기 · 두 손가락 · 휠 · 슬라이더로 확대. 파일은 부모의 "저장" 때 올린다
export function AvatarCropSheet({ file, onClose, onDone }: { file: Blob | null; onClose: () => void; onDone: (blob: Blob) => void }) {
  const { show } = useToast();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<AvatarCrop | null>(null);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, Point>());

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setCrop(initialCrop({ w: img.naturalWidth, h: img.naturalHeight }));
    };
    img.onerror = () => {
      show("사진을 읽지 못했어요");
      onClose();
    };
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
      setImage(null);
      setCrop(null);
      URL.revokeObjectURL(url);
    };
    // onClose · show는 열릴 때의 것이면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const size = image ? { w: image.naturalWidth, h: image.naturalHeight } : null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !size || !crop) return;
    const next = { x: e.clientX, y: e.clientY };
    const other = Array.from(pointers.current.entries()).find(([id]) => id !== e.pointerId)?.[1];
    pointers.current.set(e.pointerId, next);
    if (other) {
      const before = gap(prev, other);
      if (before > 0) setCrop(zoomCrop(size, crop, crop.zoom * (gap(next, other) / before)));
    } else {
      const width = e.currentTarget.getBoundingClientRect().width;
      setCrop(panCrop(size, crop, (next.x - prev.x) / width, (next.y - prev.y) / width));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const done = async () => {
    if (!image || !crop || busy) return;
    setBusy(true);
    try {
      onDone(await renderAvatarJpeg(image, crop));
    } catch {
      show("사진을 읽지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!file}
      onClose={onClose}
      title="사진 맞추기"
      footer={
        <Button block disabled={!crop || busy} onClick={done}>
          이 사진 쓰기
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => size && crop && setCrop(zoomCrop(size, crop, crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)))}
          className="relative aspect-square w-3/4 max-w-xs cursor-grab touch-none select-none overflow-hidden rounded-full bg-fill active:cursor-grabbing"
        >
          {image && size && crop && (
            // eslint-disable-next-line @next/next/no-img-element -- 고른 사진(blob) 미리 보기
            <img src={image.src} alt="" draggable={false} className="pointer-events-none absolute h-auto max-w-none" style={cropImageStyle(size, crop)} />
          )}
        </div>
        <label className="flex w-full flex-col gap-2">
          <span className="text-caption text-sub">크기</span>
          <input
            type="range"
            min={AVATAR_ZOOM_MIN * 100}
            max={AVATAR_ZOOM_MAX * 100}
            step={5}
            value={Math.round((crop?.zoom ?? 1) * 100)}
            disabled={!crop}
            onChange={(e) => size && crop && setCrop(zoomCrop(size, crop, Number(e.target.value) / 100))}
            className="w-full accent-brand"
          />
        </label>
      </div>
    </Sheet>
  );
}
