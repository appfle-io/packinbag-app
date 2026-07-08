"use client";

import Portal from "@/components/Portal";

import { IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

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

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={onClose}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <IconX size={20} stroke={1.75} color="#fff" />
        </button>

        {hasMultiple && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((index - 1 + images.length) % images.length);
              }}
              aria-label="이전 사진"
              className="absolute left-2 sm:left-4 h-9 w-9 rounded-full flex items-center justify-center"
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
              className="absolute right-2 sm:right-4 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <IconChevronRight size={20} stroke={1.75} color="#fff" />
            </button>
          </>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain rounded-lg"
        />

        {hasMultiple && (
          <div className="absolute bottom-4 flex gap-1.5">
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
