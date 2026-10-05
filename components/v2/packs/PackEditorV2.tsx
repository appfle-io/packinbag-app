"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowUp, IconChevronLeft, IconLock, IconPackages, IconShare, IconTrash, IconX } from "@tabler/icons-react";
import type { Bag, Item, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { findLinkedBagPackRefs } from "@/lib/packSync";
import { mergePack, sameContent } from "@/lib/syncMerge";
import { tapHaptic } from "@/lib/haptics";
import { Button, CheckMark, IconButton, Sheet, Toggle, cx, useLongPress } from "@/components/v2/ui";
import { PackShareSheet } from "@/components/v2/sheets/PackShareSheet";
import { AlsoAddSheet, LibraryItemSheet, MoveDestSheet, type MoveDestination } from "./sheets/PackEditorSheets";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// AppShell이 넘기는 props.
// (variant는 v2에서 쓰지 않는다: 늘 바텀시트 안에 들어간다)
export interface PackEditorProps {
  initialPack: Pack;
  libraryPacks: Pack[];
  lockedPackIds?: Set<string>;
  bags?: Bag[];
  lockedBagIds?: Set<string>;
  readOnly: boolean;
  onRequestUnlock: () => void;
  onBack: () => void;
  onSave: (pack: Pack) => void;
  onSaveOtherPack: (pack: Pack) => void;
  onDelete: (packId: string, alsoDeleteFromBags?: boolean) => void;
  onAddItemsToBagPack?: (bagId: string, packId: string, items: Item[]) => void;
  onRemoveItemsFromBagPack?: (bagId: string, packId: string, itemIds: Set<string>) => void;
  focusItemId?: string | null;
  onFocusHandled?: () => void;
  variant?: "fullscreen" | "sheet";
}

// 리디자인 v2 팩 보관함 체크리스트 팩 화면. 기준은 가방 화면(같은 줄 모양·격자·하단 입력창).
// - 아이템 탭 = 체크, 길게 누르기(PC 우클릭) = 아이템 시트(이름·종류·여러 개 선택·옮기기·복제·삭제)
// - 여러 개 선택: 탭으로 고르고 아래에서 삭제/옮기기(보관함 팩·가방 속 팩)
// - 아래 입력창으로 바로 추가, 왼쪽 버튼으로 "다른 팩에도 같이 추가"
// - 0.5초 자동저장, 나갈 때 남은 변경 즉시 저장(구 화면과 같은 규칙). 공유한 팩은 나갈 때 공유 링크도 갱신
// 구 화면에서 빠진 것: 스와이프 수정/삭제(→ 길게 누르기 시트), 끌어서 순서 바꾸기, 글 아이템 서식 편집(기존 서식은 그대로 보존)
export default function PackEditorV2(props: PackEditorProps) {
  const {
    initialPack,
    libraryPacks,
    lockedPackIds,
    bags,
    lockedBagIds,
    readOnly,
    onRequestUnlock,
    onBack,
    onSave,
    onSaveOtherPack,
    onDelete,
    onAddItemsToBagPack,
    onRemoveItemsFromBagPack,
    focusItemId,
    onFocusHandled,
  } = props;
  const { user, isOfflineMode } = useAuth();
  const { show } = useToast();
  // 공유 링크 만들기는 인터넷이 필요하다
  const { guard: guardOnline } = useOnlineGuard();
  const [pack, setPack] = useState<Pack>(initialPack);
  const isQuick = !!pack.isQuickPack;

  const guard = (): boolean => {
    if (!readOnly) return false;
    onRequestUnlock();
    return true;
  };

  // --- 옮기기·같이 추가 대상 ------------------------------------------------------------------
  // 잠긴 팩·메모·폴더는 뺀다(구 화면 displayPacks와 같은 규칙)
  const otherPacks = useMemo(
    () =>
      libraryPacks.filter(
        (p) => p.id !== pack.id && p.type !== "folder" && p.kind !== "editor" && !p.isQuickPack && !lockedPackIds?.has(p.id),
      ),
    [libraryPacks, pack.id, lockedPackIds],
  );
  const movableBags = useMemo(
    () => (bags ?? []).filter((b) => !lockedBagIds?.has(b.id) && b.packs.some((p) => p.kind !== "editor" && p.type !== "folder")),
    [bags, lockedBagIds],
  );
  const linkedBagPackCount = useMemo(() => findLinkedBagPackRefs(bags ?? [], new Set([pack.id])).length, [bags, pack.id]);

  // --- 아이템 조작 ------------------------------------------------------------------------------
  const toggleItem = (itemId: string) => {
    if (guard()) return;
    tapHaptic();
    setPack((p) => ({ ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)) }));
  };

  const updateItem = (itemId: string, patch: { text?: string; type?: Item["type"] }) => {
    if (guard()) return;
    setPack((p) => ({
      ...p,
      items: p.items.map((i) => {
        if (i.id !== itemId) return i;
        const next: Item = { ...i };
        if (patch.text !== undefined) {
          next.text = patch.text;
          // 글자를 고치면 예전 부분 서식(spans)은 위치가 맞지 않으므로 뗀다(구 화면 changeItemText와 같음)
          next.spans = undefined;
        }
        if (patch.type && patch.type !== i.type) {
          next.type = patch.type;
          next.checked = patch.type === "check" ? false : undefined;
        }
        return next;
      }),
    }));
  };

  const duplicateItem = (itemId: string) => {
    if (guard()) return;
    setPack((p) => {
      const idx = p.items.findIndex((i) => i.id === itemId);
      if (idx < 0) return p;
      const copy: Item = { ...p.items[idx], id: uid() };
      const items = [...p.items];
      items.splice(idx + 1, 0, copy);
      return { ...p, items };
    });
  };

  const deleteItems = (ids: Set<string>) => {
    if (guard()) return;
    const removed = pack.items.map((item, index) => ({ item, index })).filter((x) => ids.has(x.item.id));
    if (removed.length === 0) return;
    setPack((p) => ({ ...p, items: p.items.filter((i) => !ids.has(i.id)) }));
    show(removed.length === 1 ? "아이템을 삭제했어요" : `${removed.length}개를 삭제했어요`, {
      actionLabel: "되돌리기",
      onAction: () =>
        setPack((p) => {
          const items = [...p.items];
          removed.forEach(({ item, index }) => items.splice(Math.min(index, items.length), 0, item));
          return { ...p, items };
        }),
    });
  };

  // 옮기기: 이 팩에서 빼고 목적지에 새 복사본을 즉시 저장. 되돌리기는 복사본만 목적지에서 지우고 원래 아이템을 돌려놓는다
  const commitMove = (ids: string[], dest: MoveDestination) => {
    if (guard()) return;
    const idSet = new Set(ids);
    const moved = pack.items.filter((i) => idSet.has(i.id));
    if (moved.length === 0) return;
    const copies = moved.map((i) => ({ ...i, id: uid() }));
    const copyIds = new Set(copies.map((c) => c.id));

    let label = "";
    if (dest.kind === "library") {
      const target = otherPacks.find((p) => p.id === dest.packId);
      if (!target) return;
      label = target.name;
      onSaveOtherPack({ ...target, items: [...target.items, ...copies] });
    } else {
      const bag = movableBags.find((b) => b.id === dest.bagId);
      const targetPack = bag?.packs.find((p) => p.id === dest.packId);
      if (!bag || !targetPack) return;
      label = `${bag.name} · ${targetPack.name}`;
      onAddItemsToBagPack?.(dest.bagId, dest.packId, copies);
    }
    setPack((p) => ({ ...p, items: p.items.filter((i) => !idSet.has(i.id)) }));
    setSelected(null);

    show(`'${label}'(으)로 ${moved.length}개 옮겼어요`, {
      actionLabel: "되돌리기",
      onAction: () => {
        setPack((p) => ({ ...p, items: [...p.items, ...moved] }));
        if (dest.kind === "library") {
          const latest = libraryPacks.find((p) => p.id === dest.packId);
          if (latest) onSaveOtherPack({ ...latest, items: latest.items.filter((i) => !copyIds.has(i.id)) });
        } else {
          onRemoveItemsFromBagPack?.(dest.bagId, dest.packId, copyIds);
        }
      },
    });
  };

  // --- 여러 개 선택 ------------------------------------------------------------------------------
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const selecting = selected !== null;
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === 0 ? null : next;
    });

  // --- 하단 입력창 + 같이 추가 --------------------------------------------------------------------
  const [draft, setDraft] = useState("");
  const [alsoIds, setAlsoIds] = useState<string[]>([]);
  // 다른 기기에서 지워졌거나 잠긴 팩은 빼고 센다
  const alsoValid = alsoIds.filter((id) => otherPacks.some((p) => p.id === id));
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const submitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || guard()) return;
    const make = (): Item => ({ id: uid(), type: "check", text, checked: false });
    const item = make();
    setPack((p) => ({ ...p, items: [...p.items, item] }));
    alsoValid.forEach((id) => {
      const target = libraryPacks.find((p) => p.id === id);
      if (target) onSaveOtherPack({ ...target, items: [...target.items, make()] });
    });
    setDraft("");
    setLastAddedId(item.id);
    if (alsoValid.length > 0) show(`이 팩과 다른 ${alsoValid.length}개 팩에 추가했어요`);
  };

  // --- 시트 상태 ------------------------------------------------------------------------------
  const [itemTargetId, setItemTargetId] = useState<string | null>(null);
  const itemTarget = itemTargetId ? pack.items.find((i) => i.id === itemTargetId) ?? null : null;
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [alsoOpen, setAlsoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [alsoDeleteFromBags, setAlsoDeleteFromBags] = useState(false);
  // 공유 시트는 대상을 참조로 비교하므로 렌더마다 새로 만들지 않는다
  const shareTarget = useMemo(() => (shareOpen ? { pack } : null), [shareOpen, pack]);

  // --- 자동저장(구 화면과 같은 규칙): 바뀌면 0.5초 뒤 저장, 나갈 때 대기 중이던 변경 즉시 저장 ----------------
  const deletingRef = useRef(false);
  const isFirstPackEffect = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const onSaveRef = useRef(onSave);
  const packRef = useRef(pack);
  // 공유한 팩이면 나갈 때 공유 스냅샷도 갱신(메모 편집기와 같은 규칙)
  const editedSinceShareRef = useRef(false);
  // 다른 기기 변경 반영용: 마지막으로 받은 서버 버전(병합 기준점)
  const baseRef = useRef<Pack>(initialPack);
  const applyingRemoteRef = useRef(false);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    packRef.current = pack;
  }, [pack]);

  useEffect(() => {
    if (isFirstPackEffect.current) {
      isFirstPackEffect.current = false;
      return;
    }
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      // 다른 기기 변경만 들어왔으면 저장하지 않는다(내 변경이 섞여 있을 때만 저장)
      if (sameContent(pack, baseRef.current)) return;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      // updatedAt을 찍어야 다른 기기가 "더 최신인지" 비교할 수 있다(구 화면은 처음 값을 그대로 썼음)
      onSaveRef.current({ ...pack, updatedAt: new Date().toISOString() });
      editedSinceShareRef.current = true;
    }, 500);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [pack]);

  // 다른 기기(아이폰↔아이패드)에서 같은 팩을 고치면 열어 둔 화면에도 반영한다. AppShell이 이미 구독 중인
  // libraryPacks를 쓰므로 추가 읽기는 없다. 내 변경이 있으면 아이템 단위로 합친다(lib/syncMerge).
  // 내 저장이 되돌아온 스냅샷은 내용이 같아서 아무 일도 하지 않는다.
  const remotePack = libraryPacks.find((p) => p.id === pack.id);
  useEffect(() => {
    if (!remotePack) return;
    const base = baseRef.current;
    if (remotePack === base) return;
    if (remotePack.updatedAt && base.updatedAt && remotePack.updatedAt <= base.updatedAt) return;
    baseRef.current = remotePack;
    const local = packRef.current;
    const merged = mergePack(base, local, remotePack);
    if (sameContent(merged, local)) return;
    applyingRemoteRef.current = true;
    setPack(merged);
  }, [remotePack]);

  const userRef = useRef(user);
  const offlineRef = useRef(isOfflineMode);
  useEffect(() => {
    userRef.current = user;
    offlineRef.current = isOfflineMode;
  });

  useEffect(() => {
    return () => {
      if (deletingRef.current) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        onSaveRef.current({ ...packRef.current, updatedAt: new Date().toISOString() });
        editedSinceShareRef.current = true;
      }
      // 공유한 팩을 고쳤으면 같은 토큰으로 스냅샷을 다시 올린다(app/api/share-pack은 덮어쓴다)
      const current = packRef.current;
      const u = userRef.current;
      if (!editedSinceShareRef.current || !current.publicShareToken || !u || offlineRef.current) return;
      u.getIdToken()
        .then((idToken) =>
          fetch("/api/share-pack", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ packId: current.id, pack: current }),
          }),
        )
        .catch((err) => console.error("[팩인백] 팩 공유 스냅샷 자동 갱신 실패:", err));
    };
  }, []);

  const swipeRef = useSwipeBack<HTMLDivElement>(selecting ? () => setSelected(null) : onBack);

  // --- 방금 추가한 아이템이 보이게, 검색으로 들어왔으면 그 아이템 강조 ---------------------------------
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lastAddedId) return;
    listRef.current?.querySelector(`[data-item-id="${lastAddedId}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 한 번 스크롤하고 비운다
    setLastAddedId(null);
  }, [lastAddedId]);

  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusItemId) return;
    const t = window.setTimeout(() => {
      listRef.current?.querySelector(`[data-item-id="${focusItemId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(focusItemId);
      window.setTimeout(() => setHighlightId(null), 1800);
      onFocusHandled?.();
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItemId]);

  // iOS: 키보드가 올라올 때 WebKit이 페이지를 스스로 밀어 올리는 걸 되돌린다(구 화면과 같은 처리)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const cancel = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const update = () => {
      cancel();
      requestAnimationFrame(cancel);
      window.setTimeout(cancel, 60);
      window.setTimeout(cancel, 200);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", cancel);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", cancel);
    };
  }, []);

  const checks = pack.items.filter((i) => i.type === "check");
  const done = checks.filter((i) => i.checked).length;

  return (
    <div ref={swipeRef} className="pib-v2 @container/bag relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-canvas">
      {/* 상단 바 */}
      <div className="flex h-11 shrink-0 items-center justify-between px-2">
        {selecting ? (
          <>
            <IconButton label="선택 끝내기" onClick={() => setSelected(null)}>
              <IconX size={22} stroke={1.9} />
            </IconButton>
            <span className="text-body font-semibold">{selected?.size ?? 0}개 선택</span>
            <span className="size-11" aria-hidden="true" />
          </>
        ) : (
          <>
            <IconButton label="뒤로" onClick={onBack}>
              <IconChevronLeft size={22} stroke={1.9} />
            </IconButton>
            <div className="flex items-center">
              {!isOfflineMode && !isQuick && (
                <IconButton label="공유" onClick={() => guardOnline(() => setShareOpen(true))}>
                  <IconShare size={22} stroke={1.75} />
                </IconButton>
              )}
              {!readOnly && !isQuick && (
                <IconButton
                  label="팩 삭제"
                  onClick={() => {
                    setAlsoDeleteFromBags(false);
                    setConfirmDelete(true);
                  }}
                >
                  <IconTrash size={22} stroke={1.75} className="text-alert" />
                </IconButton>
              )}
            </div>
          </>
        )}
      </div>

      <div ref={listRef} className="pib-v2-no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-6xl">
          {readOnly && (
            <button
              type="button"
              onClick={onRequestUnlock}
              className="mx-5 mt-2 flex min-h-11 w-auto items-center gap-2 rounded-field bg-fill px-3 text-left text-caption text-sub"
            >
              <IconLock size={16} stroke={1.9} aria-hidden="true" />
              무료 한도를 넘어 잠긴 팩이에요. 보기만 할 수 있어요.
              <span className="ml-auto font-semibold text-brand">풀기</span>
            </button>
          )}

          {/* 제목 */}
          <div className="flex flex-col gap-1 px-5 pt-2 pb-3">
            {isQuick || readOnly ? (
              <h1 className="m-0 truncate text-title font-bold">{pack.name || "이름 없는 팩"}</h1>
            ) : (
              <input
                value={pack.name}
                aria-label="팩 이름"
                placeholder="새 팩"
                onChange={(e) => setPack((p) => ({ ...p, name: e.target.value }))}
                onBlur={() => !pack.name.trim() && setPack((p) => ({ ...p, name: "새 팩" }))}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="m-0 w-full bg-transparent text-title font-bold outline-none placeholder:text-faint"
              />
            )}
            <p className="m-0 text-caption text-sub">
              {isQuick
                ? "적어 둔 걸 길게 눌러 \u2018여러 개 선택\u2019으로 팩이나 가방에 나눠 담으세요"
                : checks.length > 0
                  ? `아이템 ${pack.items.length}개 · 체크 ${done}/${checks.length}`
                  : `아이템 ${pack.items.length}개`}
            </p>
          </div>

          {/* 아이템 격자(가방 화면과 같은 규칙: 이 화면 폭 기준 1·2·3열) */}
          <div className="px-5 pb-6">
            {pack.items.length === 0 ? (
              <p className="m-0 py-16 text-center text-caption text-faint">아래에 적으면 바로 추가돼요</p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 p-0 @2xl/bag:grid-cols-2 @2xl/bag:gap-x-6 @4xl/bag:grid-cols-3">
                {pack.items.map((item) => (
                  <ItemLine
                    key={item.id}
                    item={item}
                    selecting={selecting}
                    selected={!!selected?.has(item.id)}
                    highlighted={highlightId === item.id}
                    onTap={() => (selecting ? toggleSelect(item.id) : item.type === "check" ? toggleItem(item.id) : guard() || setItemTargetId(item.id))}
                    onMenu={() => (selecting ? toggleSelect(item.id) : guard() || setItemTargetId(item.id))}
                  />
                ))}
              </ul>
            )}
            {!selecting && pack.items.length > 0 && !readOnly && (
              <p className="m-0 pt-6 text-center text-micro text-faint">길게 누르면 이름 · 여러 개 선택 · 옮기기 · 삭제</p>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 선택 중이면 삭제·옮기기, 아니면 입력창 */}
      {selecting ? (
        <div className="shrink-0 border-t border-line bg-canvas">
          <div className="pb-safe-8 mx-auto flex w-full max-w-3xl items-center gap-2 px-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              className="flex-1 border border-line-strong"
              onClick={() => {
                if (selected) deleteItems(selected);
                setSelected(null);
              }}
            >
              삭제
            </Button>
            <Button className="flex-1" onClick={() => selected && setMoveIds(Array.from(selected))}>
              옮기기
            </Button>
          </div>
        </div>
      ) : (
        !readOnly && (
          <form onSubmit={submitDraft} className="shrink-0 border-t border-line bg-canvas">
            <div className="pb-safe-8 mx-auto flex w-full max-w-3xl items-center gap-2 px-3 pt-2">
              <span className="relative inline-flex shrink-0">
                <IconButton
                  label={alsoValid.length > 0 ? `다른 ${alsoValid.length}개 팩에도 같이 추가 중` : "다른 팩에도 같이 추가"}
                  variant="soft"
                  className={cx(alsoValid.length > 0 && "bg-brand-soft text-brand")}
                  onClick={() => setAlsoOpen(true)}
                >
                  <IconPackages size={20} stroke={1.75} />
                </IconButton>
                {alsoValid.length > 0 && (
                  <span className="pointer-events-none absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-brand text-micro font-bold text-on-brand">
                    {alsoValid.length}
                  </span>
                )}
              </span>
              <label className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-card px-4">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="아이템 추가"
                  placeholder={alsoValid.length > 0 ? `아이템 추가 — 다른 ${alsoValid.length}개 팩에도` : "아이템 추가"}
                  enterKeyHint="send"
                  className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
                />
              </label>
              <IconButton type="submit" label="추가" variant="solid" disabled={!draft.trim()} className={cx(!draft.trim() && "bg-line-strong")}>
                <IconArrowUp size={20} stroke={2.2} />
              </IconButton>
            </div>
          </form>
        )
      )}

      {/* 시트 */}
      <LibraryItemSheet
        item={itemTarget}
        onClose={() => setItemTargetId(null)}
        onSave={(patch) => itemTarget && updateItem(itemTarget.id, patch)}
        onSelectMany={() => itemTarget && setSelected(new Set([itemTarget.id]))}
        onMove={() => itemTarget && setMoveIds([itemTarget.id])}
        onDuplicate={() => itemTarget && duplicateItem(itemTarget.id)}
        onDelete={() => itemTarget && deleteItems(new Set([itemTarget.id]))}
      />
      <MoveDestSheet
        open={!!moveIds}
        count={moveIds?.length ?? 0}
        libraryPacks={otherPacks}
        bags={movableBags}
        onPick={(dest) => moveIds && commitMove(moveIds, dest)}
        onClose={() => setMoveIds(null)}
      />
      <AlsoAddSheet open={alsoOpen} packs={otherPacks} selectedIds={alsoValid} onChange={setAlsoIds} onClose={() => setAlsoOpen(false)} />
      {!isOfflineMode && (
        <PackShareSheet
          open={shareOpen}
          target={shareTarget}
          onTokenGenerated={(token) => {
            if (packRef.current.publicShareToken !== token) setPack((p) => ({ ...p, publicShareToken: token }));
          }}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* 삭제 확인: 가방에 불러온 사본이 있으면 같이 지울지 고른다 */}
      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="이 팩을 휴지통으로 보낼까요?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button
              className="flex-1 bg-alert text-on-brand"
              onClick={() => {
                setConfirmDelete(false);
                deletingRef.current = true;
                onDelete(pack.id, linkedBagPackCount > 0 ? alsoDeleteFromBags : undefined);
              }}
            >
              휴지통으로
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body text-sub">
            설정 &gt; 휴지통에서 30일 안에 되살릴 수 있어요.
            {linkedBagPackCount > 0
              ? ` 가방에 불러온 사본이 ${linkedBagPackCount}개 있어요. 같이 지우지 않으면 사본은 남고 연결만 끊어져요.`
              : " 이미 가방에 불러온 팩에는 영향이 없어요."}
          </p>
          {linkedBagPackCount > 0 && (
            <div className="rounded-card border border-line bg-card px-4">
              <Toggle
                checked={alsoDeleteFromBags}
                onChange={setAlsoDeleteFromBags}
                label={`가방 속 사본도 같이 지우기 (${linkedBagPackCount}개)`}
                description="함께 쓰는 가방이면 다른 멤버의 화면에서도 사라져요"
              />
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

// 아이템 한 줄(가방 화면 PackSection의 줄과 같은 모양). 선택 중에는 왼쪽이 네모 선택 표시로 바뀐다.
function ItemLine({
  item,
  selecting,
  selected,
  highlighted,
  onTap,
  onMenu,
}: {
  item: Item;
  selecting: boolean;
  selected: boolean;
  highlighted: boolean;
  onTap: () => void;
  onMenu: () => void;
}) {
  const isCheck = item.type === "check";
  const press = useLongPress(onMenu, onTap);
  const done = isCheck && !!item.checked;
  return (
    <li data-item-id={item.id} className={cx("min-w-0", !isCheck && "col-span-full")}>
      <button
        type="button"
        {...press}
        aria-pressed={selecting ? selected : isCheck ? done : undefined}
        className={cx(
          "flex min-h-12 w-full select-none items-center gap-3 rounded-field bg-transparent text-left",
          "transition-colors duration-160 ease-snappy active:bg-fill",
          (highlighted || selected) && "bg-brand-soft",
        )}
      >
        {selecting ? (
          <CheckMark checked={selected} shape="square" />
        ) : isCheck ? (
          <CheckMark checked={done} />
        ) : (
          <span aria-hidden="true" className="size-5.5 shrink-0" />
        )}
        <span
          className={cx(
            "min-w-0 flex-1 text-body transition-colors duration-160 ease-snappy",
            done && !selecting ? "text-faint" : "text-ink",
            !isCheck && "text-sub",
            item.bold && "font-semibold",
          )}
        >
          {item.text}
        </span>
      </button>
    </li>
  );
}
