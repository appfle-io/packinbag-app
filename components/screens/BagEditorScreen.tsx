"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconPhoto,
  IconPlus,
  IconX,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { Bag, Item, Pack, ReminderOffset } from "@/lib/types";
import EditableText from "@/components/EditableText";
import BagNotice from "@/components/BagNotice";
import TravelDateField from "@/components/TravelDateField";
import PackGrid from "@/components/PackGrid";
import PackImportModal from "@/components/PackImportModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SaveAsDialog from "@/components/SaveAsDialog";
import GroupMembersModal from "@/components/GroupMembersModal";
import { useToast } from "@/components/Toast";
import { uploadBagImage, deleteBagImage } from "@/lib/storageService";
import { subscribeToBag, saveBagRemote } from "@/lib/bagsService";
import { firebaseErrorCode } from "@/lib/errorMessage";
import PresenceBar from "@/components/PresenceBar";
import ImageLightbox from "@/components/ImageLightbox";
import { useSwipeBack } from "@/lib/useSwipeBack";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function itemsMatch(a: Item[], b: Item[]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.type === b[i].type && item.text === b[i].text);
}

function isInSyncWithLibrary(pack: Pack, libraryPacks: Pack[]): boolean {
  if (!pack.linkedLibraryPackId) return false;
  const source = libraryPacks.find((p) => p.id === pack.linkedLibraryPackId);
  if (!source) return false;
  return pack.name.trim() === source.name.trim() && itemsMatch(pack.items, source.items);
}

