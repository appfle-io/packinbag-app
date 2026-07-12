"use client";

import Portal from "@/components/Portal";
import { IconX, IconExternalLink } from "@tabler/icons-react";

// PDF 미리보기 - 프리미엄 전용 기능(storage.rules가 실제 파일 읽기 자체를 프리미엄
// 요청자에게만 허용하므로, 이 모달은 이미 프리미엄으로 확인된 경우에만 BagEditorScreen이
// 띄운다). 브라우저 내장 PDF 뷰어를 iframe으로 그대로 띄우는 방식이라 별도 PDF.js 등
// 라이브러리 없이도 동작한다(Mac/Windows 웹, iOS Safari 계열 WKWebView 모두 iframe PDF
// 렌더링을 지원). 새 탭에서 열기 버튼은 iframe이 어떤 이유로든 안 뜨는 환경(구형 WKWebView
// 등)에서의 대체 경로다.
export default function PdfPreviewModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
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
        <div className="flex-1 min-h-0">
          <iframe src={url} title="PDF 미리보기" className="w-full h-full border-0" />
        </div>
      </div>
    </Portal>
  );
}
