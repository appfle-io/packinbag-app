"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconPhoto,
  IconPlus,
  IconX,
  IconTrash,
  IconUsers,
  IconSparkles,
  IconLock,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconFileText,
} from "@tabler/icons-react";
import { Bag, Item, Pack, ReminderOffset } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import EditableText from "@/components/EditableText";
import BagNotice from "@/components/BagNotice";
import TravelDateField from "@/components/TravelDateField";
import PackGrid from "@/components/PackGrid";
import PackChipBar from "@/components/PackChipBar";
import ItemFormModal from "@/components/ItemFormModal";
import PackImportModal from "@/components/PackImportModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SaveAsDialog from "@/components/SaveAsDialog";
import PackUpdateDialog from "@/components/PackUpdateDialog";
import GroupMembersModal from "@/components/GroupMembersModal";
import AiOrganizeModal from "@/components/AiOrganizeModal";
import { useToast } from "@/components/Toast";
import { uploadBagImage, deleteBagImage } from "@/lib/storageService";
import { subscribeToBag, saveBagRemote } from "@/lib/bagsService";
import { deleteLibraryPackRemote } from "@/lib/packsService";
import { isInSyncWithLibrary } from "@/lib/packSync";
import { firebaseErrorCode } from "@/lib/errorMessage";
import PresenceBar from "@/components/PresenceBar";
import ImageLightbox from "@/components/ImageLightbox";
import { MAX_BAG_IMAGES } from "@/lib/premiumLimits";
import { useSwipeBack } from "@/lib/useSwipeBack";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// PDF is not compressed like images (compressImageFile skips non-image files and returns
// them as-is), so it can be uploaded at full size. Keep a size cap here to avoid huge files.
const MAX_BAG_PDF_BYTES = 3 * 1024 * 1024;

