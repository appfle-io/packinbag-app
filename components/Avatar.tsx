"use client";

import { useState } from "react";
import { getAvatar } from "@/lib/avatars";

export default function Avatar({
  avatarId,
  photoUrl,
  size = 32,
  ring = false,
  className = "",
}: {
  avatarId: string | null | undefined;
  photoUrl?: string | null; // 프로필 사진(프리미엄). 못 불러오면 캐릭터
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const avatar = getAvatar(avatarId);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (photoUrl && failedUrl !== photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 이미지(외부 URL), next/image 최적화 대상 아님
      <img
        src={photoUrl}
        alt=""
        onError={() => setFailedUrl(photoUrl)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size, boxShadow: ring ? "0 0 0 2px var(--v2-canvas)" : undefined }}
      />
    );
  }
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${avatar.bg}, ${avatar.bg2})`,
        fontSize: size * 0.55,
        lineHeight: 1,
        boxShadow: ring ? "0 0 0 2px var(--v2-canvas)" : undefined,
      }}
    >
      {avatar.emoji}
    </div>
  );
}
