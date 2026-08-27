"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pack } from "@/lib/types";
import {
  IconDownload,
  IconShare,
  IconX,
  IconCheck,
  IconLink,
  IconCopy,
  IconZoomIn,
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  collectEditorDocPreviewLines,
  collectEditorDocRichBlocks,
  renderRichMemoBlocksOnCanvas,
  RichBlock,
} from "@/lib/editorDocPreview";
import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

interface PackShareModalProps {
  pack?: Pack;
  folder?: Pack;
  folderPacks?: Pack[];
  bagId?: string;
  onTokenGenerated?: (token: string) => void;
  onClose: () => void;
}

type CardTheme = "boarding" | "receipt" | "polaroid";

function getMemoPreviewLines(pack: Pack, maxLines = 30): string[] {
  if (pack.editorDoc) {
    const lines = collectEditorDocPreviewLines(pack.editorDoc);
    if (lines.length > 0) {
      return lines
        .map((l) => l.map((s) => s.text).join("").trim())
        .filter((t) => t.length > 0)
        .slice(0, maxLines);
    }
  }
  if (pack.editorPreviewText) {
    return pack.editorPreviewText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, maxLines);
  }
  return [];
}

function getMemoRichBlocks(pack: Pack): RichBlock[] {
  if (pack.editorDoc) {
    const blocks = collectEditorDocRichBlocks(pack.editorDoc);
    if (blocks.length > 0) return blocks;
  }
  if (pack.editorPreviewText) {
    return pack.editorPreviewText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((line) => ({
        type: "paragraph" as const,
        spans: [{ text: line }],
      }));
  }
  return [];
}

function computeEstimatedListHeight(
  packs: Pack[],
  theme: "boarding" | "receipt" | "polaroid"
): number {
  if (theme === "receipt") {
    if (packs.length === 1 && packs[0].kind === "editor") {
      const blocks = getMemoRichBlocks(packs[0]);
      let h = 26;
      for (const b of blocks.slice(0, 25)) {
        const charLen = b.spans.reduce((acc, s) => acc + s.text.length, 0);
        const lines = charLen > 30 ? 2 : 1;
        h += b.type === "heading" ? 30 : lines * 22;
      }
      return h + 10;
    }

    let h = 0;
    for (const p of packs) {
      h += 26;
      if (p.kind === "editor") {
        const maxL = 5;
        const lines = getMemoPreviewLines(p, maxL);
        h += lines.length * 20 + 5;
      } else {
        h += (p.items?.length ?? 0) * 20 + 5;
      }
    }
    return h;
  }

  const lineH = theme === "boarding" ? 19 : 18;
  const titleH = theme === "boarding" ? 21 : 20;

  if (packs.length === 1) {
    const p = packs[0];
    if (p.kind === "editor") {
      const blocks = getMemoRichBlocks(p);
      let h = titleH + 15;
      for (const b of blocks.slice(0, 25)) {
        const charLen = b.spans.reduce((acc, s) => acc + s.text.length, 0);
        const lines = charLen > 38 ? 2 : 1;
        h += b.type === "heading" ? 30 : lines * (lineH + 3);
      }
      return h;
    } else {
      const items = p.items || [];
      const rows = Math.ceil(items.length / 2);
      return titleH + rows * lineH + 10;
    }
  }

  let col1H = 0;
  let col2H = 0;
  for (const p of packs) {
    let packH = titleH;
    if (p.kind === "editor") {
      const lines = getMemoPreviewLines(p, 5);
      packH += lines.length * lineH + 6;
    } else {
      packH += (p.items?.length ?? 0) * lineH + 6;
    }

    if (col1H <= col2H) {
      col1H += packH;
    } else {
      col2H += packH;
    }
  }
  return Math.max(col1H, col2H);
}

