"use client";

import BackpackLogo from "@/components/BackpackLogo";

export default function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: "var(--background)",
        opacity: visible ? 1 : 0,
        transition: "opacity 380ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="pib-splash-logo">
        <BackpackLogo size={104} />
      </div>
    </div>
  );
}
