"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { randomAvatarId } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import { Button } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { NICK_MAX, NicknameAvatarFields } from "./NicknameAvatarFields";

// Google·Apple·게스트로 처음 들어왔을 때 닉네임과 캐릭터를 고르는 화면. 구 GoogleProfileSetup 대체
export default function ProfileSetupV2() {
  const { completeProfile, logout, isGuest } = useAuth();
  const { show } = useToast();
  const [nickname, setNickname] = useState(randomNickname);
  const [avatarId, setAvatarId] = useState(randomAvatarId);
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const start = async () => {
    if (!nickname.trim() || busy) return;
    setBusy(true);
    try {
      await completeProfile(nickname.trim().slice(0, NICK_MAX), avatarId);
      show("반가워요! 프로필을 저장했어요");
    } catch {
      show("프로필을 저장하지 못했어요. 다시 해 주세요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pib-v2 pt-safe pb-safe-8 flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="m-0 text-heading font-bold text-ink">거의 다 왔어요</h1>
          <p className="m-0 text-caption text-sub">가방에서 보일 닉네임과 캐릭터를 골라 주세요</p>
        </div>
        <NicknameAvatarFields nickname={nickname} onNickname={setNickname} avatarId={avatarId} onAvatar={setAvatarId} />
        <div className="flex flex-col gap-2">
          <Button block disabled={busy || !nickname.trim()} onClick={start}>
            {busy ? "저장 중" : "시작하기"}
          </Button>
          <Button variant="text" size="sm" className="self-center text-sub" onClick={() => setConfirmOut(true)}>
            {isGuest ? "처음 화면으로" : "다른 계정으로 로그인"}
          </Button>
        </div>
      </div>
      <ConfirmSheet open={confirmOut} onClose={() => setConfirmOut(false)} title="로그아웃할까요?" confirmLabel="로그아웃" danger onConfirm={() => logout()} />
    </div>
  );
}
