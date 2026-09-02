"use client";

import Portal from "@/components/Portal";

import { useState } from "react";
import {
  IconX,
  IconCopy,
  IconCheck,
  IconLogout,
  IconRefresh,
  IconUserMinus,
  IconCrown,
  IconArrowsExchange,
  IconLink,
  IconPhoto,
} from "@tabler/icons-react";
import { Bag } from "@/lib/types";
import Avatar from "@/components/Avatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { OverlayLayerProvider, useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { ensureBagPublicShareToken } from "@/lib/bagsService";

export default function GroupMembersModal({
  bag,
  currentUid,
  onClose,
  onLeave,
  onRemoveMember,
  onRegenerateCode,
  onTransferOwnership,
  onOpenShareCard,
}: {
  bag: Bag;
  currentUid: string;
  onClose: () => void;
  onLeave: () => Promise<void> | void;
  onRemoveMember: (uid: string) => Promise<void> | void;
  onRegenerateCode: () => Promise<void> | void;
  onTransferOwnership: (targetUid: string) => Promise<void> | void;
  onOpenShareCard?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmTransferUid, setConfirmTransferUid] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { show } = useToast();
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const isOwner = bag.ownerId === currentUid;
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/?invite=${bag.inviteCode}`
      : "";

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    show("초대 코드를 복사했어요");
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = async () => {
    setConfirmRegenerate(false);
    setRegenerating(true);
    try {
      await onRegenerateCode();
      show("초대 코드를 새로 발급했어요");
    } finally {
      setRegenerating(false);
    }
  };

  const handleLeave = async () => {
    setConfirmLeave(false);
    setLeaving(true);
    try {
      await onLeave();
    } catch {
      // 실패 토스트는 상위(AppShell)에서 이미 표시됨
      setLeaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!confirmTransferUid) return;
    const targetUid = confirmTransferUid;
    setConfirmTransferUid(null);
    setTransferring(true);
    try {
      await onTransferOwnership(targetUid);
      show("그룹장을 넘겼어요");
    } catch {
      // 실패 토스트는 상위(AppShell)에서 이미 표시됨
    } finally {
      setTransferring(false);
    }
  };

  const members = bag.memberIds.map((uid) => ({
    uid,
    profile: bag.memberProfiles?.[uid],
  }));

  return (
    <Portal>
      <OverlayLayerProvider value={resolvedZIndex}>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/40 p-6"
        style={{ zIndex: resolvedZIndex }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-xl bg-surface p-4 flex flex-col gap-3 max-h-[80vh]"
        >
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[15px] font-medium">
              그룹원 · {bag.memberIds.length}/10명
            </p>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} />
            </button>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto">
            {members.map(({ uid, profile }) => (
              <div key={uid} className="flex items-center gap-2.5 py-1.5">
                <Avatar avatarId={profile?.avatarId} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate flex items-center gap-1">
                    {profile?.nickname ?? "알 수 없음"}
                    {uid === currentUid && (
                      <span className="text-text-muted font-normal">(나)</span>
                    )}
                    {uid === bag.ownerId && (
                      <IconCrown
                        size={13}
                        stroke={1.75}
                        color="var(--accent)"
                      />
                    )}
                  </p>
                </div>
                {isOwner && uid !== currentUid && (
                  <button
                    onClick={() => setConfirmTransferUid(uid)}
                    disabled={transferring}
                    aria-label="그룹장 위임"
                    className="p-1.5 disabled:opacity-40"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <IconArrowsExchange size={16} stroke={1.75} />
                  </button>
                )}
                {isOwner && uid !== currentUid && (
                  <button
                    onClick={() => setConfirmRemoveUid(uid)}
                    aria-label="내보내기"
                    className="p-1.5"
                    style={{ color: "var(--danger)" }}
                  >
                    <IconUserMinus size={16} stroke={1.75} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-[12px] text-text-secondary shrink-0">
            코드를 공유하면 최대 10명까지 이 가방을 함께 실시간으로 편집할 수
            있어요.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex-1 text-[15px] tracking-widest rounded-lg bg-surface-2 px-3 py-2 text-center">
              {bag.inviteCode}
            </span>
            <button
              onClick={handleCopyInvite}
              className="rounded-lg border border-border px-3 py-2"
              aria-label="초대 링크 복사"
            >
              {copied ? (
                <IconCheck size={15} stroke={1.75} color="var(--accent)" />
              ) : (
                <IconCopy size={15} stroke={1.75} />
              )}
            </button>
          </div>

          <div className="flex gap-2 shrink-0 pt-1">
            <button
              onClick={async () => {
                let token = bag.publicShareToken;
                if (!token) {
                  token = await ensureBagPublicShareToken(bag.id);
                }
                const guestUrl = `${window.location.origin}/v/${token || bag.inviteCode}`;
                await navigator.clipboard.writeText(guestUrl);
                show("보기 전용 웹 링크를 복사했어요");
              }}
              className="flex-1 py-2 px-2.5 rounded-lg border border-border text-[12px] font-medium hover:bg-surface-2 flex items-center justify-center gap-1.5 transition-colors"
            >
              <IconLink size={14} stroke={1.75} />
              보기전용 링크 복사
            </button>
            {onOpenShareCard && (
              <button
                onClick={() => {
                  onClose();
                  onOpenShareCard();
                }}
                className="py-2 px-3 rounded-lg bg-accent-soft text-accent-strong hover:bg-accent/15 border border-accent/20 text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <IconPhoto size={14} stroke={1.75} />
                여행 카드
              </button>
            )}
          </div>

          {isOwner && (
            <button
              onClick={() => setConfirmRegenerate(true)}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-[12px] shrink-0 disabled:opacity-50"
              style={{ color: "var(--text-secondary)" }}
            >
              <IconRefresh size={14} stroke={1.75} />
              초대 코드 재발급 (기존 코드는 무효화돼요)
            </button>
          )}

          {bag.memberIds.length > 1 && !isOwner && (
            <button
              onClick={() => setConfirmLeave(true)}
              disabled={leaving}
              className="flex items-center gap-1.5 text-[12px] shrink-0 disabled:opacity-50"
              style={{ color: "var(--danger)" }}
            >
              <IconLogout size={14} stroke={1.75} />
              {leaving ? "나가는 중..." : "이 가방에서 나가기"}
            </button>
          )}

          {isOwner && bag.memberIds.length === 1 && (
            <p className="text-[11px] text-text-muted shrink-0">
              소유자만 남아있어요. 가방을 나가려면 삭제해주세요.
            </p>
          )}
        </div>

        {confirmRemoveUid && (
          <ConfirmDialog
            title="이 사람을 내보낼까요?"
            message={`${
              bag.memberProfiles?.[confirmRemoveUid]?.nickname ?? "이 사람"
            }이(가) 더 이상 이 가방을 볼 수 없게 돼요.`}
            confirmLabel="내보내기"
            onCancel={() => setConfirmRemoveUid(null)}
            onConfirm={async () => {
              const target = confirmRemoveUid;
              setConfirmRemoveUid(null);
              await onRemoveMember(target);
              show("멤버를 내보냈어요");
            }}
          />
        )}

        {confirmRegenerate && (
          <ConfirmDialog
            title="초대 코드를 재발급할까요?"
            message="기존 코드로는 더 이상 참여할 수 없게 돼요."
            confirmLabel="재발급"
            onCancel={() => setConfirmRegenerate(false)}
            onConfirm={handleRegenerate}
          />
        )}

        {confirmLeave && (
          <ConfirmDialog
            title="이 가방에서 나갈까요?"
            message="다시 참여하려면 초대 코드가 필요해요."
            confirmLabel="나가기"
            onCancel={() => setConfirmLeave(false)}
            onConfirm={handleLeave}
          />
        )}

        {confirmTransferUid && (
          <ConfirmDialog
            title="그룹장을 넘길까요?"
            message={`${
              bag.memberProfiles?.[confirmTransferUid]?.nickname ?? "이 사람"
            }이(가) 새 그룹장이 되고, 나는 일반 그룹원이 돼요. 삭제/멤버 관리 권한도 함께 넘어가요.`}
            confirmLabel="위임"
            tone="accent"
            onCancel={() => setConfirmTransferUid(null)}
            onConfirm={handleTransfer}
          />
        )}
      </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
