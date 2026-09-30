"use client";

import { useCallback, useMemo } from "react";
import type { Bag } from "@/lib/types";
import type { BagDocument } from "./useBagDocument";

export interface BagMember {
  uid: string;
  nickname: string;
  avatarId: string;
  isOwner: boolean;
  isMe: boolean;
}

export interface BagMembersOptions {
  doc: BagDocument;
  currentUid: string;
  myNickname: string;
  myAvatarId: string;
  onLeaveBag: (bagId: string) => Promise<void>;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
  onTransferOwnership: (bagId: string, targetUid: string) => Promise<void>;
}

// 멤버 목록·초대·내보내기·위임·나가기. 실제 서버 호출은 AppShell이 넘겨주는 콜백이 하고
// (구 BagEditorScreen과 동일), 여기서는 성공 후 로컬 가방 상태를 맞춰준다.
export function useBagMembers({
  doc,
  currentUid,
  myNickname,
  myAvatarId,
  onLeaveBag,
  onRemoveMember,
  onRegenerateInviteCode,
  onTransferOwnership,
}: BagMembersOptions) {
  const { bag, guard, applyServerChange } = doc;

  const members: BagMember[] = useMemo(() => {
    const list = bag.memberIds.map((uid) => {
      const profile = bag.memberProfiles?.[uid];
      const isMe = uid === currentUid;
      return {
        uid,
        nickname: isMe ? myNickname : profile?.nickname ?? "멤버",
        avatarId: isMe ? myAvatarId : profile?.avatarId ?? "",
        isOwner: uid === bag.ownerId,
        isMe,
      };
    });
    // 만든 사람 → 나 → 나머지
    return list.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.isMe) - Number(a.isMe));
  }, [bag.memberIds, bag.memberProfiles, bag.ownerId, currentUid, myNickname, myAvatarId]);

  const isOwner = bag.ownerId === currentUid;
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/?invite=${bag.inviteCode}` : "";

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const copyInviteLink = useCallback(() => copy(inviteLink), [copy, inviteLink]);
  const copyInviteCode = useCallback(() => copy(bag.inviteCode), [copy, bag.inviteCode]);

  const removeMember = useCallback(
    async (memberUid: string) => {
      if (guard()) return;
      await onRemoveMember(bag.id, memberUid);
      applyServerChange((prev) => {
        const memberProfiles = { ...prev.memberProfiles };
        delete memberProfiles[memberUid];
        return { ...prev, memberIds: prev.memberIds.filter((id) => id !== memberUid), memberProfiles };
      });
    },
    [guard, onRemoveMember, bag.id, applyServerChange],
  );

  const regenerateInviteCode = useCallback(async () => {
    if (guard()) return;
    const code = await onRegenerateInviteCode(bag);
    applyServerChange((prev) => ({ ...prev, inviteCode: code }));
  }, [guard, onRegenerateInviteCode, bag, applyServerChange]);

  const transferOwnership = useCallback(
    async (targetUid: string) => {
      if (guard()) return;
      await onTransferOwnership(bag.id, targetUid);
      applyServerChange((prev) => ({ ...prev, ownerId: targetUid }));
    },
    [guard, onTransferOwnership, bag.id, applyServerChange],
  );

  const leave = useCallback(async () => {
    if (guard()) return;
    await onLeaveBag(bag.id);
  }, [guard, onLeaveBag, bag.id]);

  return { members, isOwner, inviteLink, copyInviteLink, copyInviteCode, removeMember, regenerateInviteCode, transferOwnership, leave };
}