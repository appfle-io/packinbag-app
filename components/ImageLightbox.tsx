"use client";

import { useEffect, useState } from "react";
import Portal from "@/components/Portal";
import { downloadFileFromUrl } from "@/lib/downloadFile";
import { useZoomPan } from "@/lib/useZoomPan";

import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconLoader2,
} from "@tabler/icons-react";

export default function ImageLightbox({
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
  const hasMultiple = images.length > 1;
  const { scale, tx, ty, interacting, reset, bind } = useZoomPan();
  const [downloading, setDownloading] = useState(false);

  // 사진을 넘길 때마다(또는 열릴 때) 확대 상태를 초기화한다 - 이전 사진에서 확대해둔 채로
  // 넘기면 다음 사진도 확대된 채로 보여서 어색하다.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    await downloadFileFromUrl(images[index], `이미지_${index + 1}.jpg`);
    setDownloading(false);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={onClose}
      >
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            aria-label="다운로드"
            disabled={downloading}
            className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            {downloading ? (
              <IconLoader2 size={18} stroke={1.75} color="#fff" className="animate-spin" />
            ) : (
              <IconDownload size={18} stroke={1.75} color="#fff" />
            )}
          </button>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <IconX size={20} stroke={1.75} color="#fff" />
          </button>
        </div>

        {hasMultiple && scale <= 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((index - 1 + images.length) % images.length);
              }}
              aria-label="이전 사진"
              className="absolute left-2 sm:left-4 z-10 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <IconChevronLeft size={20} stroke={1.75} color="#fff" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((index + 1) % images.length);
              }}
              aria-label="다음 사진"
              className="absolute right-2 sm:right-4 z-10 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <IconChevronRight size={20} stroke={1.75} color="#fff" />
            </button>
          </>
        )}

        {/* 확대/축소 + 드래그(팬) 영역. 핀치, 더블탭, 마우스휠 모두 여기서 처리한다.
            부모(고정 전체화면 딤 배경)를 기준으로 absolute + inset-0을 써서 확실하게
            뷰포트 크기의 박스를 만든다 - flex 자식의 퍼센트 높이에 기대면 이미지가
            원본 크기 그대로 넘쳐서 상단 버튼을 가리는 문제가 있었다. */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden p-4"
          style={{ touchAction: "none" }}
          onClick={(e) => e.stopPropagation()}
          {...bind}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]}
            alt=""
            draggable={false}
            className="rounded-lg select-none"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transition: interacting ? "none" : "transform 150ms ease",
              cursor: scale > 1 ? "grab" : "zoom-in",
            }}
          />
        </div>

        {hasMultiple && scale <= 1 && (
          <div className="absolute bottom-4 z-10 flex gap-1.5">
            {images.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: i === index ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Portal>
  );
}