// Firebase Storage download URLs keep the original filename (with extension) right before the
// "?" query string (see lib/storageService.ts), so we can tell PDFs apart from images by that.
function isPdfUrl(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

export default function BagEditorScreen({
  initialBag,
  libraryPacks,
  uid: currentUid,
  nickname,
  avatarId,
  isNew,
  readOnly,
  onRequestUnlock,
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
  // true면 무료 전환으로 잠긴(내 소유) 가방. 보기만 가능하고 모든 수정/삭제/공유 동작이 막힌다.
  readOnly: boolean;
  // 잠긴 상태에서 수정을 시도하면 이용권 등록을 유도하는 모달을 띄우기 위해 AppShell에 알린다.
  onRequestUnlock: () => void;
  onBack: (currentBag: Bag) => void;
  onSave: (bag: Bag) => void;
  onDeleteBag: (bag: Bag) => void;
  onSaveAsLibraryPack: (pack: Pack) => void;
  onLeaveBag: (bagId: string) => Promise<void>;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
}) {
  const [bag, setBag] = useState<Bag>(initialBag);
  const [showImport, setShowImport] = useState(false);
  const [showAiOrganize, setShowAiOrganize] = useState(false);
  const [confirmDeleteBag, setConfirmDeleteBag] = useState(false);
  const [confirmLeaveUnsaved, setConfirmLeaveUnsaved] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageDeleteIndex, setImageDeleteIndex] = useState<number | null>(null);
  const [refreshConfirmTarget, setRefreshConfirmTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();
  const { profile } = useAuth();

  // 설정 > 팩 설정 > "가방 열 때 팩 접어서 보기"가 켜져 있으면, 이 화면에 처음 들어온
  // 순간에만 모든 팩을 접힌 상태로 보여준다. 저장된 Pack.displayState는 전혀 건드리지
  // 않고(=자동저장 대상이 아님) 화면에 그리는 값만 아래 effectivePacks에서 덮어쓴다.
  // 사용자가 개별/전체 펼치기·접기 컨트롤을 한 번이라도 쓰면 그 순간 꺼지고, 이후부터는
  // 평소처럼 저장된 displayState 그대로를 보여준다(다음에 다시 들어오면 또 접힌 채로 시작).
  const [collapseOverrideActive, setCollapseOverrideActive] = useState(
    !!profile?.packSettings?.alwaysCollapseOnEntry
  );

  // 잠긴 가방에서 수정을 시도하는 모든 진입점의 공용 방어선. true를 반환하면(=막혔으면)
  // 호출한 쪽에서 그대로 return해서 실제 상태 변경으로 이어지지 않게 한다. 모달이 열려있는
  // 상태(onRequestUnlock)로 이용권 등록을 바로 유도한다.
  const guardReadOnly = (): boolean => {
    if (!readOnly) return false;
    onRequestUnlock();
    return true;
  };

  // 새로 만드는 중(isNew)에 "저장" 버튼을 아직 누르지 않았는데 로컬 변경이 하나라도
  // 생겼는지 추적한다. true인 상태로 뒤로가기/스와이프 하면 그대로 나가도 되는지 확인
  // 다이얼로그를 띄운다 - 실제 삭제(handleBackFromEditor의 임시 가방 정리)는 그대로 두고,
  // 그 직전에 한 번 더 물어보는 역할만 한다.
  const hasUnsavedChangesRef = useRef(false);
  const handleBackAttempt = () => {
    if (isNew && hasUnsavedChangesRef.current) {
      setConfirmLeaveUnsaved(true);
      return;
    }
    onBack(bag);
  };
  const swipeBackRef = useSwipeBack<HTMLDivElement>(handleBackAttempt);

  const handleRemoveMember = async (memberUid: string) => {
    if (guardReadOnly()) return;
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
    if (guardReadOnly()) return;
    const newCode = await onRegenerateInviteCode(bag);
    setBag((prev) => ({ ...prev, inviteCode: newCode }));
  };

  const handleChangeTravelDate = (
    travelDate: string | undefined,
    reminderOffsets: ReminderOffset[] | undefined
  ) => {
    if (guardReadOnly()) return;
    setBag((prev) => ({ ...prev, travelDate, reminderOffsets }));
  };

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
    hasUnsavedChangesRef.current = true;
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

  // 화면을 나갈 때(뒤로가기/스와이프/탭 전환 등 어떤 경로로든 이 화면이 사라질 때)
  // 아직 디바운스 대기 중이라 서버에 반영되지 않은 변경이 있으면 그 즉시 저장한다.
  // PackLibraryEditorScreen에는 이미 있는 안전장치인데 이 화면엔 빠져 있었다 -
  // 그 사이(최대 500ms) 수정하고 바로 나가면 그 변경이 조용히 사라지는 문제가 있었음.
  const bagRef = useRef(bag);
  useEffect(() => {
    bagRef.current = bag;
  }, [bag]);
  // isNew는 "새 가방 -> 최초 저장 완료" 시점에 false로 바뀌는데, 이 화면은 그때
  // 리마운트되지 않고 그대로 유지된다. 아래 언마운트 effect는 []依존성이라 클로저가
  // 마운트 시점 값을 그대로 들고 있으므로, 최신 값을 보려면 ref로 따로 추적해야 한다.
  const isNewRef = useRef(isNew);
  useEffect(() => {
    isNewRef.current = isNew;
  }, [isNew]);
  useEffect(() => {
    return () => {
      // 새로 만들다가 버리는 가방(isNew)은 별도의 "저장하지 않은 내용이 있어요"
      // 확인 다이얼로그 + 임시 가방 삭제 흐름(AppShell.handleBackFromEditor)이 이미
      // 처리한다. 여기서 또 저장을 시도하면 삭제 중인 가방을 되살리는 경합이 생길 수
      // 있어 기존 가방(!isNew)에서 자동저장 대기 중일 때만 나가기 전 flush한다.
      if (isNewRef.current || !autosaveTimerRef.current || !isDirtyRef.current) return;
      window.clearTimeout(autosaveTimerRef.current);
      saveBagRemote(bagRef.current)
        .then(() => show("나가기 전 변경사항을 저장했어요"))
        .catch((err) => {
          console.error("[팩인백] 나가기 전 자동저장 실패:", err);
          show(`나가기 전 변경사항 저장에 실패했어요 (${firebaseErrorCode(err)})`);
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 다른 멤버가 이 가방을 동시에 보고 있을 때 그들의 변경(체크/이름/짐/팩 등 전부)을
  // 실시간으로 반영한다. 단, 내가 방금 만든 로컬 변경이 아직 서버로 안 나갔거나(디바운스
  // 대기 중) 저장 중이면(isDirtyRef) 그 사이에 들어온 원격 변경은 건너뛴다 - 곧 내가
  // 보낼 저장이 그 시점 기준 최신 상태를 다시 반영하기 때문에, 여기서 섞어 넣으면
  // 오히려 화면이 잠깐 깜빡이거나 아직 저장 안 한 내 편집을 잃을 수 있다.
  // 이 구독은 locked 필드도 그대로 실어오므로, 다른 곳(app/api/sync-lock-status)에서
  // 잠금 상태가 바뀌면 이 화면도 곧바로 반영된다(=readOnly prop이 AppShell에서 다시 계산됨).
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

  const handleToggleItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
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
  };

  const handleChangeItemText = (
    packId: string,
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => {
    if (guardReadOnly()) return;
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
  };

  const handleDeleteItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
    let removedItem: Item | undefined;
    let removedIndex = -1;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        removedIndex = p.items.findIndex((i) => i.id === itemId);
        removedItem = p.items[removedIndex];
        const items = p.items.filter((i) => i.id !== itemId);
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
    if (removedItem) {
      const restored = removedItem;
      const restoreIndex = removedIndex;
      show("짐을 삭제했어요", {
        actionLabel: "되돌리기",
        onAction: () => {
          updatePacks((packs) =>
            packs.map((p) => {
              if (p.id !== packId) return p;
              const items = [...p.items];
              items.splice(Math.min(restoreIndex, items.length), 0, restored);
              const updated = { ...p, items };
              return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
            })
          );
        },
      });
    }
  };

  // "체크항목"/"텍스트" 버튼을 누르면 바로 빈 짐을 만들던 예전 방식 대신,
  // 어떤 팩에서 시작했는지/타입만 기억해두고 중앙 모달(ItemFormModal)을 연다.
  // 실제 짐 생성은 모달의 저장 버튼(handleCreateItem)에서 이뤄진다.
  const [itemModal, setItemModal] = useState<
    | { mode: "add"; sourcePackId: string; type: "check" | "text" }
    | { mode: "edit"; sourcePackId: string; item: Item }
    | null
  >(null);

  const handleOpenAddItem = (packId: string, type: "check" | "text") => {
    if (guardReadOnly()) return;
    setItemModal({ mode: "add", sourcePackId: packId, type });
  };

  const handleOpenEditItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    const item = pack?.items.find((i) => i.id === itemId);
    if (!item) return;
    setItemModal({ mode: "edit", sourcePackId: packId, item });
  };

  const handleCreateItem = (
    targetPackId: string,
    data: { type: "check" | "text"; text: string; bold?: boolean; strike?: boolean; color?: string }
  ) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== targetPackId) return p;
        const newItem: Item = {
          id: uid(),
          type: data.type,
          text: data.text,
          ...(data.type === "check"
            ? { checked: false }
            : { bold: data.bold, strike: data.strike, color: data.color }),
        };
        const items = [...p.items, newItem];
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
  };

  // 짐 수정 모달의 저장 처리. 같은 팩을 유지하면 원래 위치 그대로 내용만 갱신하고,
  // 모달에서 다른 팩으로 바꿔서 저장하면 기존 드래그 이동(handleMoveItem)처럼 원래
  // 팩에서 제거하고 대상 팩 맨 끝에 추가한다.
  const handleUpdateItem = (
    sourcePackId: string,
    itemId: string,
    targetPackId: string,
    data: { type: "check" | "text"; text: string; bold?: boolean; strike?: boolean; color?: string }
  ) => {
    if (guardReadOnly()) return;
    updatePacks((packs) => {
      const sourcePack = packs.find((p) => p.id === sourcePackId);
      const original = sourcePack?.items.find((i) => i.id === itemId);
      if (!original) return packs;

      const updatedItem: Item = {
        id: original.id,
        type: data.type,
        text: data.text,
        ...(data.type === "check"
          ? { checked: original.type === "check" ? original.checked : false }
          : { bold: data.bold, strike: data.strike, color: data.color }),
      };

      if (sourcePackId === targetPackId) {
        return packs.map((p) => {
          if (p.id !== sourcePackId) return p;
          const items = p.items.map((i) => (i.id === itemId ? updatedItem : i));
          const updated = { ...p, items };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        });
      }

      return packs.map((p) => {
        if (p.id === sourcePackId) {
          const updated = { ...p, items: p.items.filter((i) => i.id !== itemId) };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        if (p.id === targetPackId) {
          const updated = { ...p, items: [...p.items, updatedItem] };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        return p;
      });
    });
    if (sourcePackId !== targetPackId) show("짐을 옮겼어요");
  };

  const handleRenamePack = (packId: string, name: string) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const updated = { ...p, name };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
  };

  // 10개 캡을 "+팩" 버튼의 disabled 속성뿐 아니라 함수 자체에도 걸어둔다 - 그래야
  // PackImportModal의 "새 팩 만들기"처럼 disabled 체크가 없는 다른 진입점에서
  // 호출해도 안전하다. 캡에 걸리면 조용히 무시하지 않고 이유를 알려준다.
  const handleAddPack = () => {
    if (guardReadOnly()) return;
    if (bag.packs.length >= 10) {
      show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
      return;
    }
    updatePacks((packs) => [...packs, { id: uid(), name: "새 팩", items: [] }]);
  };

  const handleImport = (imported: Pack[]) => {
    if (guardReadOnly()) return;
    updatePacks((packs) => [...packs, ...imported].slice(0, 10));
  };

  const handleDeletePack = (packId: string, alsoDeleteLibrary: boolean) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    updatePacks((packs) => packs.filter((p) => p.id !== packId));
    if (alsoDeleteLibrary && pack?.linkedLibraryPackId) {
      deleteLibraryPackRemote(currentUid, pack.linkedLibraryPackId).catch((err) => {
        console.error("[팩인백] 라이브러리 팩 삭제 실패:", err);
        show("라이브러리에서는 삭제하지 못했어요");
      });
    }
    show(alsoDeleteLibrary ? "팩을 가방과 라이브러리에서 모두 삭제했어요" : "팩을 가방에서 삭제했어요");
  };

  // 팩 카드 개별 토글(넓히기/접기)에서 호출되는 경우와, 상단 전체 컨트롤(접기/기본/펼치기)에서
  // 모든 팩을 한번에 바꿀 때 둘 다 이 함수만 쓸 수 있다. "가방 열 때 팩 접어서 보기" 설정으로
  // 화면에 임시로 접힌 것처럼 보여주고 있던 상태(collapseOverrideActive)라면, 사용자가 실제로
  // 펼치기/접기를 조작하는 순간이므로 그 임시 오버라이드는 끄고 저장된 값을 그대로 따르게 한다.
  const handleChangeDisplayState = (
    packId: string,
    nextState: "normal" | "wide" | "collapsed"
  ) => {
    if (guardReadOnly()) return;
    setCollapseOverrideActive(false);
    updatePacks((packs) =>
      packs.map((p) => (p.id === packId ? { ...p, displayState: nextState } : p))
    );
  };

  const handleSetAllDisplayState = (nextState: "normal" | "wide" | "collapsed") => {
    if (guardReadOnly()) return;
    setCollapseOverrideActive(false);
    updatePacks((packs) => packs.map((p) => ({ ...p, displayState: nextState })));
  };

  // fromPackId === toPackId면 같은 팩 안에서 overItemId 위치로 순서를 바꾸고,
  // 다르면 기존처럼 다른 팩으로 옮긴다.
  const handleMoveItem = (
    fromPackId: string,
    toPackId: string,
    itemId: string,
    overItemId?: string | null
  ) => {
    if (guardReadOnly()) return;
    if (fromPackId === toPackId) {
      if (!overItemId || overItemId === itemId) return;
      updatePacks((packs) =>
        packs.map((p) => {
          if (p.id !== fromPackId) return p;
          const item = p.items.find((i) => i.id === itemId);
          if (!item) return p;
          const withoutItem = p.items.filter((i) => i.id !== itemId);
          const targetIndex = withoutItem.findIndex((i) => i.id === overItemId);
          if (targetIndex === -1) return p;
          return {
            ...p,
            items: [
              ...withoutItem.slice(0, targetIndex),
              item,
              ...withoutItem.slice(targetIndex),
            ],
          };
        })
      );
      return;
    }
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
    overItemId: string | null;
  } | null>(null);

  const handleStartItemDrag = (
    packId: string,
    itemId: string,
    text: string,
    clientX: number,
    clientY: number
  ) => {
    if (guardReadOnly()) return;
    setDrag({
      itemId,
      fromPackId: packId,
      text,
      x: clientX,
      y: clientY,
      overPackId: null,
      overItemId: null,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const packEl = el?.closest("[data-pack-drop-id]") as HTMLElement | null;
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
      const overItemId = itemEl?.getAttribute("data-item-id") ?? null;
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overPackId, overItemId } : d));
    };

    const handleUp = () => {
      setDrag((d) => {
        if (d && d.overPackId) {
          handleMoveItem(d.fromPackId, d.overPackId, d.itemId, d.overItemId);
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
    if (guardReadOnly()) return;
    setPackDrag({ packId, name, x: clientX, y: clientY, overPackId: null });
  };

  const handleReorderPack = (fromPackId: string, toPackId: string) => {
    if (guardReadOnly()) return;
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
  const [saveConfirmTarget, setSaveConfirmTarget] = useState<string | null>(null);
  const [updateChoiceTarget, setUpdateChoiceTarget] = useState<{
    packId: string;
    conflict: boolean;
  } | null>(null);

  const commitSaveToLibrary = (packId: string, nameOverride?: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const name = (nameOverride ?? pack.name).trim();
    const newLibraryId = uid();
    const now = new Date().toISOString();
    onSaveAsLibraryPack({
      ...pack,
      id: newLibraryId,
      name,
      updatedAt: now,
      savedAsLibraryPack: undefined,
      linkedLibraryPackId: undefined,
      linkedLibraryUpdatedAt: undefined,
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
              linkedLibraryUpdatedAt: now,
            }
          : p
      )
    );
    show("팩으로 저장했어요");
  };

  const handleSaveToLibrary = (packId: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    if (!pack.linkedLibraryPackId) {
      // 아직 한 번도 저장한 적 없는 팩 -> 저장 여부 확인
      setSaveConfirmTarget(packId);
      return;
    }
    // 캐시된 값(savedAsLibraryPack)이 아니라 지금 이 순간의 라이브러리 기준으로 다시 비교한다.
    // 다른 가방/기기에서 같은 라이브러리 팩을 먼저 바꿔놨을 수도 있기 때문에, 화면에 남아있는
    // 예전 상태만 믿으면 "변경사항 없음"을 잘못 판단할 수 있다.
    if (isInSyncWithLibrary(pack, libraryPacks)) {
      show("변경사항이 없어요");
      return;
    }
    // 저장된 적 있는데 지금 보니 라이브러리랑 다름 -> 그게 "내가 방금 고쳐서"인지
    // "다른 가방이 먼저 라이브러리를 바꿔놔서"인지 구분해서, 후자면 덮어쓰기를 막는다.
    const source = libraryPacks.find((p) => p.id === pack.linkedLibraryPackId);
    const conflict =
      !!source &&
      !!pack.linkedLibraryUpdatedAt &&
      !!source.updatedAt &&
      source.updatedAt > pack.linkedLibraryUpdatedAt;
    setUpdateChoiceTarget({ packId, conflict });
  };

  const confirmInitialSave = (packId: string) => {
    if (guardReadOnly()) return;
    setSaveConfirmTarget(null);
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const nameTaken = libraryPacks.some(
      (p) => p.name.trim() === pack.name.trim()
    );
    if (nameTaken) {
      setDuplicateTarget({ packId, suggestedName: `${pack.name} (2)` });
      return;
    }
    commitSaveToLibrary(packId);
  };

  const handleChooseSaveAsNew = (packId: string) => {
    if (guardReadOnly()) return;
    setUpdateChoiceTarget(null);
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const nameTaken = libraryPacks.some(
      (p) => p.id !== pack.linkedLibraryPackId && p.name.trim() === pack.name.trim()
    );
    if (nameTaken) {
      setDuplicateTarget({ packId, suggestedName: `${pack.name} (2)` });
      return;
    }
    commitSaveToLibrary(packId);
  };

  const commitOverwriteToLibrary = (packId: string) => {
    if (guardReadOnly()) return;
    setUpdateChoiceTarget(null);
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack?.linkedLibraryPackId) return;
    const name = pack.name.trim();
    const now = new Date().toISOString();
    onSaveAsLibraryPack({
      ...pack,
      id: pack.linkedLibraryPackId,
      name,
      updatedAt: now,
      savedAsLibraryPack: undefined,
      linkedLibraryPackId: undefined,
      linkedLibraryUpdatedAt: undefined,
      items: pack.items.map((i) => ({ ...i })),
    });
    updatePacks((packs) =>
      packs.map((p) =>
        p.id === packId
          ? { ...p, name, savedAsLibraryPack: true, linkedLibraryUpdatedAt: now }
          : p
      )
    );
    show("팩을 덮어썼어요");
  };

  const handleRefreshFromLibrary = (packId: string) => {
    if (guardReadOnly()) return;
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
              linkedLibraryUpdatedAt: source.updatedAt,
              items: source.items.map((i) => ({ ...i, id: uid() })),
            }
          : p
      )
    );
    show("팩을 다시 불러왔어요");
  };

  const handleToggleAllInPack = (packId: string, checked: boolean) => {
    if (guardReadOnly()) return;
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
  };

  const handleAddImages = async (files: FileList | null) => {
    if (guardReadOnly()) return;
    if (!files || files.length === 0) return;
    const toUpload = Array.from(files).slice(0, MAX_BAG_IMAGES - bag.images.length);
    // PDF is not compressed on upload, so reject oversized PDFs here before spending
    // an upload attempt (images are still compressed down automatically as before).
    const oversizedPdf = toUpload.find((f) => {
      const looksLikePdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      return looksLikePdf && f.size > MAX_BAG_PDF_BYTES;
    });
    if (oversizedPdf) {
      show("PDF 파일은 3MB 이하만 첨부할 수 있어요");
      return;
    }
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
    if (guardReadOnly()) return;
    const url = bag.images[idx];
    setBag((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
    deleteBagImage(url);
  };

  const handleSave = () => {
    if (guardReadOnly()) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    isDirtyRef.current = false;
    hasUnsavedChangesRef.current = false;
    // 저장 결과 토스트는 AppShell.handleSaveBag에서 성공/실패를 확인한 뒤 한 번만 표시한다
    // (여기서 미리 띄우면 실패해도 이미 성공 토스트를 본 뒤라 혼란을 줄 수 있다).
    onSave(bag);
  };

  const handleLeave = async () => {
    if (guardReadOnly()) return;
    await onLeaveBag(bag.id);
    setShowMembers(false);
    onBack(bag);
    show("가방에서 나갔어요");
  };

  // 화면에 실제로 그릴 팩 목록. collapseOverrideActive면 저장된 displayState를
  // 무시하고 전부 "collapsed"로 덮어써서 보여준다(데이터 자체는 그대로 둠).
  const effectivePacks = collapseOverrideActive
    ? bag.packs.map((p) => ({ ...p, displayState: "collapsed" as const }))
    : bag.packs;

  // 상단 전체 컨트롤(접기/넓게보기) 아이콘이 지금 어떤 상태를 보여줘야 하는지 판단하기 위해,
  // 모든 팩이 같은 displayState인지 확인한다. 팩들이 섞여있으면(일부만 접힘 등) 기본 아이콘으로 보인다.
  const allPacksCollapsed =
    effectivePacks.length > 0 &&
    effectivePacks.every((p) => (p.displayState ?? "normal") === "collapsed");
  const allPacksWide =
    effectivePacks.length > 0 &&
    effectivePacks.every((p) => (p.displayState ?? "normal") === "wide");

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={handleBackAttempt} className="-m-2.5 p-2.5" aria-label="뒤로가기">
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
          {!readOnly && (
            <button
              onClick={() => setConfirmDeleteBag(true)}
              aria-label="가방 삭제"
              className="-m-2.5 p-2.5"
            >
              <IconTrash size={19} stroke={1.75} color="var(--danger)" />
            </button>
          )}
          {!readOnly && (
            <button
              onClick={handleSave}
              className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              저장
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {readOnly && (
          <button
            onClick={onRequestUnlock}
            className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 mb-3 text-left"
            style={{ background: "var(--surface-2)" }}
          >
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <IconLock size={13} stroke={1.75} />
              읽기 전용이에요 · 이용권을 등록하면 다시 수정할 수 있어요
            </span>
            <span className="text-[12px] font-medium shrink-0" style={{ color: "var(--accent)" }}>
              등록
            </span>
          </button>
        )}

        <EditableText
          value={bag.name}
          onChange={(name) => setBag((prev) => ({ ...prev, name }))}
          readOnly={readOnly}
          className="text-[18px] font-medium mb-2 block text-left"
          inputClassName="text-[18px] font-medium mb-2 block w-full"
          placeholder="새 가방"
        />

        <BagNotice
          value={bag.notice ?? ""}
          onChange={(notice) => setBag((prev) => ({ ...prev, notice }))}
          readOnly={readOnly}
        />

        <TravelDateField
          travelDate={bag.travelDate}
          reminderOffsets={bag.reminderOffsets}
          onChange={handleChangeTravelDate}
          readOnly={readOnly}
        />

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {bag.images.map((src, idx) => {
            const isPdf = isPdfUrl(src);
            return (
              <div
                key={idx}
                className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-surface-2"
              >
                {isPdf ? (
                  <button
                    onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
                    className="h-full w-full flex flex-col items-center justify-center gap-0.5 text-text-secondary"
                    aria-label="PDF 열기"
                  >
                    <IconFileText size={20} stroke={1.75} />
                    <span className="text-[9px]">PDF</span>
                  </button>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    onClick={() => setLightboxIndex(idx)}
                    className="h-full w-full object-cover"
                  />
                )}
                {!readOnly && (
                  <button
                    onClick={() => setImageDeleteIndex(idx)}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <IconX size={10} stroke={2} color="#fff" />
                  </button>
                )}
              </div>
            );
          })}
          {!readOnly && bag.images.length < MAX_BAG_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImages}
              className="shrink-0 h-14 w-14 rounded-lg border border-dashed border-border-strong flex items-center justify-center text-text-muted disabled:opacity-50"
              aria-label="사진 또는 PDF 첨부"
            >
              {uploadingImages ? (
                <IconLoader2 size={18} stroke={1.75} className="animate-spin" />
              ) : (
                <IconPhoto size={18} stroke={1.75} />
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => handleAddImages(e.target.files)}
          />
        </div>

        {!readOnly && (
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
            <button
              onClick={() => setShowAiOrganize(true)}
              disabled={bag.packs.flatMap((p) => p.items).length < 2}
              className="rounded-lg px-3 py-1.5 text-[12px] flex items-center gap-1 disabled:opacity-40"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
            >
              <IconSparkles size={13} stroke={1.75} />AI로 정리
            </button>
            {bag.packs.length > 0 && (
              <div className="flex items-center gap-2.5 ml-auto rounded-lg border border-border px-2 py-1">
                <button
                  onClick={() => handleSetAllDisplayState(allPacksWide ? "normal" : "wide")}
                  aria-label={allPacksWide ? "팩 전체 기본 크기로" : "팩 전체 넓게 보기"}
                >
                  {allPacksWide ? (
                    <IconArrowsMinimize size={17} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconArrowsMaximize size={17} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </button>
                <button
                  onClick={() =>
                    handleSetAllDisplayState(allPacksCollapsed ? "normal" : "collapsed")
                  }
                  aria-label={allPacksCollapsed ? "팩 전체 펼치기" : "팩 전체 접기"}
                >
                  {allPacksCollapsed ? (
                    <IconChevronDown size={17} stroke={1.75} color="var(--text-secondary)" />
                  ) : (
                    <IconChevronRight size={17} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {bag.packs.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">
            팩을 불러오거나 새로 만들어서 짐을 채워보세요.
          </p>
        ) : (
          <PackGrid
            packs={effectivePacks}
            libraryPacks={libraryPacks}
            onToggleItem={handleToggleItem}
            onChangeItemText={handleChangeItemText}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleOpenAddItem}
            onEditItem={handleOpenEditItem}
            onRenamePack={handleRenamePack}
            onToggleAll={handleToggleAllInPack}
            onSaveToLibrary={handleSaveToLibrary}
            onDeletePack={handleDeletePack}
            onChangeDisplayState={handleChangeDisplayState}
            onRefreshFromLibrary={(packId: string) => {
              if (guardReadOnly()) return;
              setRefreshConfirmTarget(packId);
            }}
            onStartItemDrag={handleStartItemDrag}
            dragSourceItemId={drag?.itemId ?? null}
            dragOverItemId={drag?.overItemId ?? null}
            dragOverPackId={drag?.overPackId ?? packDrag?.overPackId ?? null}
            onStartPackDrag={handleStartPackDrag}
            dragSourcePackId={packDrag?.packId ?? null}
          />
        )}
      </div>

      {/* 짐을 롱프레스로 들어올린 동안, 화면 상단에 모든 팩 이름을 칩으로 띄워둔다.
          화면 밖(스크롤해야 보이는) 팩으로도 스크롤 없이 바로 옮길 수 있게 하기 위함 -
          기존 [data-pack-drop-id] 드롭존 판정 로직(위 handleMove)을 그대로 재사용한다. */}
      {drag && (
        <div
          className="fixed inset-x-0 top-0 z-[94] px-3"
          style={{
            paddingTop: "max(10px, env(safe-area-inset-top))",
            paddingBottom: 12,
            background: "var(--surface)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            maxHeight: "45vh",
            overflowY: "auto",
          }}
        >
          <PackChipBar
            packs={bag.packs}
            label="팩으로 옮기기"
            dropIds
            getState={(packId) =>
              packId === drag.fromPackId
                ? "source"
                : packId === drag.overPackId
                ? "selected"
                : "normal"
            }
          />
        </div>
      )}

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
          onCreateNew={handleAddPack}
        />
      )}

      {showAiOrganize && (
        <AiOrganizeModal
          bag={bag}
          onClose={() => setShowAiOrganize(false)}
          onApply={(newPacks) => {
            if (guardReadOnly()) return;
            setShowAiOrganize(false);
            updatePacks(() => newPacks);
            show("AI가 정리했어요");
          }}
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

      {saveConfirmTarget && (
        <ConfirmDialog
          title="팩을 저장하시겠습니까?"
          message="다음에 다시 꺼내 쓸 수 있어요"
          confirmLabel="저장"
          tone="accent"
          onCancel={() => setSaveConfirmTarget(null)}
          onConfirm={() => confirmInitialSave(saveConfirmTarget)}
        />
      )}

      {imageDeleteIndex !== null && (
        <ConfirmDialog
          title="이 사진을 삭제할까요?"
          message="삭제하면 되돌릴 수 없어요."
          onCancel={() => setImageDeleteIndex(null)}
          onConfirm={() => {
            const idx = imageDeleteIndex;
            setImageDeleteIndex(null);
            removeImage(idx);
          }}
        />
      )}

      {refreshConfirmTarget && (
        <ConfirmDialog
          title="팩을 라이브러리 최신본으로 불러올까요?"
          message="지금 이 팩에 있는 내용은 라이브러리 버전으로 덮어써지고 사라져요."
          confirmLabel="불러오기"
          tone="accent"
          onCancel={() => setRefreshConfirmTarget(null)}
          onConfirm={() => {
            const packId = refreshConfirmTarget;
            setRefreshConfirmTarget(null);
            handleRefreshFromLibrary(packId);
          }}
        />
      )}

      {itemModal && (
        <ItemFormModal
          packs={bag.packs}
          selectionMode="single"
          initialSelectedPackIds={[itemModal.sourcePackId]}
          mode={itemModal.mode}
          initialType={itemModal.mode === "add" ? itemModal.type : itemModal.item.type}
          initialText={itemModal.mode === "edit" ? itemModal.item.text : ""}
          initialBold={itemModal.mode === "edit" ? !!itemModal.item.bold : false}
          initialStrike={itemModal.mode === "edit" ? !!itemModal.item.strike : false}
          initialColor={itemModal.mode === "edit" ? itemModal.item.color || "" : ""}
          onClose={() => setItemModal(null)}
          onSave={(targetPackIds, data) => {
            const targetPackId = targetPackIds[0];
            if (itemModal.mode === "add") {
              handleCreateItem(targetPackId, data);
            } else {
              handleUpdateItem(itemModal.sourcePackId, itemModal.item.id, targetPackId, data);
            }
            setItemModal(null);
          }}
        />
      )}

      {updateChoiceTarget && (
        <PackUpdateDialog
          conflict={updateChoiceTarget.conflict}
          onCancel={() => setUpdateChoiceTarget(null)}
          onSaveAsNew={() => handleChooseSaveAsNew(updateChoiceTarget.packId)}
          onOverwrite={() => commitOverwriteToLibrary(updateChoiceTarget.packId)}
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

      {confirmLeaveUnsaved && (
        <ConfirmDialog
          title="저장하지 않은 내용이 있어요"
          message="지금 나가면 만든 내용이 사라져요. 그대로 나가시겠어요?"
          confirmLabel="나가기"
          tone="danger"
          onCancel={() => setConfirmLeaveUnsaved(false)}
          onConfirm={() => {
            setConfirmLeaveUnsaved(false);
            onBack(bag);
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
