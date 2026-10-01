"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconExternalLink, IconShare } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Sheet } from "@/components/v2/ui";

// 메모 공유 시트(구 MemoPackShareModal의 v2). 열 때마다 지금 내용으로 공유 스냅샷을 갱신한다
// (app/api/share-pack, 구 모달과 같은 요청·응답). 첫 발급된 토큰은 onTokenGenerated로 팩에 저장한다.
// 큰 문서 미리보기는 뺐다 - 링크를 열면 그대로 보이므로 "열어 보기"로 대신한다.
export function MemoShareSheet({
  open,
  pack,
  bagId,
  onTokenGenerated,
  onClose,
}: {
  open: boolean;
  // 열 때 보낼 최신 내용(편집 중인 문서 포함)
  pack: Pack;
  bagId?: string;
  onTokenGenerated?: (token: string) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [token, setToken] = useState<string | null>(pack.publicShareToken ?? null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  // 부모가 렌더마다 새 객체를 넘기므로 effect는 열릴 때만 돌고, 내용은 ref로 읽는다
  const packRef = useRef(pack);
  const onTokenRef = useRef(onTokenGenerated);
  useEffect(() => {
    packRef.current = pack;
    onTokenRef.current = onTokenGenerated;
  });

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    (async () => {
      setSyncing(true);
      try {
        const idToken = await user.getIdToken();
        const current = packRef.current;
        const res = await fetch("/api/share-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ packId: current.id, pack: current, bagId }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (active && data.token) {
          setToken(data.token);
          onTokenRef.current?.(data.token);
        }
      } catch (err) {
        console.error("[팩인백] 메모 공유 스냅샷 갱신 실패:", err);
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
      await navigator.share({ title: pack.name || "메모", url: shareUrl });
    } catch {
      // 사용자가 공유 창을 닫은 경우 등은 조용히 무시
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="공유"
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
          링크가 있으면 누구나 이 메모를 볼 수 있어요. 받은 사람은 &lsquo;내 팩 보관함에 담기&rsquo;로 가져갈 수 있어요.
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
          {syncing && shareUrl ? "지금 내용으로 갱신하는 중이에요" : "공유한 뒤에 고친 내용은 이 창을 다시 열면 링크에 반영돼요."}
        </p>
      </div>
    </Sheet>
  );
}
