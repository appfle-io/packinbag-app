"use client";

import { useState } from "react";
import Portal from "@/components/Portal";
import { downloadFileFromUrl } from "@/lib/downloadFile";
import {
  IconX,
  IconExternalLink,
  IconDownload,
  IconLoader2,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@tabler/icons-react";

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SCALE_STEP = 0.5;

// PDF 미리보기 - 프리미엄 전용 기능(storage.rules가 실제 파일 읽기 자체를 프리미엄
// 요청자에게만 허용하므로, 이 모달은 이미 프리미엄으로 확인된 경우에만 BagEditorScreen이
// 띄운다). 브라우저 내장 PDF 뷰어를 iframe으로 그대로 띄우는 방식이라 별도 PDF.js 등
// 라이브러리 없이도 동작한다(Mac/Windows 웹, iOS Safari 계열 WKWebView 모두 iframe PDF
// 렌더링을 지원). 새 탭에서 열기 버튼은 iframe이 어떤 이유로든 안 뜨는 환경(구형 WKWebView
// 등)에서의 대체 경로다.
//
// 확대/축소: iframe은 별도 브라우징 컨텍스트라 그 위에서 일어나는 핀치/휠 이벤트가 부모
// 문서로 전달되지 않는다(크로스 도큐먼트라 버블링이 안 됨) - 그래서 핀치 제스처를 직접
// 잡는 대신, +/-/리셋 버튼으로 iframe 감싸는 wrapper에 CSS transform: scale을 적용하고,
// 바깥 컨테이너를 overflow: auto로 둬서 확대된 만큼은 스크롤(터치 드래그)로 이동하게 했다.
// 이 방식은 크로스 도큐먼트 이벤트 문제 없이 모든 환경에서 안정적으로 동작한다.
export default function PdfPreviewModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
  const zoomReset = () => setScale(1);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    await downloadFileFromUrl(url, "문서.pdf");
    setDownloading(false);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[85] flex flex-col"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <div
          className="flex items-center justify-between shrink-0 px-4 py-3"
          style={{ paddingTop: "max(12px, calc(env(safe-area-inset-top) + 8px))" }}
        >
          <span className="text-[13px] font-medium" style={{ color: "#fff" }}>
            PDF 미리보기
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={zoomOut}
                disabled={scale <= MIN_SCALE}
                aria-label="축소"
                className="h-8 w-8 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <IconZoomOut size={16} stroke={1.75} color="#fff" />
              </button>
              <button
                onClick={zoomReset}
                disabled={scale === 1}
                aria-label="확대/축소 초기화"
                className="h-8 w-8 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <IconZoomReset size={16} stroke={1.75} color="#fff" />
              </button>
              <button
                onClick={zoomIn}
                disabled={scale >= MAX_SCALE}
                aria-label="확대"
                className="h-8 w-8 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <IconZoomIn size={16} stroke={1.75} color="#fff" />
              </button>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              aria-label="다운로드"
              className="flex items-center gap-1 text-[12px]"
              style={{ color: "#fff" }}
            >
              {downloading ? (
                <IconLoader2 size={16} stroke={1.75} className="animate-spin" />
              ) : (
                <IconDownload size={16} stroke={1.75} />
              )}
              다운로드
            </button>
            <button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              aria-label="새 탭에서 열기"
              className="flex items-center gap-1 text-[12px]"
              style={{ color: "#fff" }}
            >
              <IconExternalLink size={16} stroke={1.75} />
              새 탭에서 열기
            </button>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={20} stroke={1.75} color="#fff" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              transition: "transform 150ms ease",
              width: "100%",
              height: "100%",
            }}
          >
            <iframe src={url} title="PDF 미리보기" className="w-full h-full border-0" />
          </div>
        </div>
      </div>
    </Portal>
  );
}
