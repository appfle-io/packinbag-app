"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  vRotation: number;
  opacity: number;
}

const COLORS = [
  "#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93",
  "#FF924C", "#38B000", "#0077B6", "#FF006E", "#8338EC",
];

export default function Confetti({
  duration = 3000,
  onComplete,
}: {
  duration?: number;
  onComplete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const particles: Particle[] = Array.from({ length: 90 }, () => ({
      x: width * 0.5 + (Math.random() - 0.5) * 120,
      y: height * 0.4 + (Math.random() - 0.5) * 60,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      rotation: Math.random() * 360,
      vRotation: (Math.random() - 0.5) * 12,
      opacity: 1,
    }));

    const startTime = Date.now();

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // 중력
        p.vx *= 0.98; // 공기 저항
        p.rotation += p.vRotation;
        if (progress > 0.6) {
          p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (elapsed < duration) {
        animId = requestAnimationFrame(render);
      } else {
        onComplete?.();
      }
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
