"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconExternalLink, IconLoader2, IconX, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { dataUrlToBlob, downloadFileFromUrl, fileNameFor, isDataUrl, openFileUrl } from "@/lib/downloadFile";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// PDF 크게 보기(가방 첨부 · 메모 첨부). 구 PdfPreviewModal 대체(같은 props).
// - 사진 크게 보기(PhotoViewer)와 같은 틀: 화면 모드와 상관없이 어두운 바탕, 위 줄 44px 동그란 버튼
// - 위: 닫기 · 파일 이름 · 축소 · 확대 · 저장 · 다른 앱으로 열기
// - iframe은 별도 문서라 핀치가 바깥으로 안 온다 → 버튼으로 확대하고, 확대된 만큼은 스크롤로 이동
// - 오프라인 첨부(data URL)는 iframe에 바로 못 띄우는 브라우저가 있어 blob 주소로 바꿔 보여 준다
const GLASS = "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25 disabled:opacity-40";
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const STEP = 0.5;

export function PdfViewer({ url, fileName, onClose }: { url: string; fileName?: string | null; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const layer = useOverlayLayer();
  useEscapeToClose(onClose);

  const [frameSrc, setFrameSrc] = useState(() => (isDataUrl(url) ? "" : url));
  useEffect(() => {
    if (!isDataUrl(url)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소가 바뀌면 그대로 따라간다
      setFrameSrc(url);
      return;
    }
    const blobUrl = URL.createObjectURL(dataUrlToBlob(url));
    setFrameSrc(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [url]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await downloadFileFromUrl(url, fileName);
    setSaving(false);
  };

  const title = fileNameFor(url, fileName, "PDF");

  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-label="PDF 보기" className="pib-v2 pib-v2-overlay fixed inset-0 flex flex-col" style={{ zIndex: layer + POPOVER_OFFSET }}>
        {/* .pib-v2가 루트 바탕을 덮어서(층 밖 CSS) 어두운 바탕은 따로 깐다 */}
        <div aria-hidden="true" className="absolute inset-0 bg-black/90" />

        {/* 위 줄 */}
        <div className="pt-safe relative z-10 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2">
            <button type="button" onClick={onClose} aria-label="닫기" className={GLASS}>
              <IconX size={22} stroke={1.9} />
            </button>
            <span className="min-w-0 flex-1 truncate text-caption font-semibold text-white">{title}</span>
            <button type="button" onClick={() => setScale((s) => Math.max(MIN_SCALE, s - STEP))} disabled={scale <= MIN_SCALE} aria-label="축소" className={GLASS}>
              <IconZoomOut size={20} stroke={1.9} />
            </button>
            <button type="button" onClick={() => setScale((s) => Math.min(MAX_SCALE, s + STEP))} disabled={scale >= MAX_SCALE} aria-label="확대" className={GLASS}>
              <IconZoomIn size={20} stroke={1.9} />
            </button>
            <button type="button" onClick={save} disabled={saving} aria-label="저장" className={GLASS}>
              {saving ? <IconLoader2 size={20} stroke={1.9} className="animate-spin" /> : <IconDownload size={20} stroke={1.9} />}
            </button>
            <button type="button" onClick={() => openFileUrl(url, fileName)} aria-label="다른 앱으로 열기" className={GLASS}>
              <IconExternalLink size={20} stroke={1.9} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="pb-safe-2 relative z-10 min-h-0 flex-1 overflow-auto px-2">
          <div
            className="h-full w-full origin-top overflow-hidden rounded-field bg-card transition-transform duration-160 ease-snappy"
            style={{ transform: `scale(${scale})` }}
          >
            {frameSrc && <iframe src={frameSrc} title={title} className="h-full w-full border-0" />}
          </div>
        </div>
      </div>
    </Portal>
  );
}