export default function PackShareModal({
  pack,
  folder,
  folderPacks = [],
  bagId,
  onTokenGenerated,
  onClose,
}: PackShareModalProps) {
  const { user } = useAuth();
  const { show } = useToast();
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const isFolder = !!folder;
  const targetTitle = isFolder ? folder.name : pack?.name ?? "팩";

  const displayPacks: Pack[] = useMemo(() => {
    if (isFolder) {
      return folderPacks.filter((p) => p.type !== "folder");
    }
    return pack ? [pack] : [];
  }, [isFolder, folderPacks, pack]);

  const [theme, setTheme] = useState<CardTheme>("boarding");
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvasRef = (el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el !== canvasElement) {
      setCanvasElement(el);
    }
  };

  const [shareToken, setShareToken] = useState<string | null>(
    (isFolder ? folder?.publicShareToken : pack?.publicShareToken) ?? null
  );
  const [loadingToken, setLoadingToken] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showEnlargedPreview, setShowEnlargedPreview] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");

  const THEMES: CardTheme[] = ["boarding", "receipt", "polaroid"];
  const THEME_LABELS: Record<CardTheme, string> = {
    boarding: "보딩패스",
    receipt: "영수증",
    polaroid: "폴라로이드",
  };

  const handlePrevTheme = () => {
    setTheme((prev) => {
      const idx = THEMES.indexOf(prev);
      return THEMES[(idx - 1 + THEMES.length) % THEMES.length];
    });
  };

  const handleNextTheme = () => {
    setTheme((prev) => {
      const idx = THEMES.indexOf(prev);
      return THEMES[(idx + 1) % THEMES.length];
    });
  };

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleSwipeStart = (clientX: number, clientY: number) => {
    setTouchStartX(clientX);
    setTouchStartY(clientY);
  };

  const handleSwipeEnd = (clientX: number, clientY: number) => {
    if (touchStartX === null || touchStartY === null) return;
    const deltaX = clientX - touchStartX;
    const deltaY = clientY - touchStartY;
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX < 0) {
        handleNextTheme();
      } else {
        handlePrevTheme();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // 확대 미리보기 중 좌우 방향키로 카드 전환
  useEffect(() => {
    if (!showEnlargedPreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevTheme();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextTheme();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEnlargedPreview]);

  const totalItems = useMemo(() => {
    return displayPacks.reduce((acc, p) => acc + (p.items?.length ?? 0), 0);
  }, [displayPacks]);

  // 공유 토큰 생성/조회 API 호출
  useEffect(() => {
    let active = true;
    async function fetchShareToken() {
      if (!user) return;
      setLoadingToken(true);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/share-pack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            packId: pack?.id,
            pack: pack ?? undefined,
            folderId: folder?.id,
            folder: folder ?? undefined,
            packs: isFolder ? displayPacks : undefined,
            bagId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data.token) {
            setShareToken(data.token);
            onTokenGenerated?.(data.token);
          }
        }
      } catch (err) {
        console.error("공유 링크 발급 실패:", err);
      } finally {
        if (active) setLoadingToken(false);
      }
    }

    fetchShareToken();
    return () => {
      active = false;
    };
  }, [user, pack, folder, isFolder, displayPacks, bagId, onTokenGenerated]);

  const shareUrl = shareToken
    ? typeof window !== "undefined"
      ? `${window.location.origin}/p/${shareToken}`
      : `https://packinbag.app/p/${shareToken}`
    : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      show("공유 링크를 복사했어요");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      show("링크 복사에 실패했어요");
    }
  };

  const handleOpenEnlargedPreview = () => {
    const canvas = canvasRef.current || canvasElement;
    if (!canvas) return;
    try {
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch {
      // ignore
    }
    setShowEnlargedPreview(true);
  };

  // Canvas 렌더링 (내용량에 따른 동적 높이 계산 & 하단 여백 최소화)
  useEffect(() => {
    const canvas = canvasRef.current || canvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 800;
    const listH = computeEstimatedListHeight(displayPacks, theme);
    let h = 1200;

    if (theme === "boarding") {
      const cardH = Math.min(1120, Math.max(500, 313 + listH + 150));
      h = cardH + 80;
    } else if (theme === "receipt") {
      const cardH = Math.min(1120, Math.max(480, 176 + listH + 170));
      h = cardH + 80;
    } else {
      const photoH = Math.min(780, Math.max(220, 84 + listH + 25));
      const cardH = Math.min(1120, Math.max(500, 36 + photoH + 140));
      h = cardH + 90;
    }

    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    if (theme === "boarding") {
      drawBoardingPass(ctx, w, h);
    } else if (theme === "receipt") {
      drawReceipt(ctx, w, h);
    } else {
      drawPolaroid(ctx, w, h);
    }

    try {
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch {
      // ignore
    }
  }, [canvasElement, theme, targetTitle, displayPacks, totalItems, isFolder]);

  // 비행기 실루엣
  function drawAirplane(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, angle = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.1, size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.15, 0);
    ctx.lineTo(-size * 0.45, -size * 1.05);
    ctx.lineTo(-size * 0.05, -size * 1.05);
    ctx.lineTo(size * 0.35, 0);
    ctx.lineTo(-size * 0.05, size * 1.05);
    ctx.lineTo(-size * 0.45, size * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.85, 0);
    ctx.lineTo(-size * 1.1, -size * 0.5);
    ctx.lineTo(-size * 0.8, -size * 0.5);
    ctx.lineTo(-size * 0.55, 0);
    ctx.lineTo(-size * 0.8, size * 0.5);
    ctx.lineTo(-size * 1.1, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 1. 보딩패스 테마
  function drawBoardingPass(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#090D16");
    grad.addColorStop(1, "#1E293B");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const cardX = 45;
    const cardY = 40;
    const cardW = w - 90;
    const cardH = h - 80;

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();

    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 120);
    headerGrad.addColorStop(0, "#1D4ED8");
    headerGrad.addColorStop(1, "#2563EB");
    ctx.fillStyle = headerGrad;
    roundRectTop(ctx, cardX, cardY, cardW, 120, 24);
    ctx.fill();

    drawAirplane(ctx, cardX + 48, cardY + 60, 18, "#FFFFFF", -Math.PI / 12);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("PACK IN BAG AIRLINES", cardX + 80, cardY + 54);

    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(isFolder ? "FOLDER PACKING COLLECTION" : "PACKING LIST · FIRST CLASS", cardX + 80, cardY + 76);

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX + cardW - 120, cardY + 36, 88, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#1D4ED8";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isFolder ? "FOLDER" : "PACK", cardX + cardW - 76, cardY + 67);
    ctx.textAlign = "left";

    // 노선 (Route) 섹션
    const routeY = cardY + 155;
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
    const title = targetTitle.length > 15 ? targetTitle.slice(0, 15) + "..." : targetTitle;
    ctx.fillText("ICN", cardX + 36, routeY + 24);
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("SEOUL / INCHEON", cardX + 36, routeY + 44);

    ctx.strokeStyle = "#94A3B8";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 160, routeY + 16);
    ctx.quadraticCurveTo(cardX + cardW / 2, routeY - 14, cardX + cardW - 200, routeY + 16);
    ctx.stroke();
    ctx.setLineDash([]);

    drawAirplane(ctx, cardX + cardW / 2 - 20, routeY - 2, 14, "#2563EB", 0.05);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(title, cardX + cardW - 36, routeY + 24);
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(isFolder ? `${displayPacks.length}개 팩 구성` : "스마트 패킹 리스트", cardX + cardW - 36, routeY + 44);
    ctx.textAlign = "left";

    // 비행 상세 칩 그리드
    const chipY = routeY + 62;
    const chips = [
      { label: "CLASS", val: "FIRST" },
      { label: "GATE", val: "07A" },
      { label: "SEAT", val: "01A" },
      { label: "TOTAL", val: `${totalItems}개 짐` },
    ];
    const chipW = (cardW - 72 - 30) / 4;
    chips.forEach((c, idx) => {
      const cx = cardX + 36 + idx * (chipW + 10);
      ctx.fillStyle = "#F1F5F9";
      roundRect(ctx, cx, chipY, chipW, 40, 8);
      ctx.fill();

      ctx.fillStyle = "#64748B";
      ctx.font = "bold 10.5px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(c.label, cx + 10, chipY + 16);

      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(c.val, cx + 10, chipY + 32);
    });

    // 티켓 좌우 반원 펀칭 홈 & 절취선
    const notchY = chipY + 60;
    ctx.fillStyle = "#090D16";
    ctx.beginPath();
    ctx.arc(cardX, notchY, 14, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cardX + cardW, notchY, 14, Math.PI / 2, -Math.PI / 2);
    ctx.fill();

    ctx.strokeStyle = "#CBD5E1";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 22, notchY);
    ctx.lineTo(cardX + cardW - 22, notchY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2-Column 짐 목록 섹션 (위에서 아래로 균등하게 채우는 레이아웃)
    const colStartY = notchY + 36;
    const botLimitY = cardY + cardH - 120;
    const col1X = cardX + 36;
    const col2X = cardX + 365;

    let curY1 = colStartY;
    let curY2 = colStartY;

    if (displayPacks.length === 1) {
      const p = displayPacks[0];
      const packTitle = p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name;

      if (p.kind === "editor") {
        // 단일 메모팩: 서식(헤딩, 볼드, 체크박스, 인용구, 형광펜 등)을 완벽히 적용하여 전폭 1단 렌더링
        ctx.fillStyle = "#D97706";
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`[MEMO: ${packTitle}]`, col1X, curY1);
        curY1 += 26;

        const blocks = getMemoRichBlocks(p);
        curY1 = renderRichMemoBlocksOnCanvas({
          ctx,
          blocks,
          startX: col1X,
          startY: curY1,
          maxWidth: cardW - 72,
          botLimitY,
          theme: "boarding",
        });
      } else {
        const items = p.items || [];
        const mid = Math.ceil(items.length / 2);
        const col1Items = items.slice(0, mid);
        const col2Items = items.slice(mid);

        ctx.fillStyle = "#1E40AF";
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`[${packTitle}]`, col1X, curY1);
        curY1 += 21;
        for (const item of col1Items) {
          if (curY1 + 19 > botLimitY) break;
          ctx.fillStyle = item.checked ? "#94A3B8" : "#1E293B";
          ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
          const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
          ctx.fillText("[ ] " + itemText, col1X + 8, curY1);
          curY1 += 19;
        }

        if (col2Items.length > 0) {
          ctx.fillStyle = "#1E40AF";
          ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`[${packTitle} (이어서)]`, col2X, curY2);
          curY2 += 21;
          for (const item of col2Items) {
            if (curY2 + 19 > botLimitY) break;
            ctx.fillStyle = item.checked ? "#94A3B8" : "#1E293B";
            ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
            const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
            ctx.fillText("[ ] " + itemText, col2X + 8, curY2);
            curY2 += 19;
          }
        }
      }
    } else {
      for (const p of displayPacks) {
        const isCol1 = curY1 <= curY2;
        let curX = isCol1 ? col1X : col2X;
        let curY = isCol1 ? curY1 : curY2;

        if (curY + 45 > botLimitY) {
          if (isCol1 && curY2 + 45 <= botLimitY) {
            curX = col2X;
            curY = curY2;
          } else if (!isCol1 && curY1 + 45 <= botLimitY) {
            curX = col1X;
            curY = curY1;
          } else {
            continue;
          }
        }

        const packTitle = p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name;

        if (p.kind === "editor") {
          ctx.fillStyle = "#D97706";
          ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`[MEMO: ${packTitle}]`, curX, curY);
          curY += 21;

          const memoLines = getMemoPreviewLines(p, 5);
          for (const line of memoLines) {
            if (curY + 19 > botLimitY) break;
            ctx.fillStyle = "#4B5563";
            ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
            const itemText = line.length > 20 ? line.slice(0, 20) + "..." : line;
            ctx.fillText(itemText, curX + 4, curY);
            curY += 19;
          }
          curY += 6;
        } else {
          ctx.fillStyle = "#1E40AF";
          ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`[${packTitle}]`, curX, curY);
          curY += 21;

          for (const item of p.items) {
            if (curY + 19 > botLimitY) break;
            ctx.fillStyle = item.checked ? "#94A3B8" : "#1E293B";
            ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
            const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
            ctx.fillText("[ ] " + itemText, curX + 8, curY);
            curY += 19;
          }
          curY += 6;
        }

        if (curX === col1X) {
          curY1 = curY;
        } else {
          curY2 = curY;
        }
      }
    }

    // 하단 스텁
    const botY = cardY + cardH - 105;
    ctx.fillStyle = "#F8FAFC";
    roundRect(ctx, cardX + 30, botY, cardW - 60, 42, 10);
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("COLLECTION STATUS", cardX + 44, botY + 26);

    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`READY · ${totalItems} ITEMS`, cardX + cardW - 44, botY + 26);
    ctx.textAlign = "left";

    drawBarcode(ctx, cardX + 36, cardY + cardH - 50, cardW - 72, 34);
  }

  // 2. 영수증 테마
  function drawReceipt(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#CBD5E1";
    ctx.fillRect(0, 0, w, h);

    const cardX = 60;
    const cardY = 40;
    const cardW = w - 120;
    const cardH = h - 80;

    ctx.fillStyle = "#FAFAF9";
    roundRect(ctx, cardX, cardY, cardW, cardH, 4);
    ctx.fill();

    ctx.fillStyle = "#1C1917";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("*** PACK IN BAG ***", w / 2, cardY + 45);

    ctx.font = "15px 'Courier New', monospace";
    ctx.fillText(isFolder ? "FOLDER PACKING RECEIPT" : "OFFICIAL PACKING RECEIPT", w / 2, cardY + 72);
    ctx.fillText(`COLLECTION: ${targetTitle}`, w / 2, cardY + 95);

    ctx.strokeStyle = "#44403C";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cardX + 24, cardY + 115);
    ctx.lineTo(cardX + cardW - 24, cardY + 115);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = "left";
    let currentY = cardY + 148;
    ctx.font = "bold 20px 'Courier New', monospace";
    const tripTitle = targetTitle.length > 20 ? targetTitle.slice(0, 20) + "..." : targetTitle;
    ctx.fillText(`NAME: ${tripTitle}`, cardX + 30, currentY);
    currentY += 28;

    const botY = cardY + cardH - 130;

    if (displayPacks.length === 1 && displayPacks[0].kind === "editor") {
      const p = displayPacks[0];
      const packTitle = p.name.length > 20 ? p.name.slice(0, 20) + "..." : p.name;
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = "#B45309";
      ctx.fillText(`[MEMO: ${packTitle}]`, cardX + 30, currentY);
      currentY += 26;

      const blocks = getMemoRichBlocks(p);
      currentY = renderRichMemoBlocksOnCanvas({
        ctx,
        blocks,
        startX: cardX + 30,
        startY: currentY,
        maxWidth: cardW - 60,
        botLimitY: botY,
        theme: "receipt",
      });
    } else {
      for (const p of displayPacks) {
        if (currentY + 30 >= botY) break;
        const packTitle = p.name.length > 20 ? p.name.slice(0, 20) + "..." : p.name;

        if (p.kind === "editor") {
          ctx.font = "bold 16px 'Courier New', monospace";
          ctx.fillStyle = "#B45309";
          ctx.fillText(`[MEMO: ${packTitle}]`, cardX + 30, currentY);
          currentY += 21;

          const memoLines = getMemoPreviewLines(p, 5);
          for (const line of memoLines) {
            if (currentY + 20 >= botY) break;
            ctx.font = "13px 'Courier New', monospace";
            ctx.fillStyle = "#44403C";
            const text = line.length > 24 ? line.slice(0, 24) + "..." : line;
            ctx.fillText(text, cardX + 36, currentY);
            ctx.fillText("NOTE", cardX + cardW - 70, currentY);
            currentY += 20;
          }
          currentY += 5;
        } else {
          ctx.font = "bold 16px 'Courier New', monospace";
          ctx.fillStyle = "#0C0A09";
          ctx.fillText(`[${packTitle}]`, cardX + 30, currentY);
          currentY += 21;

          for (const item of p.items) {
            if (currentY + 20 >= botY) break;
            ctx.font = "14px 'Courier New', monospace";
            ctx.fillStyle = item.checked ? "#78716C" : "#1C1917";
            const sign = "( ) ";
            const itemText = item.text.length > 22 ? item.text.slice(0, 22) + "..." : item.text;
            ctx.fillText(sign + itemText, cardX + 42, currentY);
            ctx.fillText("1 EA", cardX + cardW - 70, currentY);
            currentY += 20;
          }
          currentY += 5;
        }
      }
    }

    ctx.strokeStyle = "#44403C";
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cardX + 24, botY);
    ctx.lineTo(cardX + cardW - 24, botY);
    ctx.stroke();

    ctx.font = "bold 18px 'Courier New', monospace";
    ctx.fillStyle = "#1C1917";
    ctx.fillText("TOTAL ITEMS", cardX + 30, botY + 32);
    ctx.textAlign = "right";
    ctx.fillText(`${totalItems} EA`, cardX + cardW - 30, botY + 32);

    ctx.textAlign = "left";
    ctx.fillText("STATUS", cardX + 30, botY + 60);
    ctx.textAlign = "right";
    ctx.fillText("READY TO PACK", cardX + cardW - 30, botY + 60);

    drawBarcode(ctx, cardX + 40, cardY + cardH - 52, cardW - 80, 32);
    ctx.textAlign = "left";
  }

  // 3. 폴라로이드 테마
  function drawPolaroid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, "#F8F6F0");
    bgGrad.addColorStop(1, "#EAE5D9");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const cardX = 55;
    const cardY = 55;
    const cardW = w - 110;
    const cardH = h - 90;

    ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 상단 마스킹 테이프
    ctx.save();
    ctx.translate(w / 2, cardY + 4);
    ctx.rotate(-0.025);
    ctx.fillStyle = "rgba(254, 215, 170, 0.9)";
    roundRect(ctx, -65, -16, 130, 32, 4);
    ctx.fill();
    ctx.restore();

    // 내부 사진 영역
    const photoMargin = 32;
    const photoX = cardX + photoMargin;
    const photoY = cardY + 36;
    const photoW = cardW - photoMargin * 2;
    const photoH = cardH - 180;

    const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    photoGrad.addColorStop(0, "#E0F2FE");
    photoGrad.addColorStop(0.5, "#BAE6FD");
    photoGrad.addColorStop(1, "#7DD3FC");
    ctx.fillStyle = photoGrad;
    roundRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    roundRect(ctx, photoX + 10, photoY + 54, photoW - 20, photoH - 64, 6);
    ctx.fill();

    // 뷰파인더 모서리 브라켓
    ctx.strokeStyle = "rgba(14, 116, 144, 0.5)";
    ctx.lineWidth = 2;
    const bracketSize = 14;
    const bPad = 12;
    ctx.beginPath();
    ctx.moveTo(photoX + bPad, photoY + bPad + bracketSize);
    ctx.lineTo(photoX + bPad, photoY + bPad);
    ctx.lineTo(photoX + bPad + bracketSize, photoY + bPad);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(photoX + photoW - bPad - bracketSize, photoY + bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + bPad + bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(photoX + bPad, photoY + photoH - bPad - bracketSize);
    ctx.lineTo(photoX + bPad, photoY + photoH - bPad);
    ctx.lineTo(photoX + bPad + bracketSize, photoY + photoH - bPad);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(photoX + photoW - bPad - bracketSize, photoY + photoH - bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + photoH - bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + photoH - bPad - bracketSize);
    ctx.stroke();

    ctx.fillStyle = "#0369A1";
    ctx.font = "bold 11.5px 'Courier New', monospace";
    ctx.fillText("35mm FILM · SUNNY · ISO 100", photoX + 22, photoY + 34);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(photoX + photoW - 50, photoY + 34, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0284C7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#0284C7";
    ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isFolder ? "FOLDER" : "PACK", photoX + photoW - 50, photoY + 39);
    ctx.textAlign = "left";

    // 2단 리스트 (위에서 아래로 균등하게 채우는 레이아웃)
    const colStartY = photoY + 84;
    const botLimitY = photoY + photoH - 20;
    const col1X = photoX + 24;
    const col2X = photoX + 325;

    let curY1 = colStartY;
    let curY2 = colStartY;

    if (displayPacks.length === 1) {
      const p = displayPacks[0];
      const packTitle = p.name.length > 14 ? p.name.slice(0, 14) + "..." : p.name;

      if (p.kind === "editor") {
        // 단일 메모팩: 서식(헤딩, 볼드, 체크박스, 인용구, 형광펜 등)을 완벽히 적용하여 전폭 1단 렌더링
        ctx.fillStyle = "#B45309";
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`* [MEMO: ${packTitle}]`, col1X, curY1);
        curY1 += 26;

        const blocks = getMemoRichBlocks(p);
        curY1 = renderRichMemoBlocksOnCanvas({
          ctx,
          blocks,
          startX: col1X,
          startY: curY1,
          maxWidth: photoW - 48,
          botLimitY,
          theme: "polaroid",
        });
      } else {
        const items = p.items || [];
        const mid = Math.ceil(items.length / 2);
        const col1Items = items.slice(0, mid);
        const col2Items = items.slice(mid);

        ctx.fillStyle = "#0369A1";
        ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`* ${packTitle}`, col1X, curY1);
        curY1 += 20;
        for (const item of col1Items) {
          if (curY1 + 18 > botLimitY) break;
          ctx.fillStyle = "#0F172A";
          ctx.font = "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
          const itemText = item.text.length > 17 ? item.text.slice(0, 17) + "..." : item.text;
          ctx.fillText("[ ] " + itemText, col1X + 10, curY1);
          curY1 += 18;
        }

        if (col2Items.length > 0) {
          ctx.fillStyle = "#0369A1";
          ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`* ${packTitle} (이어서)`, col2X, curY2);
          curY2 += 20;
          for (const item of col2Items) {
            if (curY2 + 18 > botLimitY) break;
            ctx.fillStyle = "#0F172A";
            ctx.font = "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
            const itemText = item.text.length > 17 ? item.text.slice(0, 17) + "..." : item.text;
            ctx.fillText("[ ] " + itemText, col2X + 10, curY2);
            curY2 += 18;
          }
        }
      }
    } else {
      for (const p of displayPacks) {
        const isCol1 = curY1 <= curY2;
        let curX = isCol1 ? col1X : col2X;
        let curY = isCol1 ? curY1 : curY2;

        if (curY + 36 > botLimitY) {
          if (isCol1 && curY2 + 36 <= botLimitY) {
            curX = col2X;
            curY = curY2;
          } else if (!isCol1 && curY1 + 36 <= botLimitY) {
            curX = col1X;
            curY = curY1;
          } else {
            continue;
          }
        }

        const packTitle = p.name.length > 14 ? p.name.slice(0, 14) + "..." : p.name;

        if (p.kind === "editor") {
          ctx.fillStyle = "#B45309";
          ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`* [MEMO: ${packTitle}]`, curX, curY);
          curY += 20;

          const memoLines = getMemoPreviewLines(p, 4);
          for (const line of memoLines) {
            if (curY + 18 > botLimitY) break;
            ctx.fillStyle = "#334155";
            ctx.font = "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
            const text = line.length > 19 ? line.slice(0, 19) + "..." : line;
            ctx.fillText(text, curX + 4, curY);
            curY += 18;
          }
          curY += 6;
        } else {
          ctx.fillStyle = "#0369A1";
          ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`* ${packTitle}`, curX, curY);
          curY += 20;

          for (const item of p.items) {
            if (curY + 18 > botLimitY) break;
            ctx.fillStyle = "#0F172A";
            ctx.font = "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
            const itemText = item.text.length > 17 ? item.text.slice(0, 17) + "..." : item.text;
            ctx.fillText("[ ] " + itemText, curX + 10, curY);
            curY += 18;
          }
          curY += 6;
        }

        if (curX === col1X) {
          curY1 = curY;
        } else {
          curY2 = curY;
        }
      }
    }

    // 하단 시그니처 손글씨
    const chinY = photoY + photoH + 28;

    ctx.fillStyle = "#0F172A";
    ctx.font = "italic bold 32px Georgia, 'Times New Roman', serif";
    ctx.fillText(targetTitle, photoX + 6, chinY + 15);

    ctx.font = "500 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(
      `PACK IN BAG  ·  ${totalItems} ITEMS READY`,
      photoX + 8,
      chinY + 46
    );

    // 우측 하단 소인 스탬프
    const stampX = cardX + cardW - 85;
    const stampY = cardY + cardH - 65;

    ctx.save();
    ctx.translate(stampX, stampY);
    ctx.rotate(-0.15);

    ctx.strokeStyle = "rgba(220, 38, 38, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(220, 38, 38, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★ PACKED ★", 0, -10);
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText("READY", 0, 4);
    ctx.font = "bold 8px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("PACK IN BAG", 0, 16);

    ctx.restore();
    ctx.textAlign = "left";
  }

  function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = "#000000";
    let curX = x;
    const barWidths = [2, 4, 1, 3, 5, 2, 1, 4, 3, 2, 4, 1, 2, 3, 1, 5, 2, 4, 3, 1, 2, 4, 2, 3, 5, 1, 3];
    let i = 0;
    while (curX < x + w) {
      const bw = barWidths[i % barWidths.length];
      if (i % 2 === 0) {
        ctx.fillRect(curX, y, bw, h);
      }
      curX += bw + 2;
      i++;
    }
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // 이미지 다운로드
  const handleDownload = () => {
    const canvas = canvasRef.current || canvasElement;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${targetTitle}_공유카드.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  // 모바일 공유
  const handleShareImage = async () => {
    const canvas = canvasRef.current || canvasElement;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${targetTitle}_공유카드.png`, { type: "image/png" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${targetTitle} 패킹 리스트`,
            text: `팩인백에서 공유된 ${targetTitle} 패킹 리스트입니다.`,
          });
        } else {
          handleDownload();
        }
      });
    } catch {
      handleDownload();
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-start justify-center p-3 sm:p-4 pt-10 sm:pt-14 overflow-y-auto"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: resolvedZIndex,
        }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-[420px] rounded-3xl bg-surface border border-border shadow-2xl p-5 overflow-hidden flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-[17px] font-bold text-foreground truncate">
                {isFolder ? `${targetTitle} 폴더 공유` : `${targetTitle} 공유`}
              </h2>
              {isFolder && (
                <span className="text-[12px] text-text-muted shrink-0">
                  ({displayPacks.length}개 팩)
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <IconX size={18} stroke={2} />
            </button>
          </div>

          {/* 테마 선택 (3단 세그먼트) */}
          <div className="flex items-center rounded-xl bg-surface-2 p-1 gap-1 shrink-0">
            {(
              [
                { id: "boarding", label: "보딩패스" },
                { id: "receipt", label: "영수증" },
                { id: "polaroid", label: "폴라로이드" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                  theme === t.id
                    ? "bg-surface text-foreground shadow-sm font-semibold"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 카드 미리보기 캔버스 (좌우 스와이프로 전환) */}
          <div
            onClick={handleOpenEnlargedPreview}
            onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
            className="group relative flex items-center justify-center rounded-2xl bg-surface-2/60 border border-border/60 p-3 overflow-hidden cursor-zoom-in transition-transform active:scale-[0.99] select-none"
            title="클릭하여 크게 보기 (좌우 스와이프로 카드 전환)"
          >
            <canvas
              ref={setCanvasRef}
              className="w-full max-h-[250px] object-contain rounded-lg drop-shadow-md"
            />
            {/* 좌우 이동 버튼 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevTheme();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/70 active:scale-90 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
              aria-label="이전 카드"
            >
              <IconChevronLeft size={16} stroke={2.5} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNextTheme();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/70 active:scale-90 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
              aria-label="다음 카드"
            >
              <IconChevronRight size={16} stroke={2.5} />
            </button>

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 pointer-events-none">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 text-white text-[12px] font-medium backdrop-blur-sm shadow-md">
                <IconZoomIn size={15} stroke={2} />
                크게 보기
              </span>
            </div>
          </div>

          {/* 웹 링크 복사 박스 */}
          <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-2/70 border border-border/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-text-secondary">
                웹 공유 링크
              </span>
              {loadingToken && (
                <span className="flex items-center gap-1 text-[11px] text-text-muted">
                  <IconLoader2 size={12} className="animate-spin" />
                  생성 중
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[12px] text-text-secondary truncate font-mono select-all">
                {shareUrl || "링크를 불러오는 중입니다..."}
              </div>
              <button
                onClick={handleCopyLink}
                disabled={!shareUrl}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-white text-[12.5px] font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
              >
                {linkCopied ? (
                  <>
                    <IconCheck size={14} stroke={2.5} />
                    복사됨
                  </>
                ) : (
                  <>
                    <IconCopy size={14} stroke={2} />
                    복사
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              링크를 가진 사람은 웹에서 바로 보거나 자신의 보관함으로 복사할 수 있어요.
            </p>
          </div>

          {/* 하단 다운로드 & 공유 버튼 */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 rounded-2xl bg-surface-2 text-foreground font-medium text-[13.5px] flex items-center justify-center gap-2 border border-border/80 hover:bg-surface-3 transition-colors active:scale-95"
            >
              <IconDownload size={17} stroke={2} />
              이미지 저장
            </button>
            <button
              onClick={handleShareImage}
              className="flex-1 py-3 rounded-2xl bg-accent text-white font-medium text-[13.5px] flex items-center justify-center gap-2 shadow-lg shadow-accent/20 hover:opacity-95 transition-opacity active:scale-95"
            >
              <IconShare size={17} stroke={2} />
              공유하기
            </button>
          </div>
        </div>
      </div>

      {/* 카드 확대 미리보기 라이트박스 (좌우 스와이프 및 전환 지원) */}
      {showEnlargedPreview && (
        <Portal>
          <div
            className="fixed inset-0 z-[120] flex flex-col items-center justify-between p-4 select-none"
            style={{
              background: "rgba(0,0,0,0.9)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            onClick={() => setShowEnlargedPreview(false)}
            onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
            onMouseDown={(e) => handleSwipeStart(e.clientX, e.clientY)}
            onMouseUp={(e) => handleSwipeEnd(e.clientX, e.clientY)}
          >
            {/* 상단 툴바 (테마 전환 탭 & 저장/닫기) */}
            <div
              className="w-full max-w-lg flex items-center justify-between gap-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 상단 3종 테마 전환 필 */}
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/10 text-white text-[12px] font-medium shadow-lg">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`px-3 py-1 rounded-full transition-all ${
                      theme === t
                        ? "bg-white text-black font-bold shadow-sm"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {THEME_LABELS[t]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all flex items-center gap-1.5 text-[12px] font-bold shadow-lg backdrop-blur-sm"
                  aria-label="저장"
                >
                  <IconDownload size={15} />
                  <span>저장</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEnlargedPreview(false);
                  }}
                  className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all shadow-lg backdrop-blur-sm"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* 중앙 이미지 및 좌우 네비게이션 버튼 */}
            <div
              className="relative max-w-md w-full flex-1 flex items-center justify-center min-h-0 my-auto py-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 이전 카드 버튼 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevTheme();
                }}
                className="absolute -left-2 sm:-left-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 active:scale-90 text-white transition-all backdrop-blur-md shadow-xl z-20 border border-white/15"
                aria-label="이전 카드 (스와이프 가능)"
                title="이전 카드 (← 방향키/스와이프)"
              >
                <IconChevronLeft size={22} stroke={2.5} />
              </button>

              {previewDataUrl && (
                <img
                  src={previewDataUrl}
                  alt={`${targetTitle} 공유 카드 확대`}
                  className="max-h-[76vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl transition-all duration-200"
                  draggable={false}
                />
              )}

              {/* 다음 카드 버튼 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextTheme();
                }}
                className="absolute -right-2 sm:-right-6 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 active:scale-90 text-white transition-all backdrop-blur-md shadow-xl z-20 border border-white/15"
                aria-label="다음 카드 (스와이프 가능)"
                title="다음 카드 (→ 방향키/스와이프)"
              >
                <IconChevronRight size={22} stroke={2.5} />
              </button>
            </div>

            {/* 하단 인디케이터 점 3개 & 팁 */}
            <div
              className="flex flex-col items-center gap-1.5 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`h-2 rounded-full transition-all ${
                      theme === t ? "w-6 bg-white shadow-sm" : "w-2 bg-white/35 hover:bg-white/60"
                    }`}
                    aria-label={`${THEME_LABELS[t]}로 전환`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-white/60 font-medium">
                좌우로 스와이프하거나 방향키로 3종 카드를 바로 전환해보세요
              </p>
            </div>
          </div>
        </Portal>
      )}
    </Portal>
  );
}