export default function BagEditorScreen({
  initialBag,
  libraryPacks,
  uid: currentUid,
  nickname,
  avatarId,
  isNew,
  onBack,
  onSave,
  onDeleteBag,
  onSaveAsLibraryPack,
  onLeaveBag,
  onRemoveMember,
  onRegenerateInviteCode,
}: {
  initialBag: Bag;
  libraryPacks: Pack[];
  uid: string;
  nickname: string;
  avatarId: string;
  isNew: boolean;
  onBack: (currentBag: Bag) => void;
  onSave: (bag: Bag) => void;
  onDeleteBag: (bag: Bag) => void;
  onSaveAsLibraryPack: (pack: Pack) => void;
  onLeaveBag: (bagId: string) => void;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
}) {
  const [bag, setBag] = useState<Bag>(initialBag);
  const [showImport, setShowImport] = useState(false);
  const [confirmDeleteBag, setConfirmDeleteBag] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();
  const swipeBackRef = useSwipeBack<HTMLDivElement>(() => onBack(bag));

  const handleRemoveMember = async (memberUid: string) => {
    await onRemoveMember(bag.id, memberUid);
    setBag((prev) => {
      const memberProfiles = { ...prev.memberProfiles };
      delete memberProfiles[memberUid];
      return {
        ...prev,
        memberIds: prev.memberIds.filter((id) => id !== memberUid),
        memberProfiles,
      };
    });
  };

  const handleRegenerateCode = async () => {
    const newCode = await onRegenerateInviteCode(bag);
    setBag((prev) => ({ ...prev, inviteCode: newCode }));
  };

  const handleChangeTravelDate = (
    travelDate: string | undefined,
    reminderOffsets: ReminderOffset[] | undefined
  ) => setBag((prev) => ({ ...prev, travelDate, reminderOffsets }));

  const updatePacks = (updater: (packs: Pack[]) => Pack[]) =>
    setBag((prev) => ({ ...prev, packs: updater(prev.packs) }));

  // --- 실시간 동기화 -------------------------------------------------------
  // 이름/메모/체크박스/짐 추가삭제 등 가방 안의 "모든" 변경은 아래 자동저장 effect가
  // 감지해서 서버에 반영한다. 클릭/타이핑마다 바로 쏘지 않고 마지막 변경 후 잠깐
  // 기다렸다가 한 번만 저장하는데(디바운스), 이게 체크박스 광클 방지 역할도 겸한다 -
  // 연속으로 눌러도 화면은 즉시 반응하고, 서버 저장은 마지막 상태로 한 번만 나간다.
  const AUTOSAVE_DEBOUNCE_MS = 500;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false); // 로컬 변경이 아직 서버에 반영 안 됐거나 반영 중인 상태
  const isApplyingRemoteRef = useRef(false); // 방금 setBag이 원격 변경 수신 때문인지 표시
  const skipFirstAutosaveRef = useRef(true); // 화면 진입 시 최초 렌더는 저장 스킵

  useEffect(() => {
    if (skipFirstAutosaveRef.current) {
      skipFirstAutosaveRef.current = false;
      return;
    }
    if (isApplyingRemoteRef.current) {
      // 원격에서 받아온 변경을 반영한 것뿐이라 다시 저장할 필요 없음
      isApplyingRemoteRef.current = false;
      return;
    }
    isDirtyRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveBagRemote(bag)
        .catch((err) => {
          console.error("[팩인백] 실시간 저장 실패:", err);
          show(`실시간 저장에 실패했어요 (${firebaseErrorCode(err)})`);
        })
        .finally(() => {
          isDirtyRef.current = false;
        });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag]);

  // 다른 멤버가 이 가방을 동시에 보고 있을 때 그들의 변경(체크/이름/짐/팩 등 전부)을
  // 실시간으로 반영한다. 단, 내가 방금 만든 로컬 변경이 아직 서버로 안 나갔거나(디바운스
  // 대기 중) 저장 중이면(isDirtyRef) 그 사이에 들어온 원격 변경은 건너뛴다 - 곧 내가
  // 보낼 저장이 그 시점 기준 최신 상태를 다시 반영하기 때문에, 여기서 섞어 넣으면
  // 오히려 화면이 잠깐 깜빡이거나 아직 저장 안 한 내 편집을 잃을 수 있다.
  useEffect(() => {
    const unsub = subscribeToBag(bag.id, (remoteBag) => {
      if (!remoteBag) return;
      if (isDirtyRef.current) return;
      isApplyingRemoteRef.current = true;
      setBag(remoteBag);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag.id]);

  const handleToggleItem = (packId: string, itemId: string) =>
    updatePacks((packs) =>
      packs.map((p) =>
        p.id !== packId
          ? p
          : {
              ...p,
              items: p.items.map((i) =>
                i.id === itemId ? { ...i, checked: !i.checked } : i
              ),
            }
      )
    );

  const handleChangeItemText = (
    packId: string,
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) =>
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const items = p.items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                text,
                spans: undefined,
                ...(style
                  ? {
                      bold: style.bold,
                      strike: style.strike,
                      color: style.color,
                    }
                  : null),
              }
            : i
        );
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );

  const handleDeleteItem = (packId: string, itemId: string) =>
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const items = p.items.filter((i) => i.id !== itemId);
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );

  const handleAddItem = (packId: string, type: "check" | "text") =>
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const items = [
          ...p.items,
          { id: uid(), type, text: "", checked: false } as Item,
        ];
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );

  const handleRenamePack = (packId: string, name: string) =>
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const updated = { ...p, name };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );

  const handleChangePackColor = (packId: string, colorId: string | undefined) =>
    updatePacks((packs) =>
      packs.map((p) => (p.id !== packId ? p : { ...p, color: colorId }))
    );

  const handleAddPack = () =>
    updatePacks((packs) => [
      ...packs,
      { id: uid(), name: "새 팩", items: [] },
    ]);

  const handleImport = (imported: Pack[]) =>
    updatePacks((packs) => [...packs, ...imported].slice(0, 10));

  const handleDeletePack = (packId: string) =>
    updatePacks((packs) => packs.filter((p) => p.id !== packId));

  const handleMoveItem = (fromPackId: string, toPackId: string, itemId: string) => {
    if (fromPackId === toPackId) return;
    updatePacks((packs) => {
      const fromPack = packs.find((p) => p.id === fromPackId);
      const item = fromPack?.items.find((i) => i.id === itemId);
      if (!item) return packs;
      return packs.map((p) => {
        if (p.id === fromPackId) {
          const updated = { ...p, items: p.items.filter((i) => i.id !== itemId) };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        if (p.id === toPackId) {
          const updated = { ...p, items: [...p.items, item] };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        return p;
      });
    });
    show("짐을 옮겼어요");
  };

  const [drag, setDrag] = useState<{
    itemId: string;
    fromPackId: string;
    text: string;
    x: number;
    y: number;
    overPackId: string | null;
  } | null>(null);

  const handleStartItemDrag = (
    packId: string,
    itemId: string,
    text: string,
    clientX: number,
    clientY: number
  ) => {
    setDrag({ itemId, fromPackId: packId, text, x: clientX, y: clientY, overPackId: null });
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const packEl = el?.closest("[data-pack-drop-id]") as HTMLElement | null;
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overPackId } : d));
    };

    const handleUp = () => {
      setDrag((d) => {
        if (d && d.overPackId && d.overPackId !== d.fromPackId) {
          handleMoveItem(d.fromPackId, d.overPackId, d.itemId);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  // --- 팩 순서 드래그 -------------------------------------------------------
  // 짐 드래그(팩→팩 이동)와 별개로, 팩 카드 자체를 드래그해서 가방 안 팩들의
  // 순서를 바꾸는 기능. 같은 [data-pack-drop-id] 드롭존을 재사용한다.
  const [packDrag, setPackDrag] = useState<{
    packId: string;
    name: string;
    x: number;
    y: number;
    overPackId: string | null;
  } | null>(null);

  const handleStartPackDrag = (
    packId: string,
    name: string,
    clientX: number,
    clientY: number
  ) => {
    setPackDrag({ packId, name, x: clientX, y: clientY, overPackId: null });
  };

  const handleReorderPack = (fromPackId: string, toPackId: string) => {
    updatePacks((packs) => {
      const fromIndex = packs.findIndex((p) => p.id === fromPackId);
      const toIndex = packs.findIndex((p) => p.id === toPackId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return packs;
      const next = [...packs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    show("팩 순서를 바꿨어요");
  };

  useEffect(() => {
    if (!packDrag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const packEl = el?.closest("[data-pack-drop-id]") as HTMLElement | null;
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      setPackDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overPackId } : d));
    };

    const handleUp = () => {
      setPackDrag((d) => {
        if (d && d.overPackId && d.overPackId !== d.packId) {
          handleReorderPack(d.packId, d.overPackId);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packDrag !== null]);

  const [duplicateTarget, setDuplicateTarget] = useState<{
    packId: string;
    suggestedName: string;
  } | null>(null);

  const commitSaveToLibrary = (packId: string, nameOverride?: string) => {
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const name = (nameOverride ?? pack.name).trim();
    const newLibraryId = uid();
    onSaveAsLibraryPack({
      ...pack,
      id: newLibraryId,
      name,
      savedAsLibraryPack: undefined,
      linkedLibraryPackId: undefined,
      items: pack.items.map((i) => ({ ...i, id: uid() })),
    });
    updatePacks((packs) =>
      packs.map((p) =>
        p.id === packId
          ? {
              ...p,
              name,
              savedAsLibraryPack: true,
              linkedLibraryPackId: newLibraryId,
            }
          : p
      )
    );
    show("팩으로 저장했어요");
  };

  const handleSaveToLibrary = (packId: string) => {
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack || pack.savedAsLibraryPack) return;
    const nameTaken = libraryPacks.some(
      (p) => p.name.trim() === pack.name.trim()
    );
    if (nameTaken) {
      setDuplicateTarget({ packId, suggestedName: `${pack.name} (2)` });
      return;
    }
    commitSaveToLibrary(packId);
  };

  const handleRefreshFromLibrary = (packId: string) => {
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack?.linkedLibraryPackId) return;
    const source = libraryPacks.find((p) => p.id === pack.linkedLibraryPackId);
    if (!source) {
      show("원본 팩을 찾을 수 없어요");
      return;
    }
    updatePacks((packs) =>
      packs.map((p) =>
        p.id === packId
          ? {
              ...p,
              name: source.name,
              savedAsLibraryPack: true,
              items: source.items.map((i) => ({ ...i, id: uid() })),
            }
          : p
      )
    );
    show("팩을 다시 불러왔어요");
  };

  const handleToggleAllInPack = (packId: string, checked: boolean) =>
    updatePacks((packs) =>
      packs.map((p) =>
        p.id !== packId
          ? p
          : {
              ...p,
              items: p.items.map((i) => (i.type === "check" ? { ...i, checked } : i)),
            }
      )
    );

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toUpload = Array.from(files).slice(0, 3 - bag.images.length);
    setUploadingImages(true);
    try {
      const urls = await Promise.all(
        toUpload.map((f) => uploadBagImage(bag.id, f))
      );
      setBag((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch {
      show("이미지 업로드에 실패했어요");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx: number) => {
    const url = bag.images[idx];
    setBag((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
    deleteBagImage(url);
  };

  const handleSave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    isDirtyRef.current = false;
    onSave(bag);
    show("가방을 저장했어요");
  };

  const handleLeave = () => {
    setShowMembers(false);
    onLeaveBag(bag.id);
    onBack(bag);
    show("가방에서 나갔어요");
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={() => onBack(bag)} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={22} stroke={1.75} />
        </button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <PresenceBar bagId={bag.id} uid={currentUid} nickname={nickname} avatarId={avatarId} />
              <button
                onClick={() => setShowMembers(true)}
                aria-label="그룹원 관리"
                className="-m-2.5 p-2.5"
              >
                <IconUsers size={20} stroke={1.75} />
              </button>
            </>
          )}
          <button
            onClick={() => setConfirmDeleteBag(true)}
            aria-label="가방 삭제"
            className="-m-2.5 p-2.5"
          >
            <IconTrash size={19} stroke={1.75} color="var(--danger)" />
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            저장
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <EditableText
          value={bag.name}
          onChange={(name) => setBag((prev) => ({ ...prev, name }))}
          className="text-[18px] font-medium mb-2 block text-left"
          inputClassName="text-[18px] font-medium mb-2 block w-full"
          placeholder="새 가방"
        />

        <BagNotice
          value={bag.notice ?? ""}
          onChange={(notice) => setBag((prev) => ({ ...prev, notice }))}
        />

        <TravelDateField
          travelDate={bag.travelDate}
          reminderOffsets={bag.reminderOffsets}
          onChange={handleChangeTravelDate}
        />

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {bag.images.map((src, idx) => (
            <div
              key={idx}
              className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                onClick={() => setLightboxIndex(idx)}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.5)" }}
              >
                <IconX size={10} stroke={2} color="#fff" />
              </button>
            </div>
          ))}
          {bag.images.length < 3 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImages}
              className="shrink-0 h-14 w-14 rounded-lg border border-dashed border-border-strong flex items-center justify-center text-text-muted disabled:opacity-50"
            >
              <IconPhoto size={18} stroke={1.75} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleAddImages(e.target.files)}
          />
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setShowImport(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px]"
          >
            팩 불러오기
          </button>
          <button
            onClick={handleAddPack}
            disabled={bag.packs.length >= 10}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] flex items-center gap-1 disabled:opacity-40"
          >
            <IconPlus size={13} stroke={1.75} />팩
          </button>
        </div>

        {bag.packs.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">
            팩을 불러오거나 새로 만들어서 짐을 채워보세요.
          </p>
        ) : (
          <PackGrid
            packs={bag.packs}
            onToggleItem={handleToggleItem}
            onChangeItemText={handleChangeItemText}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
            onRenamePack={handleRenamePack}
            onChangeColor={handleChangePackColor}
            onToggleAll={handleToggleAllInPack}
            onSaveToLibrary={handleSaveToLibrary}
            onDeletePack={handleDeletePack}
            onRefreshFromLibrary={handleRefreshFromLibrary}
            onStartItemDrag={handleStartItemDrag}
            dragSourceItemId={drag?.itemId ?? null}
            dragOverPackId={drag?.overPackId ?? packDrag?.overPackId ?? null}
            onStartPackDrag={handleStartPackDrag}
            dragSourcePackId={packDrag?.packId ?? null}
          />
        )}
      </div>

      {drag && (
        <div
          className="fixed z-[95] pointer-events-none rounded-lg px-3 py-2 text-[13px] shadow-lg"
          style={{
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
            maxWidth: 160,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {drag.text || "짐"}
        </div>
      )}

      {packDrag && (
        <div
          className="fixed z-[95] pointer-events-none rounded-lg px-3 py-2 text-[13px] shadow-lg"
          style={{
            left: packDrag.x,
            top: packDrag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
            maxWidth: 160,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {packDrag.name || "팩"}
        </div>
      )}

      {showImport && (
        <PackImportModal
          libraryPacks={libraryPacks}
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {duplicateTarget && (
        <SaveAsDialog
          suggestedName={duplicateTarget.suggestedName}
          libraryPacks={libraryPacks}
          onCancel={() => setDuplicateTarget(null)}
          onConfirm={(name) => {
            commitSaveToLibrary(duplicateTarget.packId, name);
            setDuplicateTarget(null);
          }}
        />
      )}

      {showMembers && (
        <GroupMembersModal
          bag={bag}
          currentUid={currentUid}
          onClose={() => setShowMembers(false)}
          onLeave={handleLeave}
          onRemoveMember={handleRemoveMember}
          onRegenerateCode={handleRegenerateCode}
        />
      )}

      {confirmDeleteBag && (
        <ConfirmDialog
          title="이 가방을 삭제할까요?"
          message="가방에 담긴 모든 팩과 짐이 함께 사라져요."
          onCancel={() => setConfirmDeleteBag(false)}
          onConfirm={() => {
            setConfirmDeleteBag(false);
            onDeleteBag(bag);
          }}
        />
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={bag.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
