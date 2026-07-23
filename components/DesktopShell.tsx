"use client";

import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { Announcement, Bag, Item, Pack, UserProfile } from "@/lib/types";
import DesktopSidebar, { DesktopSelection } from "@/components/DesktopSidebar";
import BagEditorScreen from "@/components/screens/BagEditorScreen";
import PackLibraryEditorScreen from "@/components/screens/PackLibraryEditorScreen";
import PackNoteEditorScreen from "@/components/screens/PackNoteEditorScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import Portal from "@/components/Portal";

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
  requestUnlockForBag,
  requestUnlockForPack,
  onNewBag,
  onSaveBag,
  onDeleteBag,
  onSaveAsLibraryPack,
  onTrashPackFromBag,
  onLeaveBag,
  onRemoveMember,
  onRegenerateInviteCode,
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
  requestUnlockForBag: () => void;
  requestUnlockForPack: () => void;
  onNewBag: () => Promise<Bag | void>;
  onSaveBag: (bag: Bag) => void;
  onDeleteBag: (bag: Bag) => void;
  onSaveAsLibraryPack: (pack: Pack) => void;
  onTrashPackFromBag: (pack: Pack, sourceBagId: string, sourceBagName: string) => void;
  onLeaveBag: (bagId: string) => Promise<void>;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
  onAddItemsToBagPack: (bagId: string, packId: string, items: Item[]) => void;
  onRemoveItemsFromBagPack: (bagId: string, packId: string, itemIds: Set<string>) => void;
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => void;
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
  const [selection, setSelection] = useState<DesktopSelection | null>(null);
  const [packFocusItemId, setPackFocusItemId] = useState<string | null>(null);
  // 설정은 우측 패널 전체를 바꾸지 않고 모달로 띄운다 - 지금 보고 있던 가방/팝이 그대로 뒤에 남아있고, 닫으면 다시 그 화면으로 돌아온다.
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedBag =
    selection?.kind === "bag" ? bags.find((b) => b.id === selection.bagId) ?? null : null;
  const selectedPack =
    selection?.kind === "pack"
      ? [...libraryPacks, ...(quickPack ? [quickPack] : [])].find((p) => p.id === selection.packId) ?? null
      : null;

  // 선택된 가방/팩이 목록에서 사라지면(삭제 등) 우측 패널도 자동으로 비운다.
  useEffect(() => {
    if (selection?.kind === "bag" && !selectedBag) setSelection(null);
    if (selection?.kind === "pack" && !selectedPack) setSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBag, selectedPack, selection?.kind]);

  const handleNewBag = () => {
    onNewBag().then((created) => {
      if (created) setSelection({ kind: "bag", bagId: created.id });
    });
  };

  const handleNewPack = (parentId?: string, kind?: "checklist" | "editor") => {
    onNewPack(parentId, kind);
  };

  // 사이드바의 "설정 · 휴지통" 행을 누르면 selection(좌측 트리 선택)을 건드리지 않고
  // 따로 가지고 있는 settingsOpen만 켜서 모달로 띄운다.
  const handleSidebarSelect = (sel: DesktopSelection) => {
    if (sel.kind === "settings") {
      setSettingsOpen(true);
      return;
    }
    setSelection(sel);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <DesktopSidebar
        uid={user.uid}
        bags={bags}
        libraryPacks={libraryPacks}
        selection={selection}
        onSelect={handleSidebarSelect}
        onNewBag={handleNewBag}
        onNewPack={handleNewPack}
        onNewFolder={onNewFolder}
        onChangeColor={onChangePackColor}
        onRenamePackEntry={onRenamePackEntry}
        onMovePackEntries={onMovePackEntries}
        onDeletePackEntry={onDeletePack}
        settingsActive={settingsOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {!selection && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[14px] text-text-muted">왼쪽에서 가방이나 팩을 선택해주세요</p>
          </div>
        )}

        {selection?.kind === "bag" && selectedBag && (
          <BagEditorScreen
            key={selectedBag.id}
            initialBag={selectedBag}
            libraryPacks={libraryPacks.filter((p) => p.type !== "folder")}
            uid={user.uid}
            nickname={profile.nickname ?? ""}
            avatarId={profile.avatarId ?? ""}
            isNew={false}
            readOnly={lockedBagIds.has(selectedBag.id)}
            onRequestUnlock={requestUnlockForBag}
            onBack={() => setSelection(null)}
            onSave={onSaveBag}
            onDeleteBag={(bag) => {
              onDeleteBag(bag);
              setSelection(null);
            }}
            onSaveAsLibraryPack={onSaveAsLibraryPack}
            onTrashPackFromBag={onTrashPackFromBag}
            onLeaveBag={onLeaveBag}
            onRemoveMember={onRemoveMember}
            onRegenerateInviteCode={onRegenerateInviteCode}
            focusTarget={selection.focusPackId ? { packId: selection.focusPackId } : null}
            onFocusHandled={() => {}}
          />
        )}

        {selection?.kind === "pack" && selectedPack && selectedPack.kind === "editor" && (
          <PackNoteEditorScreen
            key={selectedPack.id}
            pack={selectedPack}
            readOnly={false}
            onBack={() => setSelection(null)}
            onSave={onSavePack}
            onDeletePack={() => {
              onDeletePack(selectedPack.id);
              setSelection(null);
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
            onBack={() => setSelection(null)}
            onSave={onSavePack}
            onSaveOtherPack={onSavePack}
            onDelete={(packId) => {
              onDeletePack(packId);
              setSelection(null);
            }}
            onAddItemsToBagPack={onAddItemsToBagPack}
            onRemoveItemsFromBagPack={onRemoveItemsFromBagPack}
            focusItemId={packFocusItemId}
            onFocusHandled={() => setPackFocusItemId(null)}
          />
        )}
      </div>

      {/* 설정은 우측 패널을 바꾸지 않고 작지 않은 모달로 띄운다 - 백드롭 클릭하면 닫힌다. */}
      {settingsOpen && (
        <Portal>
          <div
            className="fixed inset-0 z-[40] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
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
