"use client";

import { useEffect, useRef, useState } from "react";
import { Bag, Pack } from "@/lib/types";
import {
  IconDownload,
  IconShare,
  IconX,
  IconCheck,
  IconPhoto,
  IconLink,
} from "@tabler/icons-react";
import { useToast } from "@/components/Toast";
import { collectEditorDocPreviewLines } from "@/lib/editorDocPreview";

interface ShareCardModalProps {
  bag: Bag;
  onClose: () => void;
}

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

export default function ShareCardModal({ bag, onClose }: ShareCardModalProps) {
  const [theme, setTheme] = useState<CardTheme>("boarding");
  const [includeInvite, setIncludeInvite] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [guestLinkCopied, setGuestLinkCopied] = useState(false);
  const { show } = useToast();

  // 모든 팩 (체크리스트 + 메모팩 순서 유지)
  const displayPacks = bag.packs.filter((p) => p.type !== "folder");
  const checklistPacks = displayPacks.filter((p) => p.kind !== "editor");

  let totalItems = 0;
  let checkedItems = 0;
  checklistPacks.forEach((p) => {
    p.items.forEach((i) => {
      totalItems++;
      if (i.checked) checkedItems++;
    });
  });
  const progressRatio = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // D-Day 계산
  let ddayText = "D-DAY";
  if (bag.travelDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(bag.travelDate);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) ddayText = "D-DAY";
    else if (diffDays > 0) ddayText = `D-${diffDays}`;
    else ddayText = `D+${Math.abs(diffDays)}`;
  }

  // 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 800;
    const height = 1200;
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
  }, [theme, bag, progressRatio, ddayText, checkedItems, totalItems]);

  // 1. 보딩패스 테마 (체크팩과 메모팩이 2단 컬럼 안에서 순서대로 함께 노출)
  function drawBoardingPass(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // 배경
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0F172A");
    grad.addColorStop(1, "#1E293B");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 티켓 카드 본체
    const cardX = 50;
    const cardY = 50;
    const cardW = w - 100;
    const cardH = h - 100;

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();

    // 상단 헤더
    ctx.fillStyle = "#2563EB";
    roundRectTop(ctx, cardX, cardY, cardW, 125, 28);
    ctx.fill();

    // 헤더 텍스트
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("PACK IN BAG  |  BOARDING PASS", cardX + 36, cardY + 52);

    ctx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText("SMART TRAVEL PACKING LIST", cardX + 36, cardY + 84);

    // D-Day 뱃지
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX + cardW - 130, cardY + 38, 95, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ddayText, cardX + cardW - 82, cardY + 70);
    ctx.textAlign = "left";

    // 가방 이름 & 일정
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
    const title = bag.name.length > 16 ? bag.name.slice(0, 16) + "..." : bag.name;
    ctx.fillText(title, cardX + 36, cardY + 185);

    ctx.fillStyle = "#64748B";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(
      `출발일: ${bag.travelDate || "미정"}  |  총 ${totalItems}개 짐  |  ${bag.memberIds.length}명`,
      cardX + 36,
      cardY + 218
    );

    // 구분 절취선
    ctx.strokeStyle = "#E2E8F0";
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(cardX + 20, cardY + 245);
    ctx.lineTo(cardX + cardW - 20, cardY + 245);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2단(좌/우) 컬럼 렌더링
    const colStartY = cardY + 280;
    const botLimitY = cardY + cardH - 125;

    const col1X = cardX + 36;
    const col2X = cardX + 365;

    let curCol = 1;
    let curX = col1X;
    let curY = colStartY;

    for (const pack of displayPacks) {
      if (curY + 45 > botLimitY) {
        if (curCol === 1) {
          curCol = 2;
          curX = col2X;
          curY = colStartY;
        } else {
          break;
        }
      }

      const packTitle = pack.name.length > 16 ? pack.name.slice(0, 16) + "..." : pack.name;

      if (pack.kind === "editor") {
        // 메모팩 인라인 렌더링
        ctx.fillStyle = "#D97706"; // Amber 색상으로 메모팩 구분
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`[📝 ${packTitle}]`, curX, curY);
        curY += 23;

        const memoLines = getMemoPreviewLines(pack, 5);
        for (const line of memoLines) {
          if (curY + 20 > botLimitY) {
            if (curCol === 1) {
              curCol = 2;
              curX = col2X;
              curY = colStartY;
              ctx.fillStyle = "#D97706";
              ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
              ctx.fillText(`[📝 ${packTitle}]`, curX, curY);
              curY += 23;
            } else {
              break;
            }
          }
          ctx.fillStyle = "#4B5563";
          ctx.font = "500 13px -apple-system, BlinkMacSystemFont, sans-serif";
          const itemText = line.length > 20 ? line.slice(0, 20) + "..." : line;
          ctx.fillText("• " + itemText, curX + 8, curY);
          curY += 20;
        }
        curY += 6;
      } else {
        // 체크리스트 팩 렌더링
        ctx.fillStyle = "#2563EB";
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`[${packTitle}]`, curX, curY);
        curY += 23;

        for (const item of pack.items) {
          if (curY + 20 > botLimitY) {
            if (curCol === 1) {
              curCol = 2;
              curX = col2X;
              curY = colStartY;
              ctx.fillStyle = "#2563EB";
              ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
              ctx.fillText(`[${packTitle}]`, curX, curY);
              curY += 23;
            } else {
              break;
            }
          }

          ctx.fillStyle = item.checked ? "#94A3B8" : "#334155";
          ctx.font = item.checked
            ? "14px -apple-system, BlinkMacSystemFont, sans-serif"
            : "500 14px -apple-system, BlinkMacSystemFont, sans-serif";
          const checkIcon = item.checked ? "[v] " : "[ ] ";
          const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
          ctx.fillText(checkIcon + itemText, curX + 8, curY);
          curY += 20;
        }
        curY += 6;
      }
      if (curCol === 2 && curY > botLimitY) break;
    }

    // 하단 달성률 바
    const botY = cardY + cardH - 110;
    ctx.fillStyle = "#F8FAFC";
    roundRect(ctx, cardX + 30, botY, cardW - 60, 44, 12);
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("진행률", cardX + 48, botY + 28);

    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${progressRatio}% (${checkedItems}/${totalItems})`, cardX + cardW - 48, botY + 28);
    ctx.textAlign = "left";

    // 하단 바코드 그래픽
    drawBarcode(ctx, cardX + 36, cardY + cardH - 52, cardW - 72, 36);
  }

  // 2. 영수증 테마 (체크팩과 메모팩이 영수증 흐름대로 순서대로 출력)
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
          const text = line.length > 22 ? line.slice(0, 22) + "..." : line;
          ctx.fillText("> " + text, cardX + 42, currentY);
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

    // 하단 합계 및 정렬 (x좌표 안전 정렬: cardX + 30)
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
    ctx.fillText("COMPLETED", cardX + 30, botY + 60);
    ctx.textAlign = "right";
    ctx.fillText(`${checkedItems} EA (${progressRatio}%)`, cardX + cardW - 30, botY + 60);

    // 바코드
    drawBarcode(ctx, cardX + 40, cardY + cardH - 52, cardW - 80, 32);
    ctx.textAlign = "left";
  }

  // 3. 폴라로이드 테마 (체크팩과 메모팩이 2단 컬럼 안에서 자연스럽게 공존)
  function drawPolaroid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, w, h);

    const cardX = 55;
    const cardY = 45;
    const cardW = w - 110;
    const cardH = h - 90;

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();

    const photoX = cardX + 26;
    const photoY = cardY + 26;
    const photoW = cardW - 52;
    const photoH = cardH - 200;

    const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    photoGrad.addColorStop(0, "#2563EB");
    photoGrad.addColorStop(1, "#1E3A8A");
    ctx.fillStyle = photoGrad;
    roundRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(ddayText, photoX + 28, photoY + 42);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 30px -apple-system, BlinkMacSystemFont, sans-serif";
    const title = bag.name.length > 15 ? bag.name.slice(0, 15) + "..." : bag.name;
    ctx.fillText(title, photoX + 28, photoY + 82);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(
      `일정: ${bag.travelDate || "미정"}  |  달성률: ${progressRatio}% (${checkedItems}/${totalItems})`,
      photoX + 28,
      photoY + 112
    );

    // 2단 컬럼으로 팩 렌더링
    const colStartY = photoY + 155;
    const botLimitY = photoY + photoH - 20;

    const col1X = photoX + 28;
    const col2X = photoX + 340;

    let curCol = 1;
    let curX = col1X;
    let curY = colStartY;

    for (const pack of displayPacks) {
      if (curY + 35 > botLimitY) {
        if (curCol === 1) {
          curCol = 2;
          curX = col2X;
          curY = colStartY;
        } else {
          break;
        }
      }

      const packTitle = pack.name.length > 15 ? pack.name.slice(0, 15) + "..." : pack.name;

      if (pack.kind === "editor") {
        ctx.fillStyle = "#FEF08A"; // 연노랑 메모 타이틀
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`* 📝 ${packTitle}`, curX, curY);
        curY += 21;

        const memoLines = getMemoPreviewLines(pack, 4);
        for (const line of memoLines) {
          if (curY + 20 > botLimitY) {
            if (curCol === 1) {
              curCol = 2;
              curX = col2X;
              curY = colStartY;
              ctx.fillStyle = "#FEF08A";
              ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
              ctx.fillText(`* 📝 ${packTitle}`, curX, curY);
              curY += 21;
            } else {
              break;
            }
          }

          ctx.fillStyle = "rgba(254, 240, 138, 0.9)";
          ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
          const text = line.length > 18 ? line.slice(0, 18) + "..." : line;
          ctx.fillText("~ " + text, curX + 10, curY);
          curY += 19;
        }
        curY += 6;
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`* ${packTitle}`, curX, curY);
        curY += 21;

        for (const item of pack.items) {
          if (curY + 20 > botLimitY) {
            if (curCol === 1) {
              curCol = 2;
              curX = col2X;
              curY = colStartY;
              ctx.fillStyle = "#FFFFFF";
              ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
              ctx.fillText(`* ${packTitle}`, curX, curY);
              curY += 21;
            } else {
              break;
            }
          }

          ctx.fillStyle = item.checked ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.95)";
          ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
          const mark = item.checked ? "[v] " : "[ ] ";
          const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
          ctx.fillText(mark + itemText, curX + 10, curY);
          curY += 19;
        }
        curY += 6;
      }
      if (curCol === 2 && curY > botLimitY) break;
    }

    // 하단 폴라로이드 서명 영역
    ctx.fillStyle = "#18181B";
    ctx.font = "italic bold 26px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(bag.name, w / 2, cardY + cardH - 95);

    ctx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#71717A";
    ctx.fillText(
      `PACK IN BAG  |  ${checkedItems}/${totalItems} PACKED (${progressRatio}%)`,
      w / 2,
      cardY + cardH - 55
    );
    ctx.textAlign = "left";
  }

  // 바코드 드로잉 헬퍼
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

  // 둥근 모서리 헬퍼
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${bag.name.replace(/\s+/g, "_")}_카드.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    show("이미지를 저장했어요");
  };

  // 보기 전용 링크 복사
  const handleCopyGuestLink = async () => {
    const token = bag.publicShareToken || bag.inviteCode;
    const url = `${window.location.origin}/v/${token}${includeInvite ? `?code=${bag.inviteCode}` : ""}`;
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

  // 모바일 공유하기 / 데스크톱 복사
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

        const token = bag.publicShareToken || bag.inviteCode;
        const guestUrl = `${window.location.origin}/v/${token}${
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

        // 데스크톱 / PC 환경
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 shadow-2xl flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div className="flex items-center gap-1.5">
            <IconPhoto size={18} className="text-accent" />
            <h3 className="text-[15px] font-bold text-foreground">여행 공유 카드</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 -mr-1.5 rounded-full hover:bg-surface-2"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* 테마 선택 탭 */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-2 rounded-xl mb-3 text-[12px] font-medium">
          <button
            onClick={() => setTheme("boarding")}
            className={`py-1.5 rounded-lg transition-all ${
              theme === "boarding"
                ? "bg-surface text-accent font-bold shadow-xs"
                : "text-text-secondary"
            }`}
          >
            보딩패스
          </button>
          <button
            onClick={() => setTheme("receipt")}
            className={`py-1.5 rounded-lg transition-all ${
              theme === "receipt"
                ? "bg-surface text-accent font-bold shadow-xs"
                : "text-text-secondary"
            }`}
          >
            영수증
          </button>
          <button
            onClick={() => setTheme("polaroid")}
            className={`py-1.5 rounded-lg transition-all ${
              theme === "polaroid"
                ? "bg-surface text-accent font-bold shadow-xs"
                : "text-text-secondary"
            }`}
          >
            폴라로이드
          </button>
        </div>

        {/* 캔버스 프리뷰 */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-2 bg-surface-2 rounded-xl mb-3 border border-border min-h-[260px]">
          <canvas
            ref={canvasRef}
            className="w-full max-h-[320px] object-contain rounded-lg shadow-sm"
          />
        </div>

        {/* 초대코드 포함 옵션 체크박스 */}
        <div className="mb-2.5 px-1 flex items-center">
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

        {/* 보기 전용 웹 링크 복사 섹션 */}
        <div className="mb-3 p-2.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between gap-2">
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
        <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
}
