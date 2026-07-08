"use client";

import { getAvatar } from "@/lib/avatars";

export default function Avatar({
  avatarId,
  size = 32,
  ring = false,
  className = "",
}: {
  avatarId: string | null | undefined;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const avatar = getAvatar(avatarId);
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${avatar.bg}, ${avatar.bg2})`,
        fontSize: size * 0.55,
        lineHeight: 1,
        boxShadow: ring ? "0 0 0 2px var(--background)" : undefined,
      }}
    >
      {avatar.emoji}
    </div>
  );
}
