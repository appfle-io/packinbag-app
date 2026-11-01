"use client";

export default function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: "var(--v2-canvas)",
        opacity: visible ? 1 : 0,
        transition: "opacity 380ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="pib-splash-logo">
        {/* 로고는 강조색을 따른다(11/1). head 스크립트가 넣은 data-accent를 CSS가 보므로 서버 HTML과 어긋나지 않고, 고른 색 그림만 받는다 */}
        <div role="img" aria-label="팩인백" className="pib-splash-mark" />
      </div>
    </div>
  );
}
