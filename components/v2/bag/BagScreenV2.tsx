"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowUp, IconChevronLeft, IconDots, IconLayoutColumns, IconLayoutList, IconLock, IconPackage, IconRotateClockwise, IconUsers } from "@tabler/icons-react";
import type { Bag, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { getViewablePacks, isPremiumUser } from "@/lib/premiumLimits";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { getFileKind, getFileExtensionLabel } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import SlideScreen from "@/components/SlideScreen";
import PackNoteEditorScreen from "@/components/screens/PackNoteEditorScreen";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import AiClipboardModal, { type AiClipboardResult } from "@/components/AiClipboardModal";
import AiBagAuditModal from "@/components/AiBagAuditModal";
import ImageLightbox from "@/components/ImageLightbox";
import {
  useBagDocument,
  useBagItems,
  usePackOps,
  useBagMembers,
  useBagPresence,
  useBagAttachments,
  useBagAI,
  statsOf,
  packingStateOf,
  findInbox,
  type PackingState,
} from "@/hooks/bag";
import { Avatar, Badge, Button, Chip, IconButton, ProgressBar, cx } from "@/components/v2/ui";
import { PackSection } from "./PackSection";
import { MemoSection } from "./MemoSection";
import { PackImportSheet } from "./sheets/PackImportSheet";
import { MembersSheet } from "./sheets/MembersSheet";
import { ItemSheet } from "./sheets/ItemSheet";
import { PackSheet } from "./sheets/PackSheet";
import { MoreSheet } from "./sheets/MoreSheet";
import { ConfirmSheet } from "./sheets/ConfirmSheet";
import { formatRelativeDay, formatTravelDate } from "./format";

// 구 BagEditorScreen과 같은 props를 받는다 - AppShell/DesktopShell에서 플래그로 바꿔 끼우기만 하면 된다.
export interface BagScreenProps {
  initialBag: Bag;
  libraryPacks: Pack[];
  bags: Bag[];
  uid: string;
  nickname: string;
  avatarId: string;
  isNew: boolean;
  readOnly: boolean;
  onRequestUnlock: () => void;
  onBack: (currentBag: Bag) => void;
  onSave: (bag: Bag) => void;
  onDeleteBag: (bag: Bag) => void;
  onSaveAsLibraryPack: (pack: Pack) => void;
  onTrashPackFromBag: (pack: Pack, sourceBagId: string, sourceBagName: string) => void;
  onLeaveBag: (bagId: string) => Promise<void>;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
  onTransferOwnership: (bagId: string, targetUid: string) => Promise<void>;
  focusTarget?: { packId?: string; itemId?: string; searchQuery?: string } | null;
  onFocusHandled?: () => void;
}

type Filter = "all" | "left" | string;

const STATE_LABEL: Record<PackingState, string> = { empty: "비어 있음", packing: "싸는 중", packed: "다 쌌어요" };
const STATE_TONE: Record<PackingState, "neutral" | "brand" | "solid"> = { empty: "neutral", packing: "brand", packed: "solid" };

// 리디자인 v2 가방 화면 (체크 모드). 기준 목업: 팩인백 미니멀 리디자인 캔버스 "가방 · 체크 모드".
export default function BagScreenV2(props: BagScreenProps) {
  const {
    initialBag,
    libraryPacks,
    bags,
    uid: currentUid,
    nickname,
    avatarId,
    isNew,
    readOnly,
    onRequestUnlock,
    onBack,
    onSave,
    onDeleteBag,
    onTrashPackFromBag,
    onLeaveBag,
    onRemoveMember,
    onRegenerateInviteCode,
    onTransferOwnership,
    focusTarget,
    onFocusHandled,
  } = props;

  const { user, isOfflineMode, profile, updateBagPhoneColumns } = useAuth();
  const { show } = useToast();
  const premium = isOfflineMode ? true : isPremiumUser(profile?.email, profile ?? null);
  // 좁은 화면(폰 세로)에서 팩 안 아이템을 몇 열로 볼지. 넓은 화면은 PackSection이 컨테이너 쿼리로 2열·3열 자동.
  const phoneCols = profile?.bagPhoneColumns === 2 ? 2 : 1;

  const doc = useBagDocument({ initialBag, bags, isNew, readOnly, onRequestUnlock, onSave });
  const { bag } = doc;
  const items = useBagItems(doc, libraryPacks, currentUid);
  const packOps = usePackOps({ doc, libraryPacks, currentUid, onTrashPackFromBag });
  const members = useBagMembers({
    doc,
    currentUid,
    myNickname: nickname,
    myAvatarId: avatarId,
    onLeaveBag,
    onRemoveMember,
    onRegenerateInviteCode,
    onTransferOwnership,
  });
  const [premiumMessage, setPremiumMessage] = useState<string | null>(null);
  const attachments = useBagAttachments({ doc, premium, offline: isOfflineMode, onPremiumRequired: setPremiumMessage });
  const ai = useBagAI({ doc, user, premium, offline: isOfflineMode, onPremiumRequired: setPremiumMessage });

  // 메모 편집기 (닫힘 애니메이션 동안 내용 유지용 캐시 포함)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [shownNoteId, setShownNoteId] = useState<string | null>(null);
  const [noteQuery, setNoteQuery] = useState<string | null>(null);
  const openNote = (packId: string, query?: string | null) => {
    setShownNoteId(packId);
    setNoteQuery(query ?? null);
    setEditingNoteId(packId);
  };

  const presence = useBagPresence({
    bagId: bag.id,
    currentUid,
    nickname,
    avatarId,
    shared: bag.memberIds.length > 1,
    isNew,
    offline: isOfflineMode,
    editingNotePackId: editingNoteId,
  });

  // --- 화면에 그릴 팩 --------------------------------------------------------
  const viewable = useMemo(() => getViewablePacks(bag.packs, premium), [bag.packs, premium]);
  const inbox = findInbox({ ...bag, packs: viewable });
  const ordered = useMemo(() => {
    const rest = viewable.filter((p) => p.type !== "folder" && p.id !== inbox?.id);
    return inbox && inbox.items.length > 0 ? [inbox, ...rest] : rest;
  }, [viewable, inbox]);
  const checklist = ordered.filter((p) => p.kind !== "editor");
  const stats = statsOf(viewable);
  const packingState = packingStateOf(viewable);
  const ratio = stats.total > 0 ? stats.done / stats.total : 0;

  const memberNames = useMemo(
    () => Object.fromEntries(members.members.map((m) => [m.uid, m.isMe ? "나" : m.nickname])),
    [members.members],
  );

  // --- 필터 칩 / 접기 ----------------------------------------------------------
  const [filter, setFilter] = useState<Filter>("all");
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const filterStillValid = filter === "all" || filter === "left" || checklist.some((p) => p.id === filter);
  const activeFilter: Filter = filterStillValid ? filter : "all";

  const isOpen = (p: Pack) => {
    if (activeFilter !== "all") return true;
    if (openOverride[p.id] !== undefined) return openOverride[p.id];
    const checks = p.items.filter((i) => i.type === "check");
    return !(checks.length > 0 && checks.every((i) => i.checked));
  };

  const visibleSections = ordered.filter((p) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "left") {
      if (p.kind === "editor") return false;
      return p.items.some((i) => i.type === "check" && !i.checked);
    }
    return p.id === activeFilter;
  });

  const itemsFor = (p: Pack) => (activeFilter === "left" ? p.items.filter((i) => i.type === "check" && !i.checked) : p.items);

  // --- 시트 상태 ---------------------------------------------------------------
  const [importOpen, setImportOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [itemTarget, setItemTarget] = useState<{ packId: string; itemId: string } | null>(null);
  const [packTargetId, setPackTargetId] = useState<string | null>(null);
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const itemTargetResolved = useMemo(() => {
    if (!itemTarget) return null;
    const pack = bag.packs.find((p) => p.id === itemTarget.packId);
    const item = pack?.items.find((i) => i.id === itemTarget.itemId);
    return pack && item ? { pack, item } : null;
  }, [itemTarget, bag.packs]);
  const packTarget = packTargetId ? bag.packs.find((p) => p.id === packTargetId) ?? null : null;

  // --- 제목 ----------------------------------------------------------------------
  const [titleDraft, setTitleDraft] = useState(bag.name);
  const [titleFocused, setTitleFocused] = useState(false);
  const titleValue = titleFocused ? titleDraft : bag.name;
  const commitTitle = () => {
    setTitleFocused(false);
    const name = titleDraft.trim();
    if (!name || name === bag.name) return;
    if (doc.guard()) return;
    doc.update((prev) => ({ ...prev, name }));
  };

  // --- 하단 입력창 -----------------------------------------------------------------
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (items.addToInbox(draft)) {
      setDraft("");
      setFilter("all");
      setOpenOverride((o) => (inbox ? { ...o, [inbox.id]: true } : o));
    }
  };

  // --- 뒤로가기 (엣지 스와이프 포함) ------------------------------------------------
  const handleBack = useCallback(() => onBack(bag), [onBack, bag]);
  const swipeRef = useSwipeBack<HTMLDivElement>(handleBack, !editingNoteId);

  // --- 검색 결과로 들어왔을 때 해당 팩/아이템으로 이동 -------------------------------
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusTarget) return;
    const { packId, itemId, searchQuery } = focusTarget;
    const target = packId ? bag.packs.find((p) => p.id === packId) : undefined;
    if (target?.kind === "editor") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(검색)에서 넘어온 이동 요청 처리
      openNote(target.id, searchQuery);
      onFocusHandled?.();
      return;
    }
    if (packId) setOpenOverride((o) => ({ ...o, [packId]: true }));
    const t = window.setTimeout(() => {
      const el = document.querySelector(itemId ? `[data-item-id="${itemId}"]` : `[data-pack-id="${packId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (itemId) {
        setHighlightItemId(itemId);
        window.setTimeout(() => setHighlightItemId(null), 1800);
      }
      onFocusHandled?.();
    }, 320);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  // --- 메타 줄 -----------------------------------------------------------------------
  const travel = formatTravelDate(bag.travelDate, bag.ddayCountTodayAsDayOne);
  const lastPacked = bag.lastPackedAt ? `마지막으로 다 싼 날 · ${formatRelativeDay(bag.lastPackedAt)}` : null;
  const metaParts = [travel ? `${travel} 출발` : null, lastPacked, bag.memberIds.length > 1 ? `${bag.memberIds.length}명` : null].filter(Boolean);

  const noteForEditor = shownNoteId ? bag.packs.find((p) => p.id === shownNoteId) : undefined;
  const hasContent = ordered.length > 0;

  const handleClipboardApply = (result: AiClipboardResult) => {
    const { added, cappedOut } = items.applyGroupedItems(result.packs);
    setClipboardOpen(false);
    if (added === 0) {
      show(result.skippedDuplicateCount > 0 ? "클립보드 내용이 이미 모두 이 가방에 있어요" : "추가할 만한 내용을 찾지 못했어요");
    } else if (cappedOut) {
      show(`팩이 가득 차서 일부는 추가하지 못했어요 (${added}개 추가함)`);
    } else if (result.skippedDuplicateCount > 0) {
      show(`${added}개 추가했어요 (이미 있는 항목 ${result.skippedDuplicateCount}개는 제외)`);
    } else {
      show(`${added}개 추가했어요`);
    }
  };

  return (
    <div ref={swipeRef} className="pib-v2 @container/bag relative flex h-full min-h-0 w-full flex-col bg-canvas">
      {/* 상단 바 */}
      <div className="flex h-11 shrink-0 items-center justify-between px-2">
        <IconButton label="가방 목록으로" onClick={handleBack}>
          <IconChevronLeft size={22} stroke={1.9} />
        </IconButton>
        <div className="flex items-center">
          {presence.others.length > 0 && (
            <div className="mr-1 flex items-center" aria-label={`지금 보는 사람 ${presence.others.length}명`}>
              {presence.others.slice(0, 3).map((p, i) => (
                <Avatar key={p.uid} name={p.nickname} size="sm" online className={i > 0 ? "-ml-2" : undefined} />
              ))}
            </div>
          )}
          {/* 좁은 화면에서만 보이는 1열/2열 전환. 넓은 화면은 폭에 맞춰 자동이라 숨긴다 */}
          <IconButton
            label={phoneCols === 2 ? "1열로 보기" : "2열로 보기"}
            className="@2xl/bag:hidden"
            onClick={() => updateBagPhoneColumns(phoneCols === 2 ? 1 : 2).catch(() => {})}
          >
            {phoneCols === 2 ? <IconLayoutList size={22} stroke={1.75} /> : <IconLayoutColumns size={22} stroke={1.75} />}
          </IconButton>
          <IconButton label="함께 챙기는 사람" onClick={() => setMembersOpen(true)}>
            <IconUsers size={22} stroke={1.75} />
          </IconButton>
          <IconButton label="더보기" onClick={() => setMoreOpen(true)}>
            <IconDots size={22} stroke={1.75} />
          </IconButton>
        </div>
      </div>

      <main className="pib-v2-no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-6xl">
          {readOnly && (
            <button
              type="button"
              onClick={onRequestUnlock}
              className="mx-5 mt-2 flex min-h-11 w-auto items-center gap-2 rounded-field bg-fill px-3 text-left text-caption text-sub"
            >
              <IconLock size={16} stroke={1.9} aria-hidden="true" />
              무료 한도를 넘어 잠긴 가방이에요. 보기만 할 수 있어요.
              <span className="ml-auto font-semibold text-brand">풀기</span>
            </button>
          )}

          {/* 제목 · 메타 · 진행률 */}
          <div className="flex flex-col gap-4 px-5 pt-2">
            <div className="flex flex-col gap-1">
              <input
                value={titleValue}
                aria-label="가방 이름"
                placeholder="가방 이름"
                autoFocus={isNew}
                readOnly={readOnly}
                onFocus={() => {
                  setTitleDraft(bag.name);
                  setTitleFocused(true);
                }}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                className="m-0 w-full bg-transparent text-title font-bold outline-none placeholder:text-faint"
              />
              {metaParts.length > 0 && <p className="m-0 text-caption text-sub">{metaParts.join(" · ")}</p>}
              {bag.notice && <p className="m-0 line-clamp-2 text-caption text-ink">{bag.notice}</p>}
            </div>

            {bag.images.length > 0 && (
              <div className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {bag.images.map((url, i) => {
                  const kind = getFileKind(url);
                  return (
                    <button
                      key={url}
                      type="button"
                      aria-label={kind === "image" ? `사진 ${i + 1}` : `파일 ${i + 1}`}
                      onClick={() => (kind === "image" ? setLightbox(i) : openExternalLink(url))}
                      className="flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-field bg-fill"
                    >
                      {kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 업로드된 사용자 이미지(외부 URL)
                        <img src={url} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="text-micro font-bold text-sub">{getFileExtensionLabel(url)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {stats.total > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-title font-bold">{stats.done}</span>
                    <span className="text-body text-sub">/ {stats.total}</span>
                    <Badge tone={STATE_TONE[packingState]} className="ml-2 self-center">
                      {STATE_LABEL[packingState]}
                    </Badge>
                  </div>
                  <Button
                    variant="text"
                    size="sm"
                    className="pr-1"
                    disabled={stats.done === 0 || readOnly}
                    onClick={items.uncheckAll}
                    leading={<IconRotateClockwise size={18} stroke={1.9} />}
                  >
                    다시 싸기
                  </Button>
                </div>
                <ProgressBar value={ratio} label="챙긴 비율" />
              </div>
            )}
          </div>

          {/* 필터 칩 (스크롤해도 위에 붙어 있음) */}
          {checklist.length > 0 && (
            <div className="sticky top-0 z-10 bg-canvas">
              <div className="pib-v2-no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 pb-2">
                <Chip label="전체" count={stats.total} selected={activeFilter === "all"} onClick={() => setFilter("all")} />
                <Chip label="남은 것" count={stats.total - stats.done} selected={activeFilter === "left"} onClick={() => setFilter("left")} />
                {checklist.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    count={p.items.filter((i) => i.type === "check" && !i.checked).length}
                    selected={activeFilter === p.id}
                    onClick={() => setFilter(activeFilter === p.id ? "all" : p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 팩은 위에서 아래로 쌓고, 스크롤을 줄이려고 팩 안 아이템을 여러 열로 보여준다(PackSection).
              폰 세로 1열(버튼으로 2열) · 폰 가로·아이패드 세로 2열 · 아이패드 가로·PC 3열. 이 화면(@container/bag) 폭 기준 */}
          <div className="px-5 pb-6">
            <div>
              {visibleSections.map((p) =>
              p.kind === "editor" ? (
                <MemoSection
                  key={p.id}
                  pack={p}
                  editors={presence.noteEditorsOf(p.id).map((e) => e.nickname)}
                  onOpen={() => openNote(p.id)}
                  onMenu={() => setPackTargetId(p.id)}
                />
              ) : (
                <PackSection
                  key={p.id}
                  pack={p}
                  items={itemsFor(p)}
                  open={isOpen(p)}
                  onToggleOpen={() => setOpenOverride((o) => ({ ...o, [p.id]: !isOpen(p) }))}
                  onToggleItem={(itemId) => items.toggleItem(p.id, itemId)}
                  onItemMenu={(itemId) => (readOnly ? onRequestUnlock() : setItemTarget({ packId: p.id, itemId }))}
                  onPackMenu={() => (readOnly ? onRequestUnlock() : setPackTargetId(p.id))}
                  memberNames={memberNames}
                  highlightItemId={highlightItemId}
                  inbox={p.isInbox ? { canOrganize: ai.aiAvailable, organizing: ai.organizing, onOrganize: ai.organizeInbox } : undefined}
                  dense={phoneCols === 2}
                />
              ),
            )}
            </div>

            {!hasContent && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="m-0 text-body text-sub">아직 비어 있어요</p>
                <p className="m-0 text-caption text-faint">보관함의 팩을 불러오거나, 아래에 바로 적어 보세요.</p>
                <Button variant="secondary" onClick={() => setImportOpen(true)} leading={<IconPackage size={18} stroke={1.9} />}>
                  팩 불러오기
                </Button>
              </div>
            )}
            {hasContent && visibleSections.length === 0 && (
              <p className="m-0 py-10 text-center text-caption text-faint">{activeFilter === "left" ? "다 챙겼어요" : "보여줄 항목이 없어요"}</p>
            )}
          </div>
        </div>
      </main>

      {/* 하단 입력창 */}
      <form onSubmit={submitDraft} className="shrink-0 border-t border-line bg-canvas">
        <div className="pb-safe-8 mx-auto flex w-full max-w-3xl items-center gap-2 px-3 pt-2">
          <IconButton label="팩 불러오기" variant="soft" onClick={() => (readOnly ? onRequestUnlock() : setImportOpen(true))}>
            <IconPackage size={20} stroke={1.75} />
          </IconButton>
          <label className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-card px-4">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={readOnly}
              aria-label="아이템 추가"
              placeholder="아이템 추가 — 미분류에 들어가요"
              enterKeyHint="send"
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
            />
          </label>
          <IconButton
            type="submit"
            label="추가"
            variant="solid"
            disabled={!draft.trim() || readOnly}
            className={cx(!draft.trim() && "bg-line-strong")}
          >
            <IconArrowUp size={20} stroke={2.2} />
          </IconButton>
        </div>
      </form>

      {/* 시트들 */}
      <PackImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        libraryPacks={libraryPacks}
        bagPacks={bag.packs}
        onImport={packOps.importPacks}
        onCreateEmpty={() => {
          packOps.addPack("checklist");
        }}
      />
      <MembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        members={members.members}
        onlineUids={presence.onlineUids}
        isOwner={members.isOwner}
        inviteCode={bag.inviteCode}
        onCopyLink={members.copyInviteLink}
        onCopyCode={members.copyInviteCode}
        onRegenerateCode={members.regenerateInviteCode}
        onRemove={members.removeMember}
        onTransfer={members.transferOwnership}
        offline={isOfflineMode}
        onLeave={async () => {
          await members.leave();
          setMembersOpen(false);
          onBack(bag);
        }}
      />
      <ItemSheet
        target={itemTargetResolved}
        onClose={() => setItemTarget(null)}
        packs={checklist}
        members={members.members}
        onSave={(patch) => itemTarget && items.updateItem(itemTarget.packId, itemTarget.itemId, patch)}
        onDuplicate={() => itemTarget && items.duplicateItem(itemTarget.packId, itemTarget.itemId)}
        onDelete={() => itemTarget && items.deleteItem(itemTarget.packId, itemTarget.itemId)}
      />
      <PackSheet
        pack={packTarget}
        onClose={() => setPackTargetId(null)}
        onRename={(name) => packTargetId && packOps.renamePack(packTargetId, name)}
        onSetAllChecked={(checked) => packTargetId && items.setPackChecked(packTargetId, checked)}
        onToggleAutoSync={() => packTargetId && packOps.toggleAutoSync(packTargetId)}
        onDelete={() => packTargetId && packOps.deletePack(packTargetId)}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        bag={bag}
        isOwner={members.isOwner}
        aiAvailable={ai.aiAvailable}
        uploading={attachments.uploading}
        onSetTravelDate={(travelDate) => !doc.guard() && doc.update((prev) => ({ ...prev, travelDate }))}
        onSetNotice={(notice) => !doc.guard() && doc.update((prev) => ({ ...prev, notice: notice || undefined }))}
        onAddChecklist={() => packOps.addPack("checklist")}
        onAddMemo={() => {
          const id = packOps.addPack("editor");
          if (id) openNote(id);
        }}
        onAddFiles={attachments.addFiles}
        onImportClipboard={() => (premium ? setClipboardOpen(true) : setPremiumMessage("AI 가져오기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."))}
        onAudit={() => setAuditOpen(true)}
        onDeleteOrLeave={() => (members.isOwner ? setConfirmDelete(true) : setConfirmLeave(true))}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="이 가방을 삭제할까요?"
        message={bag.memberIds.length > 1 ? "함께 쓰는 멤버에게서도 사라져요. 휴지통에서 30일 안에 되살릴 수 있어요." : "휴지통에서 30일 안에 되살릴 수 있어요."}
        confirmLabel="삭제"
        danger
        onConfirm={() => onDeleteBag(bag)}
      />
      <ConfirmSheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="이 가방에서 나갈까요?"
        message="다시 참여하려면 초대 코드가 필요해요."
        confirmLabel="나가기"
        danger
        onConfirm={async () => {
          await members.leave();
          onBack(bag);
          show("가방에서 나갔어요");
        }}
      />

      {/* 메모 편집기: 기존 편집기를 그대로 쓰고(4단계에서 리스킨) 저장은 이 가방 자동저장으로 */}
      <SlideScreen
        active={!!editingNoteId}
        zIndex={80}
        onBackdropClick={() => setEditingNoteId(null)}
        desktopTransition="fade"
        innerClassName="flex flex-col h-full w-full mx-auto max-w-3xl bg-background pib-safe-top overflow-hidden"
      >
        {noteForEditor && (
          <PackNoteEditorScreen
            pack={noteForEditor}
            readOnly={readOnly}
            otherEditorNickname={presence.otherNoteEditor?.nickname ?? null}
            initialSearchQuery={noteQuery ?? undefined}
            onBack={() => {
              setEditingNoteId(null);
              setNoteQuery(null);
            }}
            onSave={packOps.saveNotePack}
            onDeletePack={() => {
              setEditingNoteId(null);
              packOps.deletePack(noteForEditor.id);
            }}
            bagId={bag.id}
            premium={premium}
          />
        )}
      </SlideScreen>

      {lightbox !== null && (
        <ImageLightbox
          images={bag.images.filter((u) => getFileKind(u) === "image")}
          index={Math.max(0, bag.images.filter((u) => getFileKind(u) === "image").indexOf(bag.images[lightbox]))}
          onClose={() => setLightbox(null)}
          onNavigate={(next) => {
            const imgs = bag.images.filter((u) => getFileKind(u) === "image");
            setLightbox(bag.images.indexOf(imgs[next]));
          }}
        />
      )}
      {clipboardOpen && <AiClipboardModal bag={bag} onClose={() => setClipboardOpen(false)} onApply={handleClipboardApply} />}
      {auditOpen && (
        <AiBagAuditModal
          bag={bag}
          user={user}
          onClose={() => setAuditOpen(false)}
          onAddItemToPack={items.addToNamedPack}
          onShowPremiumLimit={(msg) => setPremiumMessage(msg)}
        />
      )}
      {premiumMessage && (
        <PremiumLimitModal
          message={premiumMessage}
          onClose={() => setPremiumMessage(null)}
          onUnlocked={() => {
            setPremiumMessage(null);
            show("이용권 코드가 적용됐어요! 다시 시도해주세요");
          }}
          email={profile?.email}
          profile={profile ?? null}
        />
      )}
    </div>
  );
}