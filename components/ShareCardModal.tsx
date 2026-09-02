"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bag, Pack } from "@/lib/types";
import {
  IconDownload,
  IconShare,
  IconX,
  IconCheck,
  IconPhoto,
  IconLink,
  IconUsers,
  IconCopy,
  IconCrown,
  IconArrowsExchange,
  IconUserMinus,
  IconRefresh,
  IconLogout,
  IconZoomIn,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  collectEditorDocPreviewLines,
  collectEditorDocRichBlocks,
  renderRichMemoBlocksOnCanvas,
  RichBlock,
} from "@/lib/editorDocPreview";
import Portal from "@/components/Portal";
import { OverlayLayerProvider, useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { ensureBagPublicShareToken } from "@/lib/bagsService";

interface ShareCardModalProps {
  bag: Bag;
  currentUid?: string;
  initialTab?: "card" | "members";
  onClose: () => void;
  onLeave?: () => Promise<void> | void;
  onRemoveMember?: (uid: string) => Promise<void> | void;
  onRegenerateCode?: () => Promise<void> | void;
  onTransferOwnership?: (targetUid: string) => Promise<void> | void;
}

type MainTab = "card" | "members";
type CardTheme = "boarding" | "receipt" | "polaroid";

function getMemoPreviewLines(pack: Pack, maxLines = 5): string[] {
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

export default function ShareCardModal({
  bag,
  currentUid,
  initialTab = "card",
  onClose,
  onLeave,
  onRemoveMember,
  onRegenerateCode,
  onTransferOwnership,
}: ShareCardModalProps) {
  const { show } = useToast();
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const isOwner = currentUid ? bag.ownerId === currentUid : false;

  const [mainTab, setMainTab] = useState<MainTab>(initialTab);
  const [theme, setTheme] = useState<CardTheme>("boarding");
  const [includeInvite, setIncludeInvite] = useState(true);
  const [publicShareToken, setPublicShareToken] = useState<string>(bag.publicShareToken || "");
  const [copied, setCopied] = useState(false);
  const [guestLinkCopied, setGuestLinkCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (!bag.publicShareToken) {
      ensureBagPublicShareToken(bag.id).then((token) => {
        if (token) setPublicShareToken(token);
      });
    } else {
      setPublicShareToken(bag.publicShareToken);
    }
  }, [bag.id, bag.publicShareToken]);

  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmTransferUid, setConfirmTransferUid] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvasRef = (el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el !== canvasElement) {
      setCanvasElement(el);
    }
  };

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

  const handleOpenEnlargedPreview = () => {
    const canvas = canvasRef.current || canvasElement;
    if (canvas) {
      try {
        setPreviewDataUrl(canvas.toDataURL("image/png"));
      } catch {
        // ignore
      }
      setShowEnlargedPreview(true);
    }
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

  const displayPacks: Pack[] = useMemo(() => {
    return bag.packs.filter((p) => p.type !== "folder");
  }, [bag.packs]);

  const totalItems = useMemo(() => {
    return displayPacks.reduce((acc, p) => acc + p.items.length, 0);
  }, [displayPacks]);

  const checkedItems = useMemo(() => {
    return displayPacks.reduce(
      (acc, p) => acc + p.items.filter((i) => i.checked).length,
      0
    );
  }, [displayPacks]);

  const progressRatio = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  let ddayText = "";
  if (bag.travelDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(bag.travelDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    ddayText = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  } else {
    ddayText = "D-DAY";
  }

  // 캔버스 렌더링 (내용량에 따른 동적 높이 계산 & 하단 여백 최소화)
  useEffect(() => {
    if (mainTab !== "card") return;
    const canvas = canvasElement || canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 800;
    const listH = computeEstimatedListHeight(displayPacks, theme);
    let height = 1200;

    if (theme === "boarding") {
      const cardH = Math.min(1120, Math.max(500, 313 + listH + 150));
      height = cardH + 80;
    } else if (theme === "receipt") {
      const cardH = Math.min(1120, Math.max(480, 176 + listH + 170));
      height = cardH + 80;
    } else {
      const photoH = Math.min(780, Math.max(220, 84 + listH + 25));
      const cardH = Math.min(1120, Math.max(500, 36 + photoH + 140));
      height = cardH + 90;
    }

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (theme === "boarding") {
      drawBoardingPass(ctx, width, height);
    } else if (theme === "receipt") {
      drawReceipt(ctx, width, height);
    } else {
      drawPolaroid(ctx, width, height);
    }

    try {
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch {
      // ignore
    }
  }, [canvasElement, mainTab, theme, bag, displayPacks, progressRatio, ddayText, checkedItems, totalItems]);

  // 비행기 실루엣 그리기 헬퍼
  function drawAirplane(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    color: string,
    angle = 0
  ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;

    // 동체 (Fuselage)
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.1, size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // 주 날개 (Main Wings)
    ctx.beginPath();
    ctx.moveTo(-size * 0.15, 0);
    ctx.lineTo(-size * 0.45, -size * 1.05);
    ctx.lineTo(-size * 0.05, -size * 1.05);
    ctx.lineTo(size * 0.35, 0);
    ctx.lineTo(-size * 0.05, size * 1.05);
    ctx.lineTo(-size * 0.45, size * 1.05);
    ctx.closePath();
    ctx.fill();

    // 꼬리 날개 (Tail Wings)
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

  // 1. 보딩패스 테마 (실제 항공권 스타일 + 비행기 그래픽 + 티켓 홈)
  function drawBoardingPass(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // 배경 (공항 라운지 딥 네이비)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#090D16");
    grad.addColorStop(1, "#1E293B");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const cardX = 45;
    const cardY = 40;
    const cardW = w - 90;
    const cardH = h - 80;

    // 티켓 본체 흰색 라운드 사각형
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();

    // 상단 항공권 블루 헤더
    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 120);
    headerGrad.addColorStop(0, "#1D4ED8");
    headerGrad.addColorStop(1, "#2563EB");
    ctx.fillStyle = headerGrad;
    roundRectTop(ctx, cardX, cardY, cardW, 120, 24);
    ctx.fill();

    // 헤더 비행기 아이콘 & 텍스트
    drawAirplane(ctx, cardX + 48, cardY + 60, 18, "#FFFFFF", -Math.PI / 12);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("PACK IN BAG AIRLINES", cardX + 80, cardY + 54);

    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText("BOARDING PASS · FIRST CLASS", cardX + 80, cardY + 76);

    // D-Day 배지
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX + cardW - 120, cardY + 36, 88, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#1D4ED8";
    ctx.font = "bold 21px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ddayText, cardX + cardW - 76, cardY + 68);
    ctx.textAlign = "left";

    // 노선 (Route) 섹션
    const routeY = cardY + 155;
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
    const title = bag.name.length > 15 ? bag.name.slice(0, 15) + "..." : bag.name;
    ctx.fillText("ICN", cardX + 36, routeY + 24);
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("SEOUL / INCHEON", cardX + 36, routeY + 44);

    // 비행 궤적 점선 아크 + 비행기
    ctx.strokeStyle = "#94A3B8";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 160, routeY + 16);
    ctx.quadraticCurveTo(cardX + cardW / 2, routeY - 14, cardX + cardW - 200, routeY + 16);
    ctx.stroke();
    ctx.setLineDash([]);

    drawAirplane(ctx, cardX + cardW / 2 - 20, routeY - 2, 14, "#2563EB", 0.05);

    // 목적지 (가방 이름)
    ctx.textAlign = "right";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(title, cardX + cardW - 36, routeY + 24);
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(`출발: ${bag.travelDate || "미정"}`, cardX + cardW - 36, routeY + 44);
    ctx.textAlign = "left";

    // 비행 상세 칩 그리드 (FLIGHT / GATE / SEAT / TOTAL)
    const chipY = routeY + 62;
    const chips = [
      { label: "FLIGHT", val: "PB-2026" },
      { label: "GATE", val: "07A" },
      { label: "SEAT", val: "01A" },
      { label: "PACKS", val: `${bag.packs.length}개 팩` },
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

    // 티켓 좌우 반원 펀칭 홈 (Punch Cutouts)
    const notchY = chipY + 60;
    ctx.fillStyle = "#090D16";
    ctx.beginPath();
    ctx.arc(cardX, notchY, 14, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cardX + cardW, notchY, 14, Math.PI / 2, -Math.PI / 2);
    ctx.fill();

    // 점선 절취선
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
      const pack = displayPacks[0];
      const packTitle = pack.name.length > 15 ? pack.name.slice(0, 15) + "..." : pack.name;

      if (pack.kind === "editor") {
        // 단일 메모팩: 서식(헤딩, 볼드, 체크박스, 인용구, 형광펜 등)을 완벽히 적용하여 전폭 1단 렌더링
        ctx.fillStyle = "#D97706";
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`[📝 ${packTitle}]`, col1X, curY1);
        curY1 += 26;

        const blocks = getMemoRichBlocks(pack);
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
        const items = pack.items;
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
          ctx.font = item.checked
            ? "13px -apple-system, BlinkMacSystemFont, sans-serif"
            : "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
          const checkIcon = item.checked ? "[✓] " : "[ ] ";
          const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
          ctx.fillText(checkIcon + itemText, col1X + 8, curY1);
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
            ctx.font = item.checked
              ? "13px -apple-system, BlinkMacSystemFont, sans-serif"
              : "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
            const checkIcon = item.checked ? "[✓] " : "[ ] ";
            const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
            ctx.fillText(checkIcon + itemText, col2X + 8, curY2);
            curY2 += 19;
          }
        }
      }
    } else {
      for (const pack of displayPacks) {
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

        const packTitle = pack.name.length > 15 ? pack.name.slice(0, 15) + "..." : pack.name;

        if (pack.kind === "editor") {
          ctx.fillStyle = "#D97706";
          ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`[📝 ${packTitle}]`, curX, curY);
          curY += 21;

          const memoLines = getMemoPreviewLines(pack, 5);
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

          for (const item of pack.items) {
            if (curY + 19 > botLimitY) break;
            ctx.fillStyle = item.checked ? "#94A3B8" : "#1E293B";
            ctx.font = item.checked
              ? "13px -apple-system, BlinkMacSystemFont, sans-serif"
              : "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
            const checkIcon = item.checked ? "[✓] " : "[ ] ";
            const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
            ctx.fillText(checkIcon + itemText, curX + 8, curY);
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

    // 하단 진행률 & 바코드 스텁
    const botY = cardY + cardH - 105;
    ctx.fillStyle = "#F8FAFC";
    roundRect(ctx, cardX + 30, botY, cardW - 60, 42, 10);
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("BOARDING STATUS", cardX + 44, botY + 26);

    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${progressRatio}% READY (${checkedItems}/${totalItems})`, cardX + cardW - 44, botY + 26);
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
    ctx.fillText("OFFICIAL PACKING RECEIPT", w / 2, cardY + 72);
    ctx.fillText(`DATE: ${bag.travelDate || "2026.00.00"}   STATUS: ${ddayText}`, w / 2, cardY + 95);

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
    const tripTitle = bag.name.length > 20 ? bag.name.slice(0, 20) + "..." : bag.name;
    ctx.fillText(`TRIP: ${tripTitle}`, cardX + 30, currentY);
    currentY += 28;

    const botY = cardY + cardH - 130;

    if (displayPacks.length === 1 && displayPacks[0].kind === "editor") {
      const pack = displayPacks[0];
      const packTitle = pack.name.length > 20 ? pack.name.slice(0, 20) + "..." : pack.name;
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = "#B45309";
      ctx.fillText(`[MEMO: ${packTitle}]`, cardX + 30, currentY);
      currentY += 26;

      const blocks = getMemoRichBlocks(pack);
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
      for (const pack of displayPacks) {
        if (currentY + 30 >= botY) break;
        const packTitle = pack.name.length > 20 ? pack.name.slice(0, 20) + "..." : pack.name;

        if (pack.kind === "editor") {
          ctx.font = "bold 16px 'Courier New', monospace";
          ctx.fillStyle = "#B45309";
          ctx.fillText(`[MEMO: ${packTitle}]`, cardX + 30, currentY);
          currentY += 21;

          const memoLines = getMemoPreviewLines(pack, 5);
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

          for (const item of pack.items) {
            if (currentY + 20 >= botY) break;
            ctx.font = "14px 'Courier New', monospace";
            ctx.fillStyle = item.checked ? "#78716C" : "#1C1917";
            const sign = item.checked ? "(V) " : "( ) ";
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

    ctx.fillText("TOTAL ITEMS", cardX + 30, botY + 32);
    ctx.textAlign = "right";
    ctx.fillText(`${totalItems} EA`, cardX + cardW - 30, botY + 32);

    ctx.textAlign = "left";
    ctx.fillText("COMPLETED", cardX + 30, botY + 60);
    ctx.textAlign = "right";
    ctx.fillText(`${checkedItems} EA (${progressRatio}%)`, cardX + cardW - 30, botY + 60);

    drawBarcode(ctx, cardX + 40, cardY + cardH - 52, cardW - 80, 32);
    ctx.textAlign = "left";
  }

  // 3. 폴라로이드 테마 (밝고 화사한 감성 즉석 사진 + 마스킹 테이프 + 청량한 하늘/휴양지 톤 + 손글씨)
  function drawPolaroid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // 배경 (따뜻하고 화사한 베이지/린넨 톤)
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, "#F8F6F0");
    bgGrad.addColorStop(1, "#EAE5D9");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const cardX = 55;
    const cardY = 55;
    const cardW = w - 110;
    const cardH = h - 100;

    // 사진 프레임 부드러운 그림자
    ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    // 폴라로이드 종이 (순백 화이트)
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();

    // 그림자 리셋
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 상단 마스킹 테이프 (Washi Tape - 감성 파스텔 피치/옐로우)
    ctx.save();
    ctx.translate(w / 2, cardY + 4);
    ctx.rotate(-0.025);
    ctx.fillStyle = "rgba(254, 215, 170, 0.9)"; // 따뜻한 파스텔 피치
    roundRect(ctx, -65, -16, 130, 32, 4);
    ctx.fill();
    ctx.restore();

    // 내부 사진 영역 (정사각형에 가까운 필름 윈도우, 하단에 넓은 240px 화이트 친 여백)
    const photoMargin = 32;
    const photoX = cardX + photoMargin;
    const photoY = cardY + 36;
    const photoW = cardW - photoMargin * 2;
    const photoH = cardH - 240;

    // 감성 휴양지 청량 하늘/오션 그라데이션 (밝고 화사한 톤)
    const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    photoGrad.addColorStop(0, "#E0F2FE"); // 밝은 파스텔 하늘
    photoGrad.addColorStop(0.5, "#BAE6FD");
    photoGrad.addColorStop(1, "#7DD3FC"); // 청량한 스카이 블루
    ctx.fillStyle = photoGrad;
    roundRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.fill();

    // 사진 내부 반투명 화이트 카드 레이어 (가독성 확보)
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    roundRect(ctx, photoX + 10, photoY + 54, photoW - 20, photoH - 64, 6);
    ctx.fill();

    // 뷰파인더 모서리 브라켓 (┌ ┐ └ ┘)
    ctx.strokeStyle = "rgba(14, 116, 144, 0.5)";
    ctx.lineWidth = 2;
    const bracketSize = 14;
    const bPad = 12;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(photoX + bPad, photoY + bPad + bracketSize);
    ctx.lineTo(photoX + bPad, photoY + bPad);
    ctx.lineTo(photoX + bPad + bracketSize, photoY + bPad);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(photoX + photoW - bPad - bracketSize, photoY + bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + bPad + bracketSize);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(photoX + bPad, photoY + photoH - bPad - bracketSize);
    ctx.lineTo(photoX + bPad, photoY + photoH - bPad);
    ctx.lineTo(photoX + bPad + bracketSize, photoY + photoH - bPad);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(photoX + photoW - bPad - bracketSize, photoY + photoH - bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + photoH - bPad);
    ctx.lineTo(photoX + photoW - bPad, photoY + photoH - bPad - bracketSize);
    ctx.stroke();

    // 사진 상단 카메라 메타데이터
    ctx.fillStyle = "#0369A1";
    ctx.font = "bold 11.5px 'Courier New', monospace";
    ctx.fillText("📷 35mm FILM · SUNNY · ISO 100", photoX + 22, photoY + 34);

    // D-DAY 원형 스탬프 뱃지
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(photoX + photoW - 50, photoY + 34, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0284C7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#0284C7";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ddayText, photoX + photoW - 50, photoY + 39);
    ctx.textAlign = "left";

    // 사진 내부 팩 & 아이템 2단 리스트 (위에서 아래로 균등하게 채우는 레이아웃)
    const colStartY = photoY + 84;
    const botLimitY = photoY + photoH - 20;
    const col1X = photoX + 24;
    const col2X = photoX + 325;

    let curY1 = colStartY;
    let curY2 = colStartY;

    if (displayPacks.length === 1) {
      const pack = displayPacks[0];
      const packTitle = pack.name.length > 14 ? pack.name.slice(0, 14) + "..." : pack.name;

      if (pack.kind === "editor") {
        // 단일 메모팩: 서식(헤딩, 볼드, 체크박스, 인용구, 형광펜 등)을 완벽히 적용하여 전폭 1단 렌더링
        ctx.fillStyle = "#B45309";
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`* 📝 ${packTitle}`, col1X, curY1);
        curY1 += 26;

        const blocks = getMemoRichBlocks(pack);
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
        const items = pack.items;
        const mid = Math.ceil(items.length / 2);
        const col1Items = items.slice(0, mid);
        const col2Items = items.slice(mid);

        ctx.fillStyle = "#0369A1";
        ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`* ${packTitle}`, col1X, curY1);
        curY1 += 20;
        for (const item of col1Items) {
          if (curY1 + 18 > botLimitY) break;
          ctx.fillStyle = item.checked ? "#94A3B8" : "#0F172A";
          ctx.font = item.checked
            ? "12.5px -apple-system, BlinkMacSystemFont, sans-serif"
            : "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
          const mark = item.checked ? "[✓] " : "[ ] ";
          const itemText = item.text.length > 17 ? item.text.slice(0, 17) + "..." : item.text;
          ctx.fillText(mark + itemText, col1X + 10, curY1);
          curY1 += 18;
        }

        if (col2Items.length > 0) {
          ctx.fillStyle = "#0369A1";
          ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`* ${packTitle} (이어서)`, col2X, curY2);
          curY2 += 20;
          for (const item of col2Items) {
            if (curY2 + 18 > botLimitY) break;
            ctx.fillStyle = item.checked ? "#94A3B8" : "#0F172A";
            ctx.font = item.checked
              ? "12.5px -apple-system, BlinkMacSystemFont, sans-serif"
              : "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
            const mark = item.checked ? "[✓] " : "[ ] ";
            const itemText = item.text.length > 17 ? item.text.slice(0, 17) + "..." : item.text;
            ctx.fillText(mark + itemText, col2X + 10, curY2);
            curY2 += 18;
          }
        }
      }
    } else {
      for (const pack of displayPacks) {
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

        const packTitle = pack.name.length > 14 ? pack.name.slice(0, 14) + "..." : pack.name;

        if (pack.kind === "editor") {
          ctx.fillStyle = "#B45309";
          ctx.font = "bold 14.5px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`* 📝 ${packTitle}`, curX, curY);
          curY += 20;

          const memoLines = getMemoPreviewLines(pack, 4);
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

          for (const item of pack.items) {
            if (curY + 18 > botLimitY) break;
            ctx.fillStyle = item.checked ? "#94A3B8" : "#0F172A";
            ctx.font = item.checked
              ? "12.5px -apple-system, BlinkMacSystemFont, sans-serif"
              : "500 12.5px -apple-system, BlinkMacSystemFont, sans-serif";
            const mark = item.checked ? "[✓] " : "[ ] ";
            const itemText = item.text.length > 17 ? item.text.slice(0, 17) + "..." : item.text;
            ctx.fillText(mark + itemText, curX + 10, curY);
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

    // 하단 시그니처 손글씨 영역 (Wide Bottom Chin)
    const chinY = photoY + photoH + 40;

    // 감성 손글씨 여행 제목
    ctx.fillStyle = "#0F172A";
    ctx.font = "italic bold 32px Georgia, 'Times New Roman', serif";
    ctx.fillText(bag.name, photoX + 6, chinY + 15);

    // 날짜 & 달성률 서브 손글씨
    ctx.font = "500 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(
      `일정: ${bag.travelDate || "2026"}  ♡  ${checkedItems}/${totalItems} PACKED (${progressRatio}%)`,
      photoX + 8,
      chinY + 46
    );

    // 우측 하단 빈티지 여행 우체국 소인 스탬프 (Postmark Ink Stamp)
    const stampX = cardX + cardW - 85;
    const stampY = cardY + cardH - 75;

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
    ctx.fillText(bag.travelDate ? bag.travelDate.slice(0, 10) : "READY", 0, 4);
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

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${bag.name.replace(/\s+/g, "_")}_카드.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    show("이미지를 저장했어요");
  };

  const handleCopyGuestLink = async () => {
    let token = publicShareToken || bag.publicShareToken;
    if (!token) {
      token = await ensureBagPublicShareToken(bag.id);
      if (token) setPublicShareToken(token);
    }
    const finalToken = token || bag.inviteCode;
    const url = `${window.location.origin}/v/${finalToken}${includeInvite ? `?code=${bag.inviteCode}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setGuestLinkCopied(true);
      show(
        includeInvite
          ? "초대 권한이 포함된 보기 링크가 복사되었어요"
          : "보기 전용 링크가 클립보드에 복사되었어요"
      );
      setTimeout(() => setGuestLinkCopied(false), 2000);
    } catch {
      show("링크 복사에 실패했어요");
    }
  };

  const handleCopyInviteCode = async () => {
    const inviteLink = `${window.location.origin}/?invite=${bag.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      show("초대 링크가 복사되었어요");
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      show("링크 복사에 실패했어요");
    }
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const isMobile =
          typeof window !== "undefined" &&
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const file = new File([blob], `${bag.name}_card.png`, { type: "image/png" });

        let token = publicShareToken || bag.publicShareToken;
        if (!token) {
          token = await ensureBagPublicShareToken(bag.id);
          if (token) setPublicShareToken(token);
        }
        const finalToken = token || bag.inviteCode;
        const guestUrl = `${window.location.origin}/v/${finalToken}${
          includeInvite ? `?code=${bag.inviteCode}` : ""
        }`;
        const shareText = `[${bag.name}]\n${guestUrl}`;

        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: bag.name,
              text: shareText,
              files: [file],
            });
            return;
          } catch {
            return;
          }
        }

        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopied(true);
            show("이미지가 클립보드에 복사되었어요");
            setTimeout(() => setCopied(false), 2000);
          } else {
            handleDownload();
          }
        } catch {
          handleDownload();
        }
      });
    } catch {
      handleDownload();
    }
  };

  // 멤버 관리 핸들러들
  const handleRegenerate = async () => {
    if (!onRegenerateCode) return;
    setConfirmRegenerate(false);
    setRegenerating(true);
    try {
      await onRegenerateCode();
      show("초대 코드를 새로 발급했어요");
    } finally {
      setRegenerating(false);
    }
  };

  const handleLeave = async () => {
    if (!onLeave) return;
    setConfirmLeave(false);
    setLeaving(true);
    try {
      await onLeave();
    } catch {
      setLeaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!confirmTransferUid || !onTransferOwnership) return;
    const targetUid = confirmTransferUid;
    setConfirmTransferUid(null);
    setTransferring(true);
    try {
      await onTransferOwnership(targetUid);
      show("그룹장을 넘겼어요");
    } finally {
      setTransferring(false);
    }
  };

  const members = bag.memberIds.map((uid) => ({
    uid,
    profile: bag.memberProfiles?.[uid],
  }));

  return (
    <Portal>
      <OverlayLayerProvider value={resolvedZIndex}>
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
          style={{ zIndex: resolvedZIndex }}
          onClick={onClose}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            className="w-full max-w-sm bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 모달 헤더 */}
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2">
                <IconShare size={19} className="text-accent" />
                <h3 className="text-[16px] font-bold text-foreground">가방 공유 및 멤버</h3>
              </div>
              <button
                onClick={onClose}
                aria-label="닫기"
                className="p-1.5 -mr-1.5 rounded-full hover:bg-surface-2 text-text-muted hover:text-foreground transition-colors"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* 메인 2단 언더라인 탭 (상위 계층으로 명확히 구분) */}
            <div className="flex border-b border-border mb-3.5 shrink-0">
              <button
                onClick={() => setMainTab("card")}
                className={`flex-1 pb-2.5 text-[13px] flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-[1px] ${
                  mainTab === "card"
                    ? "border-accent text-accent font-bold"
                    : "border-transparent text-text-muted hover:text-foreground font-medium"
                }`}
              >
                <IconPhoto size={15} />
                <span>공유</span>
              </button>
              <button
                onClick={() => setMainTab("members")}
                className={`flex-1 pb-2.5 text-[13px] flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-[1px] ${
                  mainTab === "members"
                    ? "border-accent text-accent font-bold"
                    : "border-transparent text-text-muted hover:text-foreground font-medium"
                }`}
              >
                <IconUsers size={15} />
                <span>그룹원 ({bag.memberIds.length}명)</span>
              </button>
            </div>

            {/* TAB 1: 공유 (여행 카드) */}
            {mainTab === "card" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-0.5">
                {/* 테마 선택 서브 탭 (Pill 형태) */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-surface-2 rounded-xl mb-2.5 text-[11.5px] font-medium shrink-0">
                  <button
                    onClick={() => setTheme("boarding")}
                    className={`py-1.5 rounded-lg transition-all ${
                      theme === "boarding"
                        ? "bg-surface text-accent font-bold shadow-xs"
                        : "text-text-secondary hover:text-foreground"
                    }`}
                  >
                    보딩패스
                  </button>
                  <button
                    onClick={() => setTheme("receipt")}
                    className={`py-1.5 rounded-lg transition-all ${
                      theme === "receipt"
                        ? "bg-surface text-accent font-bold shadow-xs"
                        : "text-text-secondary hover:text-foreground"
                    }`}
                  >
                    영수증
                  </button>
                  <button
                    onClick={() => setTheme("polaroid")}
                    className={`py-1.5 rounded-lg transition-all ${
                      theme === "polaroid"
                        ? "bg-surface text-accent font-bold shadow-xs"
                        : "text-text-secondary hover:text-foreground"
                    }`}
                  >
                    폴라로이드
                  </button>
                </div>

                {/* 캔버스 프리뷰 (클릭 시 크게 보기 + 좌우 스와이프로 전환) */}
                <div
                  onClick={handleOpenEnlargedPreview}
                  onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
                  title="클릭하여 크게 보기 (좌우 스와이프로 카드 전환)"
                  className="group relative flex items-center justify-center p-2 bg-surface-2 rounded-xl mb-2.5 border border-border min-h-[220px] max-h-[280px] cursor-pointer hover:border-accent/50 transition-all select-none"
                >
                  <canvas
                    ref={setCanvasRef}
                    className="w-full max-h-[260px] object-contain rounded-lg shadow-sm"
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

                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-black/75 text-white text-[12px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-xs">
                      <IconZoomIn size={15} />
                      <span>크게 보기</span>
                    </div>
                  </div>
                </div>

                {/* 초대코드 포함 옵션 체크박스 */}
                <div className="mb-2 px-1 flex items-center shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[12px] text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={includeInvite}
                      onChange={(e) => setIncludeInvite(e.target.checked)}
                      className="w-4 h-4 rounded-sm border-border text-accent focus:ring-accent accent-accent"
                    />
                    <span>그룹원 참여 권한(초대코드) 함께 공유</span>
                  </label>
                </div>

                {/* 보기 전용 웹 링크 복사 박스 */}
                <div className="mb-3 p-2.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between gap-2 shrink-0">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-foreground truncate">보기 전용 웹 링크</p>
                    <p className="text-[10px] text-text-muted truncate">
                      {includeInvite
                        ? "초대코드가 포함되어 앱/웹에서 바로 그룹원으로 참여 가능"
                        : "로그인 없이 누구나 웹에서 읽기 전용으로 볼 수 있어요"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyGuestLink}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-3 active:scale-95 text-[11px] font-bold text-accent flex items-center gap-1 transition-all shadow-xs"
                  >
                    {guestLinkCopied ? (
                      <>
                        <IconCheck size={13} className="text-emerald-500" stroke={2.5} />
                        <span className="text-emerald-600 dark:text-emerald-400">복사됨</span>
                      </>
                    ) : (
                      <>
                        <IconLink size={13} stroke={2} />
                        <span>링크 복사</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 하단 액션 버튼 */}
                <div className="grid grid-cols-2 gap-2 mt-auto shrink-0 pt-1">
                  <button
                    onClick={handleDownload}
                    className="py-2.5 rounded-xl border border-border hover:bg-surface-2 active:scale-[0.98] font-bold text-[13px] text-foreground flex items-center justify-center gap-1.5 transition-all"
                  >
                    <IconDownload size={16} />
                    이미지 저장
                  </button>
                  <button
                    onClick={handleShare}
                    className="py-2.5 rounded-xl bg-accent text-white hover:brightness-105 active:scale-[0.98] font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    {copied ? <IconCheck size={16} stroke={2.5} /> : <IconShare size={16} />}
                    {copied ? "복사 완료" : "공유하기"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: 그룹원 관리 */}
            {mainTab === "members" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-0.5 space-y-3">
                {/* 멤버 목록 */}
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[220px] p-2 bg-surface-2 rounded-xl border border-border">
                  {members.map(({ uid, profile }) => (
                    <div key={uid} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg">
                      <Avatar avatarId={profile?.avatarId} size={30} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate flex items-center gap-1">
                          {profile?.nickname ?? "알 수 없음"}
                          {uid === currentUid && (
                            <span className="text-text-muted font-normal text-[11px]">(나)</span>
                          )}
                          {uid === bag.ownerId && (
                            <IconCrown size={13} stroke={2} className="text-amber-500 shrink-0" />
                          )}
                        </p>
                      </div>
                      {isOwner && uid !== currentUid && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setConfirmTransferUid(uid)}
                            disabled={transferring}
                            aria-label="그룹장 위임"
                            title="그룹장 위임"
                            className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-accent transition-colors"
                          >
                            <IconArrowsExchange size={16} stroke={1.75} />
                          </button>
                          <button
                            onClick={() => setConfirmRemoveUid(uid)}
                            aria-label="내보내기"
                            title="멤버 내보내기"
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
                          >
                            <IconUserMinus size={16} stroke={1.75} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 초대 코드 섹션 */}
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between text-[12px] font-medium text-text-secondary">
                    <span>초대 코드 (최대 10명 공동 편집)</span>
                    <span className="text-[11px] text-text-muted">{bag.memberIds.length}/10명</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[16px] font-bold tracking-widest rounded-lg bg-surface border border-border px-3 py-2 text-center text-foreground font-mono">
                      {bag.inviteCode}
                    </span>
                    <button
                      onClick={handleCopyInviteCode}
                      className="px-3 py-2 rounded-lg bg-accent text-white font-bold text-[12px] flex items-center gap-1 hover:brightness-105 active:scale-95 transition-all shadow-xs"
                      aria-label="초대 링크 복사"
                    >
                      {inviteCopied ? (
                        <>
                          <IconCheck size={14} stroke={2.5} />
                          <span>복사됨</span>
                        </>
                      ) : (
                        <>
                          <IconCopy size={14} stroke={2} />
                          <span>링크 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 관리 액션 버튼들 */}
                <div className="pt-1 flex flex-col gap-2 shrink-0">
                  {isOwner && (
                    <button
                      onClick={() => setConfirmRegenerate(true)}
                      disabled={regenerating}
                      className="w-full py-2 px-3 rounded-xl border border-border hover:bg-surface-2 text-[12px] font-medium text-text-secondary flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <IconRefresh size={14} stroke={1.75} />
                      <span>초대 코드 재발급 (기존 코드 무효화)</span>
                    </button>
                  )}

                  {bag.memberIds.length > 1 && !isOwner && (
                    <button
                      onClick={() => setConfirmLeave(true)}
                      disabled={leaving}
                      className="w-full py-2 px-3 rounded-xl border border-danger/30 bg-danger/5 hover:bg-danger/10 text-[12px] font-bold text-danger flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <IconLogout size={14} stroke={1.75} />
                      <span>{leaving ? "나가는 중..." : "이 가방에서 나가기"}</span>
                    </button>
                  )}

                  {isOwner && bag.memberIds.length === 1 && (
                    <p className="text-[11px] text-text-muted text-center py-1">
                      소유자만 남아있어요. 가방을 나가려면 가방을 삭제해주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Dialogs */}
          {confirmRemoveUid && (
            <ConfirmDialog
              title="이 사람을 내보낼까요?"
              message={`${
                bag.memberProfiles?.[confirmRemoveUid]?.nickname ?? "이 사람"
              }이(가) 더 이상 이 가방을 볼 수 없게 돼요.`}
              confirmLabel="내보내기"
              onCancel={() => setConfirmRemoveUid(null)}
              onConfirm={async () => {
                const target = confirmRemoveUid;
                setConfirmRemoveUid(null);
                if (onRemoveMember) {
                  await onRemoveMember(target);
                  show("멤버를 내보냈어요");
                }
              }}
            />
          )}

          {confirmRegenerate && (
            <ConfirmDialog
              title="초대 코드를 재발급할까요?"
              message="기존 코드로는 더 이상 참여할 수 없게 돼요."
              confirmLabel="재발급"
              onCancel={() => setConfirmRegenerate(false)}
              onConfirm={handleRegenerate}
            />
          )}

          {confirmLeave && (
            <ConfirmDialog
              title="이 가방에서 나갈까요?"
              message="다시 참여하려면 초대 코드가 필요해요."
              confirmLabel="나가기"
              onCancel={() => setConfirmLeave(false)}
              onConfirm={handleLeave}
            />
          )}

          {confirmTransferUid && (
            <ConfirmDialog
              title="그룹장을 넘길까요?"
              message={`${
                bag.memberProfiles?.[confirmTransferUid]?.nickname ?? "이 사람"
              }이(가) 새 그룹장이 되고, 나는 일반 그룹원이 돼요. 삭제/멤버 관리 권한도 함께 넘어가요.`}
              confirmLabel="위임"
              tone="accent"
              onCancel={() => setConfirmTransferUid(null)}
              onConfirm={handleTransfer}
            />
          )}

          {/* 카드 크게 보기 라이트박스 모달 (좌우 스와이프 및 전환 지원) */}
          {showEnlargedPreview && (
            <div
              className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 z-[99999] animate-in fade-in duration-150 select-none"
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
                    alt={`${bag.name} 공유 카드 확대`}
                    className="max-h-[76vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all duration-200"
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
          )}
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
