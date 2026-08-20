"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { IconX, IconChevronDown } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditLinkModal from "@/components/EditLinkModal";
import { useToast } from "@/components/Toast";
import { fetchMyShortLinks, deleteShortLink, MyShortLink } from "@/lib/shortLinkService";
import { setLinkMetaCache } from "@/lib/linkLabelCache";
import { useOverlayLayer, OverlayLayerProvider, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// 설정 > "짧은 URL 사용하기" 하단의 "내가 만든 URL 관리"에서 여는 모달. 본인이 만든 짧은
// (/s/{code}) + 커스텀(/c/{code}) URL을 최신순으로 한 목록에 모아 보여주고, 그 자리에서
// 이름/주소 수정(EditLinkModal 재사용)과 삭제까지 할 수 있게 한다. 목록 자체는 서버에
// 새로 만든 app/api/my-short-links가 내려주고(클라이언트는 shortLinks/customShortLinks를
// 직접 읽을 수 없음 - firestore.rules), 삭제는 app/api/delete-short-link를 쓴다.
// 한 번에 보여줄 개수. 목록은 서버에서 이미 최신순으로 내려주므로, 여기서는 그냥
// 앞에서부터 이 개수만큼만 잘라서 보여주다가 "더보기"를 누르면 이만큼씩 더 펼친다.
const PAGE_SIZE = 20;

export default function MyShortLinksModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  // 이 모달 안에서 여는 EditLinkModal/ConfirmDialog(둘 다 useOverlayLayer() + 자기 offset으로
  // zIndex를 계산함)가 이 모달보다 항상 위에 뜨도록, 아래에서 그 자식들을
  // OverlayLayerProvider(value=resolvedZIndex)로 감싸서 "지금 층수"를 물려준다
  // (SlideScreen이 자기 children에 하는 것과 동일한 패턴 - lib/overlayLayer.ts 참고).
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);
  const { show } = useToast();

  const [links, setLinks] = useState<MyShortLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<MyShortLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<MyShortLink | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    fetchMyShortLinks(user)
      .then((result) => {
        if (!cancelled) setLinks(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "목록을 불러오지 못했어요");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async (shortUrl: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      show("링크를 복사했어요");
    } catch {
      show("복사에 실패했어요");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLink) return;
    setDeletingBusy(true);
    try {
      await deleteShortLink(user, deletingLink.kind, deletingLink.code);
      setLinks((prev) => prev?.filter((l) => l.code !== deletingLink.code || l.kind !== deletingLink.kind) ?? prev);
      // 지금 열려있는 다른 짐/메모에 이 링크가 이미 표시돼 있었다면(linkLabelCache에 캐시됨),
      // 새로고침 없이도 곧바로 "링크가 없어졌다"는 상태로 갱신되게 캐시를 비워준다.
      setLinkMetaCache(deletingLink.kind, deletingLink.code, null);
      setDeletingLink(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "링크 삭제에 실패했어요");
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 md:p-4"
        style={{ zIndex: resolvedZIndex, background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col w-full max-w-md max-h-[80vh] rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div>
              <h3 className="text-[15px] font-semibold">내가 만든 URL 관리</h3>
              <p className="text-[12px] text-text-muted mt-0.5">
                직접 만든 짧은/커스텀 URL을 모아서 보고 수정·삭제할 수 있어요
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 shrink-0" aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {links === null && !loadError && (
              <p className="text-[13px] text-text-muted text-center py-10">불러오는 중...</p>
            )}
            {loadError && (
              <p className="text-[13px] text-center py-10" style={{ color: "var(--danger)" }}>
                {loadError}
              </p>
            )}
            {links !== null && links.length === 0 && (
              <p className="text-[13px] text-text-muted text-center py-10">
                아직 만든 짧은 URL이 없어요
              </p>
            )}
            {links !== null && links.length > 0 && (
              <div className="flex flex-col gap-2">
                {links.slice(0, visibleCount).map((link) => (
                  <div
                    key={`${link.kind}-${link.code}`}
                    className="rounded-lg border border-border p-3 flex flex-col gap-1.5"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <p className="text-[13px] font-medium truncate">
                      {link.label || link.shortUrl}
                    </p>
                    {link.label && (
                      <p className="text-[12px] text-accent truncate">{link.shortUrl}</p>
                    )}
                    <p className="text-[11px] text-text-muted truncate">{link.longUrl}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10.5px] text-text-muted">
                        {formatDate(link.createdAt)}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleCopy(link.shortUrl)}
                          className="text-[12px] font-medium text-text-secondary"
                        >
                          복사
                        </button>
                        <button
                          onClick={() => setEditingLink(link)}
                          className="text-[12px] font-medium text-text-secondary"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => setDeletingLink(link)}
                          className="text-[12px] font-medium"
                          style={{ color: "var(--danger)" }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {links.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="flex items-center justify-center gap-1 py-2.5 text-[12.5px] font-medium text-text-secondary"
                  >
                    더보기
                    <IconChevronDown size={15} stroke={1.75} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <OverlayLayerProvider value={resolvedZIndex}>
        {editingLink && (
          <EditLinkModal
            kind={editingLink.kind}
            code={editingLink.code}
            initialLabel={editingLink.label}
            initialLongUrl={editingLink.longUrl}
            user={user}
            onClose={() => setEditingLink(null)}
            onSuccess={(result) => {
              setLinks((prev) =>
                prev?.map((l) =>
                  l.kind === editingLink.kind && l.code === editingLink.code
                    ? { ...l, label: result.label, longUrl: result.longUrl }
                    : l
                ) ?? prev
              );
              // 지금 열려있는 다른 짐/메모에 이 링크가 이미 표시돼 있었다면(linkLabelCache에
              // 캐시됨), 새로고침 없이도 곧바로 새 이름/주소로 갱신되게 캐시를 같이 갱신한다
              // (LinkifiedText.tsx 자체 수정 흐름이 이미 하고 있는 것과 동일하게 맞춤).
              setLinkMetaCache(editingLink.kind, editingLink.code, {
                kind: editingLink.kind,
                code: editingLink.code,
                label: result.label,
                longUrl: result.longUrl,
                canEdit: true,
              });
              setEditingLink(null);
              show("링크를 수정했어요");
            }}
          />
        )}

        {deletingLink && (
          <ConfirmDialog
            title="이 링크를 삭제할까요?"
            message={
              deletingBusy
                ? "삭제 중..."
                : "이미 공유된 곳에서는 더 이상 열리지 않게 돼요. 되돌릴 수 없어요."
            }
            confirmLabel="삭제"
            onCancel={() => !deletingBusy && setDeletingLink(null)}
            onConfirm={() => handleConfirmDelete()}
          />
        )}
      </OverlayLayerProvider>
    </Portal>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
