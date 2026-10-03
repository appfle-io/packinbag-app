"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { IconCopy, IconLoader2, IconPencil, IconTrash } from "@tabler/icons-react";
import { useToast } from "@/components/Toast";
import { deleteShortLink, fetchMyShortLinks, updateLinkMeta, validateLinkLabel, LINK_LABEL_MAX_LENGTH, type MyShortLink } from "@/lib/shortLinkService";
import { setLinkMetaCache } from "@/lib/linkLabelCache";
import { Button, IconButton, Sheet, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";

const PAGE_SIZE = 20;
const FIELD = "h-12 w-full rounded-field border border-line bg-card px-4 text-body outline-none placeholder:text-faint focus:border-ink";

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// 링크 고치기(표시 이름 · 연결 주소). 구 EditLinkModal과 같은 서버 API. 코드(주소 뒷부분)는 못 바꾼다
function EditLinkSheet({
  link,
  user,
  onClose,
  onSaved,
}: {
  link: MyShortLink | null;
  user: User;
  onClose: () => void;
  onSaved: (link: MyShortLink, result: { label: string | null; longUrl: string }) => void;
}) {
  const [cached, setCached] = useState(link);
  const [label, setLabel] = useState(link?.label ?? "");
  const [longUrl, setLongUrl] = useState(link?.longUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (link && link !== cached) {
    setCached(link);
    setLabel(link.label ?? "");
    setLongUrl(link.longUrl);
    setError(null);
  }
  const l = link ?? cached;

  const save = async () => {
    if (!l) return;
    const labelError = validateLinkLabel(label);
    if (labelError) return setError(labelError);
    if (!longUrl.trim()) return setError("연결할 주소를 입력해 주세요");
    setSaving(true);
    setError(null);
    try {
      const result = await updateLinkMeta(user, { kind: l.kind, code: l.code, label: label.trim(), longUrl: longUrl.trim() });
      onSaved(l, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "링크를 고치지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!link}
      onClose={saving ? () => {} : onClose}
      title="링크 고치기"
      footer={
        <Button block disabled={saving} onClick={save}>
          {saving ? "저장 중" : "저장"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 truncate text-caption text-sub">{l?.shortUrl}</p>
        <label className="flex flex-col gap-2">
          <span className="text-caption text-sub">표시 이름 (선택)</span>
          <input value={label} onChange={(e) => {
              setLabel(e.target.value);
              setError(null);
            }} maxLength={LINK_LABEL_MAX_LENGTH} placeholder="예: 숙소 예약 확인" className={FIELD} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-caption text-sub">연결되는 주소</span>
          <input value={longUrl} onChange={(e) => {
              setLongUrl(e.target.value);
              setError(null);
            }} placeholder="https://" inputMode="url" className={FIELD} />
        </label>
        {error && (
          <p role="alert" className="m-0 text-caption text-alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// 설정 > 내가 만든 URL. 구 MyShortLinksModal 대체(같은 서버 API). 짧은/커스텀 URL을 최신순으로, 복사 · 고치기 · 삭제
export function MyLinksSheet({ open, user, onClose }: { open: boolean; user: User | null; onClose: () => void }) {
  const { show } = useToast();
  const [links, setLinks] = useState<MyShortLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<MyShortLink | null>(null);
  const [deleting, setDeleting] = useState<MyShortLink | null>(null);

  // 열 때마다 새로 불러온다
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLinks(null);
      setLoadError(null);
      setVisible(PAGE_SIZE);
    }
  }
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    fetchMyShortLinks(user)
      .then((r) => !cancelled && setLinks(r))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "목록을 불러오지 못했어요"));
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      show("링크를 복사했어요");
    } catch {
      show("복사하지 못했어요");
    }
  };

  const remove = async (link: MyShortLink) => {
    if (!user) return;
    try {
      await deleteShortLink(user, link.kind, link.code);
      setLinks((prev) => prev?.filter((x) => x.code !== link.code || x.kind !== link.kind) ?? prev);
      setLinkMetaCache(link.kind, link.code, null);
      show("링크를 지웠어요");
    } catch (err) {
      show(err instanceof Error ? err.message : "링크를 지우지 못했어요");
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title="내가 만든 URL" size="tall">
        <div className="flex flex-col gap-3">
          <p className="m-0 text-caption text-sub">직접 만든 짧은 URL과 커스텀 URL이에요. 지우면 이미 공유한 곳에서도 열리지 않아요.</p>
          {loadError ? (
            <p role="alert" className="m-0 py-16 text-center text-body text-alert">
              {loadError}
            </p>
          ) : links === null ? (
            <div role="status" className="flex justify-center py-16">
              <IconLoader2 size={24} stroke={1.75} className="animate-spin text-faint" aria-label="불러오는 중" />
            </div>
          ) : links.length === 0 ? (
            <p className="m-0 py-16 text-center text-body text-sub">아직 만든 URL이 없어요</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {links.slice(0, visible).map((link, i, arr) => (
                <li key={`${link.kind}-${link.code}`} className={cx("flex items-start gap-1 py-3", i < arr.length - 1 && "border-b border-line")}>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-body font-semibold text-ink">{link.label || link.shortUrl}</span>
                    {link.label && <span className="truncate text-caption text-brand">{link.shortUrl}</span>}
                    <span className="truncate text-caption text-sub">{link.longUrl}</span>
                    <span className="text-micro text-faint">{formatDate(link.createdAt)}</span>
                  </span>
                  <IconButton label="복사" onClick={() => copy(link.shortUrl)}>
                    <IconCopy size={20} stroke={1.75} />
                  </IconButton>
                  <IconButton label="고치기" onClick={() => setEditing(link)}>
                    <IconPencil size={20} stroke={1.75} />
                  </IconButton>
                  <IconButton label="삭제" className="text-alert" onClick={() => setDeleting(link)}>
                    <IconTrash size={20} stroke={1.75} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          {links && links.length > visible && (
            <Button variant="secondary" block onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              더 보기
            </Button>
          )}
        </div>
      </Sheet>

      {user && (
        <EditLinkSheet
          link={editing}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={(link, result) => {
            setLinks((prev) => prev?.map((x) => (x.kind === link.kind && x.code === link.code ? { ...x, label: result.label, longUrl: result.longUrl } : x)) ?? prev);
            setLinkMetaCache(link.kind, link.code, { kind: link.kind, code: link.code, label: result.label, longUrl: result.longUrl, canEdit: true });
            setEditing(null);
            show("링크를 고쳤어요");
          }}
        />
      )}
      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="이 링크를 지울까요?"
        message="이미 공유한 곳에서도 더 이상 열리지 않아요. 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={() => deleting && remove(deleting)}
      />
    </>
  );
}
