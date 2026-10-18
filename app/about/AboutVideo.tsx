"use client";

// /about 소개 영상. 브라우저 기본 컨트롤(controls)은 Safari가 재생 중 영상 전체를 회색으로 덮고
// 마우스가 위에 있으면 안 걷혀서(2026-10-18 사용자 제보), 직접 만든 가벼운 컨트롤을 쓴다:
// 멈춰 있으면 가운데 재생 버튼, 재생 중에는 영상을 누르면 멈춤, 아래 얇은 진행 막대(눌러서 이동), 전체 화면 버튼
import { useEffect, useRef, useState } from "react";
import styles from "./about.module.css";

const SRC = "/about/packinbag-intro.mp4";

export default function AboutVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setProgress(v.duration ? v.currentTime / v.duration : 0);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
      v.removeEventListener("timeupdate", onTime);
    };
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = ref.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * v.duration;
  };

  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  return (
    <div className={styles.videoBox}>
      <video ref={ref} className={styles.video} src={SRC} playsInline preload="metadata" onClick={toggle} aria-label="팩인백 소개 영상" />
      {!playing && (
        <button type="button" className={styles.videoPlay} onClick={toggle} aria-label="영상 재생">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          </svg>
        </button>
      )}
      <button type="button" className={styles.videoFull} onClick={fullscreen} aria-label="전체 화면">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
      <div className={styles.videoBar} onClick={seek} role="presentation">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
