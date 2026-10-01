"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconExternalLink, IconShare } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Sheet } from "@/components/v2/ui";

export interface PackShareTarget {
  // 팩 하나(체크리스트) 또는 폴더(안의 팩 목록과 함께)
  pack?: Pack;
  folder?: Pack;
  folderPacks?: Pack[];
}

// 팩·폴더 링크 공유 시트(구 PackShareModal의 v2, 이미지 카드 없이 링크만).
// 열 때마다 지금 내용으로 /api/share-pack 스냅샷을 갱신한다(구 모달과 같은 요청 형식, 같은 토큰을 다시 쓴다).
export function PackShareSheet({
  open,
  target,
  bagId,
  onTokenGenerated,
  onClose,
}: {
  open: boolean;
  target: PackShareTarget | null;
  bagId?: string;
  onTokenGenerated?: (token: string) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();

  // 닫히는 동안 내용이 남도록 마지막 대상을 기억한다
  const [kept, setKept] = useState<PackShareTarget | null>(target);
  const [token, setToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  if (target && target !== kept) {
    setKept(target);
    setToken((target.folder ?? target.pack)?.publicShareToken ?? null);
    setCopied(false);
  }
  const shown = target ?? kept;
  const isFolder = !!shown?.folder;
  const title = (isFolder ? shown?.folder?.name : shown?.pack?.name) || (isFolder ? "폴더" : "팩");

  // 부모가 렌더마다 새 배열·객체를 넘길 수 있어서 effect는 열릴 때만 돌고, 내용은 ref로 읽는다
  const targetRef = useRef(target);
  const onTokenRef = useRef(onTokenGenerated);
  useEffect(() => {
    if (target) targetRef.current = target;
    onTokenRef.current = onTokenGenerated;
  });

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    (async () => {
      setSyncing(true);
      try {
        const t = targetRef.current;
        if (!t) return;
        const idToken = await user.getIdToken();
        const res = await fetch("/api/share-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            packId: t.pack?.id,
            pack: t.pack,
            folderId: t.folder?.id,
            folder: t.folder,
            packs: t.folder ? (t.folderPacks ?? []).filter((p) => p.type !== "folder") : undefined,
            bagId,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (active && data.token) {
          setToken(data.token);
          onTokenRef.current?.(data.token);
        }
      } catch (err) {
        console.error("[팩인백] 팩 공유 링크 준비 실패:", err);
        if (active) show("공유 링크를 준비하지 못했어요");
      } finally {
        if (active) setSyncing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, user, bagId, show]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = token ? `${origin}/p/${token}` : "";
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      show("링크를 복사했어요");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      show("링크를 복사하지 못했어요");
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.share({ title, url: shareUrl });
    } catch {
      // 공유 창을 닫은 경우 등은 무시
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isFolder ? `'${title}' 폴더 공유` : "공유"}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!shareUrl}
            onClick={copy}
            leading={copied ? <IconCheck size={18} stroke={2.2} /> : <IconCopy size={18} stroke={1.9} />}
          >
            {copied ? "복사됨" : "링크 복사"}
          </Button>
          {canNativeShare && (
            <Button className="flex-1" disabled={!shareUrl} onClick={nativeShare} leading={<IconShare size={18} stroke={1.9} />}>
              보내기
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-sub">
          링크가 있으면 누구나 {isFolder ? "이 폴더의 팩들을" : "이 팩을"} 볼 수 있어요. 받은 사람은 자기 팩 보관함으로 가져갈 수 있어요.
        </p>
        <div className="flex h-12 items-center gap-2 rounded-field bg-fill pr-1 pl-4">
          <span className="min-w-0 flex-1 truncate text-caption text-sub">
            {syncing && !shareUrl ? "링크를 만들고 있어요" : shareUrl || "링크를 준비하지 못했어요"}
          </span>
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="열어 보기"
              title="열어 보기"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-field text-ink active:bg-line"
            >
              <IconExternalLink size={20} stroke={1.75} />
            </a>
          )}
        </div>
        <p className="m-0 text-caption text-faint">
          {syncing && shareUrl
            ? "지금 내용으로 갱신하는 중이에요"
            : isFolder
              ? "이 창을 열 때마다 지금 폴더 내용으로 링크가 갱신돼요. 주소는 그대로예요."
              : "팩을 고치면 화면을 나갈 때 링크에도 자동으로 반영돼요. 주소는 그대로예요."}
        </p>
      </div>
    </Sheet>
  );
}
