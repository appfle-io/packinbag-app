"use client";

import { useState } from "react";
import { IconDots, IconLink, IconCheck } from "@tabler/icons-react";
import type { BagMember } from "@/hooks/bag";
import {
  Avatar,
  Button,
  IconButton,
  SectionHeader,
  Sheet,
} from "@/components/v2/ui";
import { useToast } from "@/components/Toast";
import { MAX_BAG_MEMBERS } from "@/lib/premiumLimits";
import { ConfirmSheet } from "./ConfirmSheet";

// 함께 챙기는 사람: 멤버 목록, 초대 링크/코드, (만든 사람) 내보내기·위임·코드 재발급, (멤버) 나가기.
export function MembersSheet({
  open,
  onClose,
  members,
  onlineUids,
  isOwner,
  inviteCode,
  onCopyLink,
  onCopyCode,
  onRegenerateCode,
  onRemove,
  onTransfer,
  onLeave,
  offline,
  memberLimit,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  members: BagMember[];
  onlineUids: Set<string>;
  isOwner: boolean;
  inviteCode: string;
  onCopyLink: () => Promise<boolean>;
  onCopyCode: () => Promise<boolean>;
  onRegenerateCode: () => Promise<void>;
  onRemove: (uid: string) => Promise<void>;
  onTransfer: (uid: string) => Promise<void>;
  onLeave: () => Promise<void>;
  // 오프라인(포터블)에서는 초대가 동작하지 않는다
  offline?: boolean;
  // 이 가방을 함께 쓸 수 있는 최대 인원. 만든 사람(나)일 때만 알 수 있다(내 프리미엄 여부 기준).
  // 멤버는 만든 사람의 이용권을 모르므로 undefined - 인원 안내를 보여주지 않는다.
  memberLimit?: number;
  // 무료 인원이 다 찼을 때 프리미엄 안내
  onUpgrade?: () => void;
}) {
  const { show } = useToast();
  const [linkCopied, setLinkCopied] = useState(false);
  const [manage, setManage] = useState<BagMember | null>(null);
  const [confirm, setConfirm] = useState<null | {
    kind: "remove" | "transfer" | "leave" | "regen";
    member?: BagMember;
  }>(null);

  // 인원이 다 찼으면 새로 초대해도 들어올 수 없다(서버가 막음) - 링크·코드 대신 안내를 보여준다
  const limit = memberLimit ?? MAX_BAG_MEMBERS;
  const full = memberLimit !== undefined && members.length >= limit;
  // 무료 한도라서 찬 것인지(프리미엄이면 더 늘어남)
  const upgradable = full && limit < MAX_BAG_MEMBERS;
  const fullMessage = !full
    ? ""
    : !upgradable
      ? `가방 인원이 가득 찼어요 (최대 ${limit}명).`
      : members.length > limit
        ? `무료로는 ${limit}명까지 함께 쓸 수 있어요. 지금 멤버는 그대로지만 새로 초대할 수는 없어요.`
        : `무료로는 ${limit}명까지 함께 쓸 수 있어요.`;

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      show(ok);
    } catch (err) {
      show(err instanceof Error ? err.message : "처리하지 못했어요");
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`함께 챙기는 사람 ${members.length}`}
      >
        <div className="flex flex-col gap-6">
          <ul className="m-0 flex list-none flex-col p-0">
            {members.map((m) => (
              <li
                key={m.uid}
                className="flex min-h-16 items-center gap-3 border-b border-line"
              >
                <Avatar
                  name={m.nickname}
                  tone={m.isMe ? "brand" : "neutral"}
                  online={m.isMe || onlineUids.has(m.uid)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-semibold">
                      {m.nickname}
                    </span>
                    <span className="shrink-0 text-micro text-sub">
                      {m.isOwner ? "만든 사람" : "멤버"}
                    </span>
                  </span>
                  <span className="text-caption text-sub">
                    {m.isMe
                      ? "나"
                      : onlineUids.has(m.uid)
                      ? "지금 보는 중"
                      : " "}
                  </span>
                </span>
                {isOwner && !m.isMe && (
                  <IconButton
                    label={`${m.nickname} 관리`}
                    onClick={() => setManage(m)}
                  >
                    <IconDots size={20} stroke={1.75} />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>

          {offline ? (
            <p className="m-0 text-caption text-sub">
              오프라인 모드에서는 초대할 수 없어요. 온라인 계정으로 전환하면
              함께 쓸 수 있어요.
            </p>
          ) : (
            <section className="flex flex-col gap-3">
              <SectionHeader>초대하기</SectionHeader>
              {full ? (
                <div className="flex flex-col gap-3 rounded-card bg-fill p-4">
                  <p className="m-0 text-body">{fullMessage}</p>
                  {upgradable && onUpgrade && (
                    <Button size="sm" className="self-start" onClick={onUpgrade}>
                      프리미엄으로 {MAX_BAG_MEMBERS}명까지
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    block
                    className={linkCopied ? "bg-brand text-on-brand" : undefined}
                    leading={
                      linkCopied ? (
                        <IconCheck size={18} stroke={2} />
                      ) : (
                        <IconLink size={18} stroke={1.9} />
                      )
                    }
                    onClick={async () => {
                      const ok = await onCopyLink();
                      setLinkCopied(ok);
                      if (!ok) show("링크를 복사하지 못했어요");
                    }}
                  >
                    {linkCopied ? "링크를 복사했어요" : "초대 링크 복사"}
                  </Button>
                  <div className="flex min-h-13 items-center justify-between rounded-card border border-line bg-card pr-2 pl-4">
                    <span className="flex flex-col">
                      <span className="text-micro text-sub">초대 코드</span>
                      <span className="font-mono text-body-lg font-medium tracking-widest">
                        {inviteCode}
                      </span>
                    </span>
                    <Button
                      variant="text"
                      size="sm"
                      onClick={async () =>
                        show(
                          (await onCopyCode())
                            ? "초대 코드를 복사했어요"
                            : "복사하지 못했어요"
                        )
                      }
                    >
                      복사
                    </Button>
                  </div>
                  <p className="m-0 text-caption text-sub">
                    {memberLimit !== undefined
                      ? `${memberLimit}명까지 함께할 수 있어요. `
                      : ""}
                    링크를 받은 사람은 로그인 후 바로 들어와요.
                  </p>
                </>
              )}
              {isOwner ? (
                <Button
                  variant="text"
                  size="sm"
                  className="self-start px-0"
                  onClick={() => setConfirm({ kind: "regen" })}
                >
                  초대 코드 새로 받기
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  className="self-start px-0"
                  onClick={() => setConfirm({ kind: "leave" })}
                >
                  이 가방에서 나가기
                </Button>
              )}
            </section>
          )}
        </div>
      </Sheet>

      <Sheet
        open={!!manage}
        onClose={() => setManage(null)}
        title={manage?.nickname}
      >
        <div className="flex flex-col">
          <button
            type="button"
            className="flex min-h-13 items-center border-b border-line bg-transparent text-left text-body"
            onClick={() => {
              setConfirm({ kind: "transfer", member: manage ?? undefined });
              setManage(null);
            }}
          >
            만든 사람 넘기기
          </button>
          <button
            type="button"
            className="flex min-h-13 items-center bg-transparent text-left text-body text-alert"
            onClick={() => {
              setConfirm({ kind: "remove", member: manage ?? undefined });
              setManage(null);
            }}
          >
            내보내기
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm?.kind === "remove"}
        title={`${confirm?.member?.nickname ?? ""} 님을 내보낼까요?`}
        message="다시 들어오려면 초대 코드가 필요해요."
        confirmLabel="내보내기"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm?.member &&
          run(() => onRemove(confirm.member!.uid), "멤버를 내보냈어요")
        }
      />
      <ConfirmSheet
        open={confirm?.kind === "transfer"}
        title={`${confirm?.member?.nickname ?? ""} 님에게 넘길까요?`}
        message="넘기면 나는 일반 멤버가 돼요. 함께 쓸 수 있는 인원은 새 만든 사람의 프리미엄 여부를 따라요."
        confirmLabel="넘기기"
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm?.member &&
          run(() => onTransfer(confirm.member!.uid), "만든 사람을 넘겼어요")
        }
      />
      <ConfirmSheet
        open={confirm?.kind === "leave"}
        title="이 가방에서 나갈까요?"
        message="다시 참여하려면 초대 코드가 필요해요."
        confirmLabel="나가기"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => run(onLeave, "가방에서 나갔어요")}
      />
      <ConfirmSheet
        open={confirm?.kind === "regen"}
        title="초대 코드를 새로 받을까요?"
        message="기존 코드와 링크는 더 이상 쓸 수 없어요."
        confirmLabel="새로 받기"
        onClose={() => setConfirm(null)}
        onConfirm={() => run(onRegenerateCode, "초대 코드를 새로 발급했어요")}
      />
    </>
  );
}
