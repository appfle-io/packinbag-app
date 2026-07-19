"use client";

import { useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { AVATAR_OPTIONS, randomAvatarId } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import Avatar from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

// 구글 로그인은 비밀번호/닉네임 입력 단계가 없기 때문에, 최초 1회 로그인 직후
// 여기서 이메일 가입과 동일하게 닉네임 + 아바타를 고르게 한다.
export default function GoogleProfileSetup() {
  const { completeProfile, logout } = useAuth();
  const [nickname, setNickname] = useState(randomNickname);
  const [avatarId, setAvatarId] = useState(randomAvatarId);
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { show } = useToast();

  const handleConfirm = async () => {
    if (!nickname.trim()) return;
    setBusy(true);
    try {
      await completeProfile(nickname.trim().slice(0, 12), avatarId);
      show("환영해요! 프로필을 저장했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs flex flex-col gap-4">
        <div className="text-center mb-1">
          <p className="text-[18px] font-medium">거의 다 왔어요</p>
          <p className="text-[12px] text-text-secondary mt-1">
            같이 쓰는 가방에서 보여질 닉네임과 캐릭터를 골라주세요
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 12))}
            placeholder="닉네임 (12자 이내)"
            maxLength={12}
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />
          <button
            type="button"
            onClick={() => setNickname(randomNickname())}
            aria-label="닉네임 새로 추천받기"
            className="rounded-lg border border-border p-2 shrink-0"
          >
            <IconRefresh size={15} stroke={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {AVATAR_OPTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAvatarId(a.id)}
              className="rounded-full p-0.5"
              style={{
                boxShadow: avatarId === a.id ? "0 0 0 2px var(--accent)" : "none",
              }}
            >
              <Avatar avatarId={a.id} size={32} />
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={busy || !nickname.trim()}
          className="rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          시작하기
        </button>

        <button onClick={() => setConfirmLogout(true)} className="text-[12px] text-text-secondary text-center">
          다른 계정으로 로그인
        </button>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title="로그아웃 하시겠어요?"
          confirmLabel="로그아웃"
          tone="danger"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
