"use client";

import { useEffect, useRef, useState } from "react";
import { Bag } from "@/lib/types";
import { IconDownload, IconShare, IconX, IconSparkles, IconCheck, IconPhoto } from "@tabler/icons-react";
import { useToast } from "@/components/Toast";

interface ShareCardModalProps {
  bag: Bag;
  onClose: () => void;
}

type CardTheme = "boarding" | "receipt" | "polaroid";

export default function ShareCardModal({ bag, onClose }: ShareCardModalProps) {
  const [theme, setTheme] = useState<CardTheme>("boarding");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const { show } = useToast();

  // 팩 및 짐 통계 계산
  const checklistPacks = bag.packs.filter((p) => p.kind !== "editor" && p.type !== "folder");
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

  // 1. 보딩패스 테마
  function drawBoardingPass(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // 배경
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0F172A");
    grad.addColorStop(1, "#1E293B");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 티켓 카드 본체
    const cardX = 50;
    const cardY = 80;
    const cardW = w - 100;
    const cardH = h - 160;

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();

    // 상단 헤더
    ctx.fillStyle = "#2563EB";
    roundRectTop(ctx, cardX, cardY, cardW, 140, 28);
    ctx.fill();

    // 헤더 텍스트
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("PACK IN BAG  |  BOARDING PASS", cardX + 36, cardY + 60);

    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("SMART PACKING CHECKLIST", cardX + 36, cardY + 95);

    // D-Day 뱃지
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX + cardW - 130, cardY + 45, 95, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ddayText, cardX + cardW - 82, cardY + 77);
    ctx.textAlign = "left";

    // 가방 이름 & 일정
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, sans-serif";
    const title = bag.name.length > 15 ? bag.name.slice(0, 15) + "..." : bag.name;
    ctx.fillText(title, cardX + 36, cardY + 215);

    ctx.fillStyle = "#64748B";
    ctx.font = "18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`출발일: ${bag.travelDate || "미정"}  |  멤버: ${bag.memberIds.length}명`, cardX + 36, cardY + 250);

    // 구분 절취선
    ctx.strokeStyle = "#E2E8F0";
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(cardX + 20, cardY + 290);
    ctx.lineTo(cardX + cardW - 20, cardY + 290);
    ctx.stroke();
    ctx.setLineDash([]);

    // 팩 & 짐 프리뷰 목록
    let currentY = cardY + 340;
    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("PACKING LIST", cardX + 36, currentY);
    currentY += 35;

    let itemCount = 0;
    for (const pack of checklistPacks) {
      if (itemCount >= 10) break;
      ctx.fillStyle = "#2563EB";
      ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(`[${pack.name}]`, cardX + 36, currentY);
      currentY += 26;

      for (const item of pack.items.slice(0, 3)) {
        if (itemCount >= 10) break;
        ctx.fillStyle = item.checked ? "#94A3B8" : "#334155";
        ctx.font = item.checked
          ? "16px -apple-system, BlinkMacSystemFont, sans-serif"
          : "500 16px -apple-system, BlinkMacSystemFont, sans-serif";
        const checkIcon = item.checked ? "[v] " : "[ ] ";
        const itemText = item.text.length > 20 ? item.text.slice(0, 20) + "..." : item.text;
        ctx.fillText(checkIcon + itemText, cardX + 50, currentY);
        currentY += 24;
        itemCount++;
      }
      currentY += 10;
    }

    // 하단 달성률 바
    const botY = cardY + cardH - 120;
    ctx.fillStyle = "#F8FAFC";
    roundRect(ctx, cardX + 30, botY, cardW - 60, 48, 12);
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("진행률", cardX + 48, botY + 30);

    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${progressRatio}% (${checkedItems}/${totalItems})`, cardX + cardW - 48, botY + 30);
    ctx.textAlign = "left";

    // 하단 바코드 그래픽
    drawBarcode(ctx, cardX + 36, cardY + cardH - 50, cardW - 72, 35);
  }

  // 2. 영수증 테마
  function drawReceipt(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#E2E8F0";
    ctx.fillRect(0, 0, w, h);

    const cardX = 70;
    const cardY = 60;
    const cardW = w - 140;
    const cardH = h - 120;

    ctx.fillStyle = "#FAFAF9";
    roundRect(ctx, cardX, cardY, cardW, cardH, 4);
    ctx.fill();

    ctx.fillStyle = "#1C1917";
    ctx.font = "bold 30px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("*** PACK IN BAG ***", w / 2, cardY + 60);

    ctx.font = "16px 'Courier New', monospace";
    ctx.fillText("OFFICIAL PACKING RECEIPT", w / 2, cardY + 95);
    ctx.fillText(`DATE: ${bag.travelDate || "2026.00.00"}   STATUS: ${ddayText}`, w / 2, cardY + 125);

    ctx.strokeStyle = "#44403C";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cardX + 24, cardY + 150);
    ctx.lineTo(cardX + cardW - 24, cardY + 150);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = "left";
    let currentY = cardY + 190;
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.fillText(`TRIP: ${bag.name}`, cardX + 30, currentY);
    currentY += 40;

    let totalCount = 0;
    for (const pack of checklistPacks) {
      if (totalCount >= 11) break;
      ctx.font = "bold 17px 'Courier New', monospace";
      ctx.fillStyle = "#0C0A09";
      ctx.fillText(`[${pack.name}]`, cardX + 30, currentY);
      currentY += 25;

      for (const item of pack.items.slice(0, 3)) {
        if (totalCount >= 11) break;
        ctx.font = "15px 'Courier New', monospace";
        ctx.fillStyle = item.checked ? "#78716C" : "#1C1917";
        const sign = item.checked ? "(V) " : "( ) ";
        const itemText = item.text.length > 20 ? item.text.slice(0, 20) + "..." : item.text;
        ctx.fillText(sign + itemText, cardX + 45, currentY);
        ctx.fillText("1 EA", cardX + cardW - 90, currentY);
        currentY += 24;
        totalCount++;
      }
      currentY += 10;
    }

    const botY = cardY + cardH - 150;
    ctx.strokeStyle = "#44403C";
    ctx.beginPath();
    ctx.moveTo(cardX + 24, botY);
    ctx.lineTo(cardX + cardW - 24, botY);
    ctx.stroke();

    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillStyle = "#1C1917";
    ctx.fillText("TOTAL ITEMS", cardX + 30, botY + 40);
    ctx.textAlign = "right";
    ctx.fillText(`${totalItems} EA`, cardX + cardW - 30, botY + 40);

    ctx.fillText("COMPLETED", cardX + 30, botY + 70);
    ctx.fillText(`${checkedItems} EA (${progressRatio}%)`, cardX + cardW - 30, botY + 70);
    ctx.textAlign = "center";

    drawBarcode(ctx, cardX + 40, cardY + cardH - 55, cardW - 80, 30);
    ctx.textAlign = "left";
  }

  // 3. 폴라로이드 테마
  function drawPolaroid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#18181B";
    ctx.fillRect(0, 0, w, h);

    const cardX = 60;
    const cardY = 60;
    const cardW = w - 120;
    const cardH = h - 120;

    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();

    const photoX = cardX + 30;
    const photoY = cardY + 30;
    const photoW = cardW - 60;
    const photoH = cardH - 240;

    const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    photoGrad.addColorStop(0, "#3B82F6");
    photoGrad.addColorStop(1, "#1D4ED8");
    ctx.fillStyle = photoGrad;
    roundRect(ctx, photoX, photoY, photoW, photoH, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(ddayText, photoX + 30, photoY + 50);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
    const title = bag.name.length > 14 ? bag.name.slice(0, 14) + "..." : bag.name;
    ctx.fillText(title, photoX + 30, photoY + 100);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`일정: ${bag.travelDate || "미정"}  |  달성률: ${progressRatio}%`, photoX + 30, photoY + 135);

    let currentY = photoY + 180;
    let count = 0;
    for (const pack of checklistPacks) {
      if (count >= 7) break;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(`* ${pack.name}`, photoX + 30, currentY);
      currentY += 26;

      for (const item of pack.items.slice(0, 2)) {
        if (count >= 7) break;
        ctx.fillStyle = item.checked ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.95)";
        ctx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
        const mark = item.checked ? "[v] " : "[ ] ";
        const itemText = item.text.length > 18 ? item.text.slice(0, 18) + "..." : item.text;
        ctx.fillText(mark + itemText, photoX + 45, currentY);
        currentY += 24;
        count++;
      }
      currentY += 8;
    }

    ctx.fillStyle = "#18181B";
    ctx.font = "italic bold 28px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(bag.name, w / 2, cardY + cardH - 120);

    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#71717A";
    ctx.fillText(`PACK IN BAG  |  ${checkedItems}/${totalItems} PACKED (${progressRatio}%)`, w / 2, cardY + cardH - 70);
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

  // 공유 또는 클립보드 복사 (모바일/데스크톱 대응)
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // 모바일 기기(터치 지원 및 모바일 브라우저)에서 파일 공유가 가능한 경우
        const isMobile = typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const file = new File([blob], `${bag.name}_card.png`, { type: "image/png" });

        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: bag.name,
              text: `${bag.name} (달성률 ${progressRatio}%)`,
              files: [file],
            });
            return;
          } catch {
            // 사용자가 공유 창을 닫은 경우 무시
            return;
          }
        }

        // 데스크톱 / PC 환경: 클립보드에 이미지 복사 + 다운로드
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
        className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div className="flex items-center gap-1.5">
            <IconPhoto size={18} className="text-accent" />
            <h3 className="text-[15px] font-bold text-foreground">여행 공유 카드</h3>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 -mr-1.5 rounded-full hover:bg-surface-2">
            <IconX size={18} />
          </button>
        </div>

        {/* 테마 선택 탭 */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-2 rounded-xl mb-3 text-[12px] font-medium">
          <button
            onClick={() => setTheme("boarding")}
            className={`py-1.5 rounded-lg transition-all ${
              theme === "boarding" ? "bg-surface text-accent font-bold shadow-xs" : "text-text-secondary"
            }`}
          >
            보딩패스
          </button>
          <button
            onClick={() => setTheme("receipt")}
            className={`py-1.5 rounded-lg transition-all ${
              theme === "receipt" ? "bg-surface text-accent font-bold shadow-xs" : "text-text-secondary"
            }`}
          >
            영수증
          </button>
          <button
            onClick={() => setTheme("polaroid")}
            className={`py-1.5 rounded-lg transition-all ${
              theme === "polaroid" ? "bg-surface text-accent font-bold shadow-xs" : "text-text-secondary"
            }`}
          >
            폴라로이드
          </button>
        </div>

        {/* 캔버스 프리뷰 */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-2 bg-surface-2 rounded-xl mb-4 border border-border min-h-[300px]">
          <canvas
            ref={canvasRef}
            className="w-full max-h-[360px] object-contain rounded-lg shadow-sm"
          />
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
