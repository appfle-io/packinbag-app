"use client";

import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { useAuth } from "@/contexts/AuthProvider";
import { Announcement, Bag, Item, Pack, UserProfile } from "@/lib/types";
import DesktopSidebar, { DesktopSelection } from "@/components/DesktopSidebar";
import BagEditorScreen from "@/components/screens/BagEditorScreen";
import PackLibraryEditorScreen from "@/components/screens/PackLibraryEditorScreen";
import PackNoteEditorScreen from "@/components/screens/PackNoteEditorScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import DesktopQuickPackChatView from "@/components/DesktopQuickPackChatView";
import { isPremiumUser, getViewablePacks } from "@/lib/premiumLimits";
import { useToast } from "@/components/Toast";
import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// PC 웹 전용 레이아웃. 좌측 트리(가방/팩 보관함)에서 클릭한 항목을 우측 패널에 그대로
// 인라인으로 그린다 - 모바일에서 풀스크린으로 슬라이드-인 되던 BagEditorScreen/
// PackLibraryEditorScreen/PackNoteEditorScreen을 그대로 재사용한다(둘 다 h-dvh를
// 강제하지 않고 부모가 준 높이를 그대로 채우도록 이미 만들어져 있어서 별도 variant 없이도
// 우측 패널 안에 자연스럽게 들어간다).
export default function DesktopShell({
  user,
  profile,
  bags,
  libraryPacks,
  quickPack,
  lockedBagIds,
  selection,
  onSelectionChange,
  isNewBag,
  requestUnlockForBag,
  requestUnlockForPack,
  onNewBag,
  onSaveBag,
  onDeleteBag,
  onRenameBag,
  onSaveAsLibraryPack,
  onTrashPackFromBag,
  onLeaveBag,
  onRemoveMember,
  onRegenerateInviteCode,
  onTransferOwnership,
  onAddItemsToBagPack,
  onRemoveItemsFromBagPack,
  onNewPack,
  onNewFolder,
  onChangePackColor,
  onRenamePackEntry,
  onMovePackEntries,
  onSavePack,
  onDeletePack,
  // SettingsScreen 그대로 전달용
  announcements,
  dismissedAnnouncementIds,
  onDismissAnnouncement,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  trashedBags,
  trashedPacks,
  onRestoreBag,
  onPermanentDeleteBag,
  onRestorePack,
  onPermanentDeletePack,
}: {
  user: User;
  profile: UserProfile;
  bags: Bag[];
  libraryPacks: Pack[];
  quickPack?: Pack;
  lockedBagIds: Set<string>;
  // 지금 어느 가방/팩이 선택되어 우측 패널에 열려있는지. 예전엔 이 컴포넌트 자체의
  // 로컬 state로 관리했는데, 그러면 창 폭이 바뀌어 모바일<->데스크톱 레이아웃이 전환되는
  // 순간(AppShell이 isDesktop 값에 따라 이 컴포넌트 자체를 통채로 안 그리고 다른 트리를 그린다)
  // 이 selection이 통채로 사라져버려서 열어두었던 가방/패이 홈 화면으로 튀기는 심각한 버그가
  // 있었다. 이제는 AppShell이 자기 자신의(editingBag/editingPack) 상태에서 그대로 유도해서 이 컴포넌트에
  // props로 내려준다 - AppShell 자체는 isDesktop이 바뀝도 unmount되지 않으므로 그 상태가 그대로 살아남는다.
  selection: DesktopSelection | null;
  onSelectionChange: (sel: DesktopSelection | null) => void;
  isNewBag: boolean;
  requestUnlockForBag: () => void;
  requestUnlockForPack: () => void;
  onNewBag: () => Promise<Bag | void>;
  onSaveBag: (bag: Bag) => void;
  onDeleteBag: (bag: Bag) => void;
  onRenameBag: (bag: Bag, name: string) => void;
  onSaveAsLibraryPack: (pack: Pack) => void;
  onTrashPackFromBag: (pack: Pack, sourceBagId: string, sourceBagName: string) => void;
  onLeaveBag: (bagId: string) => Promise<void>;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
  onTransferOwnership: (bagId: string, targetUid: string) => Promise<void>;
  onAddItemsToBagPack: (bagId: string, packId: string, items: Item[]) => void;
  onRemoveItemsFromBagPack: (bagId: string, packId: string, itemIds: Set<string>) => void;
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => Promise<Pack | void> | Pack | void;
  onNewFolder: (parentId?: string) => void;
  onChangePackColor: (pack: Pack, colorId: string | undefined) => void;
  onRenamePackEntry: (pack: Pack, name: string) => void;
  onMovePackEntries: (packIds: string[], parentId: string | undefined) => void;
  onSavePack: (pack: Pack) => void;
  onDeletePack: (packId: string) => void;
  announcements: Announcement[];
  dismissedAnnouncementIds: string[];
  onDismissAnnouncement: (id: string) => void;
  onCreateAnnouncement: (data: Omit<Announcement, "id" | "createdAt">) => Promise<void>;
  onUpdateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  trashedBags: Bag[];
  trashedPacks: Pack[];
  onRestoreBag: (bagId: string) => Promise<void>;
  onPermanentDeleteBag: (bag: Bag) => Promise<void>;
  onRestorePack: (packId: string) => Promise<void>;
  onPermanentDeletePack: (packId: string) => Promise<void>;
}) {
  const { show } = useToast();
  const { moveBagToFolder } = useAuth();
  // 지금 드래그하는 본인 기준 프리미엄 여부 - 빠른팩 항목을 드롭할 때
  // 다른 멤버가 만든 AI추천 팩(aiRecommendSource)이 안 보이는데도 그쪽으로 들어가는 일을 막는다.
  const premium = isPremiumUser(user.email, profile);
  const [packFocusItemId, setPackFocusItemId] = useState<string | null>(null);
  // 설정은 우측 패널 전체를 바꾸지 않고 모달로 띄운다 - 지금 보고 있던 가방/팝이 그대로 뒤에 남아있고, 닫으면 다시 그 화면으로 돌아온다.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(() => setSettingsOpen(false), settingsOpen);

  const selectedBag =
    selection?.kind === "bag" ? bags.find((b) => b.id === selection.bagId) ?? null : null;
  const selectedPack =
    selection?.kind === "pack"
      ? [...libraryPacks, ...(quickPack ? [quickPack] : [])].find((p) => p.id === selection.packId) ?? null
      : null;

  // 선택된 가방/팩이 목록에서 사라지면(삭제 등) 우측 패널도 자동으로 비운다.
  useEffect(() => {
    if (selection?.kind === "bag" && !selectedBag) onSelectionChange(null);
    if (selection?.kind === "pack" && !selectedPack) onSelectionChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBag, selectedPack, selection?.kind]);

  const handleNewBag = (folderId?: string) => {
    onNewBag().then((created) => {
      if (created) {
        onSelectionChange({ kind: "bag", bagId: created.id });
        if (folderId) moveBagToFolder(created.id, folderId).catch(() => {});
      }
    });
  };

  const handleNewPack = (parentId?: string, kind?: "checklist" | "editor") => {
    Promise.resolve(onNewPack(parentId, kind)).then((created) => {
      if (created) {
        onSelectionChange({ kind: "pack", packId: created.id });
      }
    });
  };

  // 사이드바의 "설정 · 휴지통" 행을 누르면 selection(좌측 트리 선택)을 건드리지 않고
  // 따로 가지고 있는 settingsOpen만 켜서 모달로 띄운다.
  const handleSidebarSelect = (sel: DesktopSelection) => {
    if (sel.kind === "settings") {
      setSettingsOpen(true);
      return;
    }
    onSelectionChange(sel);
  };

  const handleDropQuickPackItems = (
    targetType: "bag" | "pack",
    targetId: string,
    items: Item[]
  ) => {
    if (targetType === "bag") {
      const bag = bags.find((b) => b.id === targetId);
      if (bag) {
        let targetPack = getViewablePacks(bag.packs, premium).find((p) => p.kind !== "editor");
        if (targetPack) {
          onAddItemsToBagPack(bag.id, targetPack.id, items);
          if (quickPack) {
            const itemIds = new Set(items.map((i) => i.id));
            onSavePack({
              ...quickPack,
              items: quickPack.items.filter((i) => !itemIds.has(i.id)),
            });
          }
          show(`'${bag.name}' > '${targetPack.name}' 가방으로 짐 ${items.length}개를 이동했어요!`);
        } else {
          const newPack: Pack = {
            id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: "새 팩",
            items: items,
          };
          const updatedBag: Bag = {
            ...bag,
            packs: [...bag.packs, newPack],
            updatedAt: new Date().toISOString(),
          };
          onSaveBag(updatedBag);
          if (quickPack) {
            const itemIds = new Set(items.map((i) => i.id));
            onSavePack({
              ...quickPack,
              items: quickPack.items.filter((i) => !itemIds.has(i.id)),
            });
          }
          show(`'${bag.name}' 가방으로 짐 ${items.length}개를 이동했어요!`);
        }
      }
    } else if (targetType === "pack") {
      const pack = libraryPacks.find((p) => p.id === targetId);
      if (pack) {
        if (pack.type === "folder") {
          const childPacks = libraryPacks.filter((p) => p.parentId === pack.id && p.type !== "folder");
          if (childPacks.length > 0) {
            const targetChild = childPacks[0];
            onSavePack({
              ...targetChild,
              items: [...targetChild.items, ...items],
            });
            show(`'${pack.name}' > '${targetChild.name}' 팩 보관함으로 짐 ${items.length}개를 이동했어요!`);
          } else {
            show(`'${pack.name}' 폴더는 비어있어요. 팩을 하나 만든 후 담아주세요.`);
            return;
          }
        } else {
          onSavePack({
            ...pack,
            items: [...pack.items, ...items],
          });
          show(`'${pack.name}' 팩 보관함으로 짐 ${items.length}개를 이동했어요!`);
        }

        if (quickPack) {
          const itemIds = new Set(items.map((i) => i.id));
          onSavePack({
            ...quickPack,
            items: quickPack.items.filter((i) => !itemIds.has(i.id)),
          });
        }
      }
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface">
      <DesktopSidebar
        uid={user.uid}
        bags={bags}
        libraryPacks={libraryPacks}
        selection={selection}
        onSelect={handleSidebarSelect}
        onNewBag={handleNewBag}
        onDeleteBag={onDeleteBag}
        onRenameBag={onRenameBag}
        onNewPack={handleNewPack}
        onNewFolder={onNewFolder}
        onChangeColor={onChangePackColor}
        onRenamePackEntry={onRenamePackEntry}
        onMovePackEntries={onMovePackEntries}
        onDeletePackEntry={onDeletePack}
        onDropQuickPackItems={handleDropQuickPackItems}
        settingsActive={settingsOpen}
      />

      <main className="flex-1 flex flex-col min-w-0 h-full p-2.5 pl-1.5 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 h-full rounded-2xl border border-border bg-background shadow-xs overflow-hidden relative">
          {!selection && (
            <DesktopQuickPackChatView
              quickPack={quickPack}
              bags={bags}
              libraryPacks={libraryPacks}
              onSavePack={onSavePack}
              onAddItemsToBagPack={onAddItemsToBagPack}
            />
          )}

          {selection?.kind === "bag" && selectedBag && (
            <BagEditorScreen
              key={selectedBag.id}
              initialBag={selectedBag}
              libraryPacks={libraryPacks}
              bags={bags}
              uid={user.uid}
              nickname={profile.nickname ?? ""}
              avatarId={profile.avatarId ?? ""}
              isNew={isNewBag}
              readOnly={lockedBagIds.has(selectedBag.id)}
              onRequestUnlock={requestUnlockForBag}
              onBack={() => onSelectionChange(null)}
              onSave={onSaveBag}
              onDeleteBag={(bag) => {
                onDeleteBag(bag);
                onSelectionChange(null);
              }}
              onSaveAsLibraryPack={onSaveAsLibraryPack}
              onTrashPackFromBag={onTrashPackFromBag}
              onLeaveBag={onLeaveBag}
              onRemoveMember={onRemoveMember}
              onRegenerateInviteCode={onRegenerateInviteCode}
              onTransferOwnership={onTransferOwnership}
              focusTarget={selection.focusPackId ? { packId: selection.focusPackId } : null}
              onFocusHandled={() => onSelectionChange({ kind: "bag", bagId: selectedBag.id })}
            />
          )}

          {selection?.kind === "pack" && selectedPack && selectedPack.kind === "editor" && (
            <PackNoteEditorScreen
              key={selectedPack.id}
              pack={selectedPack}
              readOnly={false}
              onBack={() => onSelectionChange(null)}
              onSave={onSavePack}
              onDeletePack={() => {
                onDeletePack(selectedPack.id);
                onSelectionChange(null);
              }}
            />
          )}

          {selection?.kind === "pack" && selectedPack && selectedPack.kind !== "editor" && (
            <PackLibraryEditorScreen
              key={selectedPack.id}
              variant="sheet"
              initialPack={selectedPack}
              libraryPacks={libraryPacks.filter((p) => p.type !== "folder")}
              bags={bags}
              lockedBagIds={lockedBagIds}
              readOnly={!!selectedPack.locked}
              onRequestUnlock={requestUnlockForPack}
              onBack={() => onSelectionChange(null)}
              onSave={onSavePack}
              onSaveOtherPack={onSavePack}
              onDelete={(packId) => {
                onDeletePack(packId);
                onSelectionChange(null);
              }}
              onAddItemsToBagPack={onAddItemsToBagPack}
              onRemoveItemsFromBagPack={onRemoveItemsFromBagPack}
              focusItemId={packFocusItemId}
              onFocusHandled={() => setPackFocusItemId(null)}
            />
          )}
        </div>
      </main>

      {/* 설정은 우측 패널을 바꾸지 않고 작지 않은 모달로 띄운다 - 백드롭 클릭하면 닫힌다. */}
      {settingsOpen && (
        <Portal>
          <div
            className="fixed inset-0 flex items-center justify-center backdrop-blur-xs"
            style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setSettingsOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col overflow-hidden rounded-2xl shadow-2xl"
              style={{
                width: "min(900px, 92vw)",
                height: "min(760px, 88vh)",
                background: "var(--background)",
              }}
            >
              <SettingsScreen
                uid={user.uid}
                announcements={announcements}
                dismissedAnnouncementIds={dismissedAnnouncementIds}
                onDismissAnnouncement={onDismissAnnouncement}
                onCreateAnnouncement={onCreateAnnouncement}
                onUpdateAnnouncement={onUpdateAnnouncement}
                onDeleteAnnouncement={onDeleteAnnouncement}
                trashedBags={trashedBags}
                trashedPacks={trashedPacks}
                onRestoreBag={onRestoreBag}
                onPermanentDeleteBag={onPermanentDeleteBag}
                onRestorePack={onRestorePack}
                onPermanentDeletePack={onPermanentDeletePack}
                onBack={() => setSettingsOpen(false)}
                hideNotificationBell
                embedded
              />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
