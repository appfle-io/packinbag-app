"use client";

import { IconRefresh } from "@tabler/icons-react";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import LegacyAvatar from "@/components/Avatar";
import { IconButton, cx } from "@/components/v2/ui";

export const NICK_MAX = 12;
export const AUTH_FIELD = "h-12 w-full rounded-field border border-line bg-card px-4 text-body text-ink outline-none placeholder:text-faint focus:border-ink";

// 닉네임(추천 버튼) + 캐릭터 고르기. 가입 화면과 첫 프로필 설정이 같이 쓴다
export function NicknameAvatarFields({
  nickname,
  onNickname,
  avatarId,
  onAvatar,
}: {
  nickname: string;
  onNickname: (v: string) => void;
  avatarId: string;
  onAvatar: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-caption text-sub">닉네임 · 함께 쓰는 사람에게 보여요</span>
        <div className="flex items-center gap-2">
          <input
            value={nickname}
            onChange={(e) => onNickname(e.target.value.slice(0, NICK_MAX))}
            maxLength={NICK_MAX}
            aria-label="닉네임"
            placeholder={`닉네임 (${NICK_MAX}자 이내)`}
            className={AUTH_FIELD}
          />
          <IconButton label="닉네임 추천받기" variant="soft" onClick={() => onNickname(randomNickname())}>
            <IconRefresh size={20} stroke={1.75} />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-sub">캐릭터</span>
        <div role="radiogroup" aria-label="캐릭터" className="grid grid-cols-6 gap-2">
          {AVATAR_OPTIONS.map((a, i) => {
            const on = avatarId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`캐릭터 ${i + 1}`}
                onClick={() => onAvatar(a.id)}
                className={cx(
                  "flex aspect-square items-center justify-center rounded-full bg-transparent transition-shadow duration-160 ease-snappy",
                  on ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas" : "active:opacity-60",
                )}
              >
                <LegacyAvatar avatarId={a.id} size={36} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
