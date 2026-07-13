"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconPhoto,
  IconPlus,
  IconX,
  IconTrash,
  IconLogout,
  IconUsers,
  IconSparkles,
  IconLock,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconFileText,
  IconLayoutGrid,
  IconNotes,
  IconPackageImport,
  IconPackage,
  IconEye,
  IconEyeOff,
  IconHelpCircle,
} from "@tabler/icons-react";
import { Bag, Item, Pack, ReminderOffset } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import EditableText from "@/components/EditableText";
import BagNotice from "@/components/BagNotice";
import TravelDateField from "@/components/TravelDateField";
import PackGrid from "@/components/PackGrid";
import NotebookView from "@/components/NotebookView";
import PackChipBar from "@/components/PackChipBar";
import ItemFormModal from "@/components/ItemFormModal";
import PackImportModal from "@/components/PackImportModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SaveAsDialog from "@/components/SaveAsDialog";
import PackUpdateDialog from "@/components/PackUpdateDialog";
import GroupMembersModal from "@/components/GroupMembersModal";
import AiOrganizeModal from "@/components/AiOrganizeModal";
import NotebookQuickAddModal, { QuickAddItemData } from "@/components/NotebookQuickAddModal";
import { useToast } from "@/components/Toast";
import { uploadBagImage, deleteBagImage } from "@/lib/storageService";
import { subscribeToBag, saveBagRemote } from "@/lib/bagsService";
import { deleteLibraryPackRemote } from "@/lib/packsService";
import { isInSyncWithLibrary } from "@/lib/packSync";
import { getDisplayOrderedItems } from "@/lib/itemDisplayOrder";
import { firebaseErrorCode } from "@/lib/errorMessage";
import PresenceBar from "@/components/PresenceBar";
import ImageLightbox from "@/components/ImageLightbox";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import HelpTutorialModal from "@/components/HelpTutorialModal";
import { bagEditorHelpSlides } from "@/lib/helpTutorial/bagEditorSlides";
import { MAX_BAG_IMAGES, isPremiumUser } from "@/lib/premiumLimits";
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
  focusTarget,
  onFocusHandled,
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
  // 검색 결과를 눌러서 들어왔을 때만 넘어온다. 있으면 그 팩(+짐)까지 자동 스크롤하고
  // 잠깐 하이라이트한다 (AppShell이 HomeScreen 검색 결과 클릭을 중계).
  focusTarget?: { packId?: string; itemId?: string } | null;
  onFocusHandled?: () => void;
}) {
  const [bag, setBag] = useState<Bag>(initialBag);
  // 이 가방을 내가 만들었는지(소유자)인지 여부. 소유자가 아니면(그룹원으로 참여한
  // 공유 가방) 트래시 버튼의 동작이 "삭제"가 아니라 "나가기"로 바뀐다 - 공유 문서를
  // 통째로 지워버리면 다른 그룹원들에게서도 사라지기 때문에, 소유자가 아닌 사람에게는
  // 그런 파괴적인 동작을 허용하지 않는다.
  const isOwner = bag.ownerId === currentUid;
  const [showImport, setShowImport] = useState(false);
  const [showAiOrganize, setShowAiOrganize] = useState(false);
  const [showNotebookQuickAdd, setShowNotebookQuickAdd] = useState(false);
  const [confirmDeleteBag, setConfirmDeleteBag] = useState(false);
  const [confirmLeaveUnsaved, setConfirmLeaveUnsaved] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageDeleteIndex, setImageDeleteIndex] = useState<number | null>(null);
  // PDF 미리보기/업로드는 프리미엄 전용 기능(2026-07 추가). 실제 차단은
  // storage.rules가 해주지만(프리미엄이 아닌 요청자에게는 읽기/쓰기 자체가 거부됨),
  // 여기서는 실패하기 전에 미리 안내해서 사용자가 왜 막혔는지 바로 알게 한다.
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPdfPremiumModal, setShowPdfPremiumModal] = useState(false);
  const [refreshConfirmTarget, setRefreshConfirmTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();
  const { profile, updatePackDisplayState, updateAllPackDisplayStates, updateBagViewMode } = useAuth();
  const premium = isPremiumUser(profile?.email, profile ?? null);

  // 설정 > 팩 설정 > "가방 열 때 팩 접어서 보기"가 켜져 있으면, 이 화면에 처음 들어온
  // 순간에만 모든 팩을 접힌 상태로 보여준다. 저장된 Pack.displayState는 전혀 건드리지
  // 않고(=자동저장 대상이 아님) 화면에 그리는 값만 아래 effectivePacks에서 덮어쓴다.
  // 사용자가 개별/전체 펼치기·접기 컨트롤을 한 번이라도 쓰면 그 순간 꺼지고, 이후부터는
  // 평소처럼 저장된 displayState 그대로를 보여준다(다음에 다시 들어오면 또 접힌 채로 시작).
  const [collapseOverrideActive, setCollapseOverrideActive] = useState(
    !!profile?.packSettings?.alwaysCollapseOnEntry
  );

  // 팩뷰/메모장뷰 상관없이 상단 토글로 켜고 끄는 "완료(체크된) 항목 숨기기". 데이터는 그대로 두고
  // 화면에 그릴 때만 걸러낸다(PackCard/NotebookPackSection의 displayItems 필터링) - 저장되지 않는
  // 화면별 임시 상태라 화면을 다시 들어오면 항상 꺼진 채로 시작한다.
  const [hideChecked, setHideChecked] = useState(false);

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

  // isNew는 "새 가방 -> 최초 저장 완료" 시점에 false로 바뀌는데, 이 화면은 그때
  // 리마운트되지 않고 그대로 유지된다. 아래 자동저장/언마운트 effect들은 클로저가
  // 실행 시점 값을 그대로 들고 있을 수 있으므로, 최신 값을 보려면 ref로 따로 추적한다.
  const isNewRef = useRef(isNew);
  useEffect(() => {
    isNewRef.current = isNew;
  }, [isNew]);

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
  // 새로 만드는 중(isNew)인 가방의 "첫 실제 변경"이 서버에 반영되는 순간 딱 한 번만
  // onSave(=AppShell의 handleSaveBag)를 호출해서 isNewBag을 꺼준다. 더 이상 별도
  // "저장" 버튼이 없으므로, 이 첫 자동저장 성공이 곧 예전의 "저장 버튼 클릭"과 같은
  // 역할을 한다 - 그 이후 뒤로가기는 임시 가방 삭제 대상에서 제외된다.
  const hasConfirmedNewRef = useRef(false);

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
    // 새 가방의 첫 변경은 디바운스 없이 즉시 저장한다 - "확정"까지 걸리는 시간을
    // 최소화해서, 저장 직후 바로 나가도 임시 가방으로 오인되어 삭제되는 경합을 줄인다.
    const delay = isNewRef.current && !hasConfirmedNewRef.current ? 0 : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimerRef.current = setTimeout(() => {
      saveBagRemote(bag)
        .then(() => {
          if (isNewRef.current && !hasConfirmedNewRef.current) {
            hasConfirmedNewRef.current = true;
            onSave(bag);
          }
        })
        .catch((err) => {
          console.error("[팩인백] 실시간 저장 실패:", err);
          show(`실시간 저장에 실패했어요 (${firebaseErrorCode(err)})`);
        })
        .finally(() => {
          isDirtyRef.current = false;
        });
    }, delay);
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
  useEffect(() => {
    return () => {
      // 디바운스 대기 중(아직 서버에 반영 안 된 변경)이면 나가기 전에 그 즉시 저장한다.
      // 새 가방(isNew)이고 아직 한 번도 확정 안 됐으면, 이 저장이 곧 "확정" 역할도
      // 겸한다(onSave 호출) - 확정된 뒤에는 AppShell이 더 이상 임시 가방으로 취급하지
      // 않으므로 뒤로가기로 지워지지 않는다.
      if (!autosaveTimerRef.current || !isDirtyRef.current) return;
      window.clearTimeout(autosaveTimerRef.current);
      saveBagRemote(bagRef.current)
        .then(() => {
          if (isNewRef.current && !hasConfirmedNewRef.current) {
            hasConfirmedNewRef.current = true;
            onSave(bagRef.current);
          } else {
            show("나가기 전 변경사항을 저장했어요");
          }
        })
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

  // 검색 결과를 눌러서 들어온 경우(focusTarget) 해당 팩이 접혀있으면 펼치고, 그 팩(또는 짐)으로
  // 스크롤한 뒤 잠깐 하이라이트(pib-search-highlight, globals.css)를 붙였다 뗀다. 펼치는
  // 애니메이션/리렌더링이 끝난 뒤에만 요소를 찾을 수 있어서 약간의 지연(setTimeout) 뒤에 찾는다.
  useEffect(() => {
    if (!focusTarget?.packId) return;
    const { packId, itemId } = focusTarget;

    const key = `${bag.id}:${packId}`;
    const currentState = collapseOverrideActive
      ? "collapsed"
      : profile?.packDisplayStates?.[key] ?? "normal";
    if (collapseOverrideActive) setCollapseOverrideActive(false);
    if (currentState === "collapsed") {
      updatePackDisplayState(bag.id, packId, "normal").catch(() => {});
    }

    const timer = window.setTimeout(() => {
      const selector = itemId ? `[data-item-id="${itemId}"]` : `[data-pack-drop-id="${packId}"]`;
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("pib-search-highlight");
        window.setTimeout(() => el.classList.remove("pib-search-highlight"), 1850);
      }
      onFocusHandled?.();
    }, 350);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

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

  // 짐 수정은 중앙 모달(ItemFormModal)을 열어서 처리한다. 새 짐 추가는 상단 "+" 버튼으로 여는
  // 통합 모달(NotebookQuickAddModal)을 통해서만 이뤄진다(아래 handleCreateItem 참고).
  const [itemModal, setItemModal] = useState<{ sourcePackId: string; item: Item } | null>(null);

  const handleOpenEditItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    const item = pack?.items.find((i) => i.id === itemId);
    if (!item) return;
    setItemModal({ sourcePackId: packId, item });
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

  // 메모장뷰 상단 "+" 통합 추가 모달 전용. 이름까지 바로 지어 새 팩을 만들고 첫 항목까지
  // 넣은 다음, 그 팩 id를 그대로 돌려줌으로써 모달이 연속입력을 이어갈 때 새로 만든
  // 그 팩으로 계속 추가할 수 있게 한다. handleAddPack과 동일한 10개 캡 검사를 적용하고,
  // 실패하면 null을 돌려서 모달 쓰는 쪽에서 그대로 안내하게 한다.
  const handleQuickAddNewPack = (name: string, data: QuickAddItemData): string | null => {
    if (guardReadOnly()) return null;
    if (bag.packs.length >= 10) {
      show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
      return null;
    }
    const newPackId = uid();
    const newItem: Item = {
      id: uid(),
      type: data.type,
      text: data.text,
      ...(data.type === "check"
        ? { checked: false }
        : { bold: data.bold, strike: data.strike, color: data.color }),
    };
    updatePacks((packs) => [...packs, { id: newPackId, name: name.trim() || "새 팩", items: [newItem] }]);
    return newPackId;
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
  // 실제 저장은 가방 문서(그룹 공유)가 아니라 계정(사용자별)에 하므로, 그룹원과는 동기화되지
  // 않고 나만의 화면 상태로 남는다(다른 기기에서 로그인해도 그대로 유지됨).
  const handleChangeDisplayState = (
    packId: string,
    nextState: "normal" | "wide" | "collapsed"
  ) => {
    if (guardReadOnly()) return;
    setCollapseOverrideActive(false);
    updatePackDisplayState(bag.id, packId, nextState).catch((err) => {
      console.error("[팩인백] 팩 표시 상태 저장 실패:", err);
    });
  };

  const handleSetAllDisplayState = (nextState: "normal" | "wide" | "collapsed") => {
    if (guardReadOnly()) return;
    setCollapseOverrideActive(false);
    updateAllPackDisplayStates(
      bag.id,
      bag.packs.map((p) => p.id),
      nextState
    ).catch((err) => {
      console.error("[팩인백] 팩 전체 표시 상태 저장 실패:", err);
    });
  };

  // fromPackId === toPackId면 같은 팩 안에서 overItemId 위치로 순서를 바꾸고,
  // 다르면 기존처럼 다른 팩으로 옮긴다. insertAfter가 true면 overItemId "다음"에,
  // 아니면(기본) "앞"에 끼워넣는다(드래그 중 커서가 대상 항목의 위쪽 절반/아래쪽 절반
  // 중 어디 있는지로 판정되어 더 직관적이다). 화면에 보이는 순서(getDisplayOrderedItems)
  // 기준으로 계산해야 "완료된 항목 맨 아래로 이동" 설정이 켜져있어도 드래그 위치와
  // 실제 결과가 어긋나지 않는다 - 예전엔 원본(pack.items) 순서 기준으로 계산해서 화면과
  // 다르게 반영되는 버그가 있었다.
  const handleMoveItem = (
    fromPackId: string,
    toPackId: string,
    itemId: string,
    overItemId?: string | null,
    insertAfter?: boolean
  ) => {
    if (guardReadOnly()) return;
    const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
    if (fromPackId === toPackId) {
      if (!overItemId || overItemId === itemId) return;
      updatePacks((packs) =>
        packs.map((p) => {
          if (p.id !== fromPackId) return p;
          const ordered = getDisplayOrderedItems(p.items, moveCompletedToBottom);
          const item = ordered.find((i) => i.id === itemId);
          if (!item) return p;
          const withoutItem = ordered.filter((i) => i.id !== itemId);
          let targetIndex = withoutItem.findIndex((i) => i.id === overItemId);
          if (targetIndex === -1) return p;
          if (insertAfter) targetIndex += 1;
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
          const ordered = getDisplayOrderedItems(p.items, moveCompletedToBottom);
          let targetIndex = overItemId ? ordered.findIndex((i) => i.id === overItemId) : -1;
          if (targetIndex !== -1 && insertAfter) targetIndex += 1;
          const items =
            targetIndex === -1
              ? [...ordered, item]
              : [...ordered.slice(0, targetIndex), item, ...ordered.slice(targetIndex)];
          const updated = { ...p, items };
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
    overItemPosition: "before" | "after" | null;
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
      overItemPosition: null,
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
      // 드래그 중인 항목을 대상 항목의 어디에 놓을지를 판단한다. 체크형 짐은 2열 그리드로
      // 나란히 놀여있어서 좌/우(가로) 기준으로 판단해야 직관적이고(예: 2번을 1번 왜쪽으로
      // 옮기면 1번 왜쪽에 놓여야 함), 텍스트형 짐은 전체 폭을 차지하는 한 줄이라 위/아래
      // (세로) 기준이 맞다.
      let overItemPosition: "before" | "after" | null = null;
      if (itemEl) {
        const rect = itemEl.getBoundingClientRect();
        const itemType = itemEl.getAttribute("data-item-type");
        overItemPosition =
          itemType === "text"
            ? e.clientY - rect.top < rect.height / 2
              ? "before"
              : "after"
            : e.clientX - rect.left < rect.width / 2
            ? "before"
            : "after";
      }
      setDrag((d) =>
        d ? { ...d, x: e.clientX, y: e.clientY, overPackId, overItemId, overItemPosition } : d
      );
    };

    const handleUp = () => {
      setDrag((d) => {
        if (d && d.overPackId) {
          handleMoveItem(
            d.fromPackId,
            d.overPackId,
            d.itemId,
            d.overItemId,
            d.overItemPosition === "after"
          );
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
    overPackPosition: "before" | "after" | null;
  } | null>(null);

  const handleStartPackDrag = (
    packId: string,
    name: string,
    clientX: number,
    clientY: number
  ) => {
    if (guardReadOnly()) return;
    setPackDrag({ packId, name, x: clientX, y: clientY, overPackId: null, overPackPosition: null });
  };

  // insertAfter가 true면 toPackId "다음"에, 아니면 "앞"에 삽입한다(짐 순서변경과 같은
  // 이유로 커서 위치 기준으로 before/after를 판단해야 어디로 옮겨질지 직관적이다).
  const handleReorderPack = (fromPackId: string, toPackId: string, insertAfter?: boolean) => {
    if (guardReadOnly()) return;
    updatePacks((packs) => {
      const fromIndex = packs.findIndex((p) => p.id === fromPackId);
      if (fromIndex === -1) return packs;
      const withoutItem = packs.filter((p) => p.id !== fromPackId);
      let targetIndex = withoutItem.findIndex((p) => p.id === toPackId);
      if (targetIndex === -1) return packs;
      if (insertAfter) targetIndex += 1;
      const moved = packs[fromIndex];
      return [...withoutItem.slice(0, targetIndex), moved, ...withoutItem.slice(targetIndex)];
    });
    show("팩 순서를 바꿨어요");
  };

  useEffect(() => {
    if (!packDrag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const packEl = el?.closest("[data-pack-drop-id]") as HTMLElement | null;
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      let overPackPosition: "before" | "after" | null = null;
      if (packEl) {
        const rect = packEl.getBoundingClientRect();
        overPackPosition = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
      }
      setPackDrag((d) =>
        d ? { ...d, x: e.clientX, y: e.clientY, overPackId, overPackPosition } : d
      );
    };

    const handleUp = () => {
      setPackDrag((d) => {
        if (d && d.overPackId && d.overPackId !== d.packId) {
          handleReorderPack(d.packId, d.overPackId, d.overPackPosition === "after");
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
    const selected = Array.from(files).slice(0, MAX_BAG_IMAGES - bag.images.length);

    // PDF는 프리미엄 전용 기능 - storage.rules가 실제로도 프리미엄 요청자에게만 읽기/쓰기를
    // 허용한다. 무료 회원이 PDF를 골랐다면 그 파일들만 업로드 목록에서 빼고 업그레이드
    // 안내 모달을 띄우며, 같이 고른 이미지는 그대로 정상 업로드된다.
    const isPdfFile = (f: File) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const pdfFiles = selected.filter(isPdfFile);
    const toUpload = premium ? selected : selected.filter((f) => !isPdfFile(f));
    if (pdfFiles.length > 0 && !premium) {
      setShowPdfPremiumModal(true);
    }
    if (toUpload.length === 0) return;

    // PDF is not compressed on upload, so reject oversized PDFs here before spending
    // an upload attempt (images are still compressed down automatically as before).
    const oversizedPdf = toUpload.find((f) => isPdfFile(f) && f.size > MAX_BAG_PDF_BYTES);
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

  const handleLeave = async () => {
    if (guardReadOnly()) return;
    await onLeaveBag(bag.id);
    setShowMembers(false);
    onBack(bag);
    show("가방에서 나갔어요");
  };

  // 화면에 실제로 그릴 팩 목록. collapseOverrideActive면 저장된 displayState를
  // 무시하고 전부 "collapsed"로 덮어써서 보여준다(데이터 자체는 그대로 둠).
  const packDisplayStates = profile?.packDisplayStates ?? {};
  const effectivePacks = bag.packs.map((p) => ({
    ...p,
    displayState: collapseOverrideActive
      ? ("collapsed" as const)
      : packDisplayStates[`${bag.id}:${p.id}`] ?? "normal",
  }));

  // 상단 전체 컨트롤(접기/넓게보기) 아이콘이 지금 어떤 상태를 보여줘야 하는지 판단하기 위해,
  // 모든 팩이 같은 displayState인지 확인한다. 팩들이 섞여있으면(일부만 접힘 등) 기본 아이콘으로 보인다.
  const allPacksCollapsed =
    effectivePacks.length > 0 &&
    effectivePacks.every((p) => (p.displayState ?? "normal") === "collapsed");
  const allPacksWide =
    effectivePacks.length > 0 &&
    effectivePacks.every((p) => (p.displayState ?? "normal") === "wide");

  // 이 가방을 카드(팩뷰)로 볼지 내용이 이어지는 문서형(메모장뷰)으로 볼지. 이 가방만의
  // 개별 오버라이드(profile.bagViewMode[bag.id])가 있으면 그것을, 없으면 설정 > 가방설정의
  // 전역 기본값(defaultBagViewMode)을 따른다. 그룹원과는 동기화되지 않는 사용자별 설정이라,
  // 같은 가방을 보는 다른 그룹원은 각자 원하는 보기 방식으로 볼 수 있다.
  const viewMode: "pack" | "notebook" =
    profile?.bagViewMode?.[bag.id] ?? profile?.defaultBagViewMode ?? "pack";
  const handleToggleViewMode = () => {
    updateBagViewMode(bag.id, viewMode === "pack" ? "notebook" : "pack").catch((err) => {
      console.error("[팩인백] 보기 방식 저장 실패:", err);
    });
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={handleBackAttempt} className="-m-2.5 p-2.5" aria-label="뒤로가기">
            <IconArrowLeft size={22} stroke={1.75} />
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="-m-2.5 p-2.5"
            aria-label="사용법 도움말"
          >
            <IconHelpCircle size={20} stroke={1.75} color="var(--text-secondary)" />
          </button>
        </div>
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
              aria-label={isOwner ? "가방 삭제" : "가방 나가기"}
              className="-m-2.5 p-2.5"
            >
              {isOwner ? (
                <IconTrash size={19} stroke={1.75} color="var(--danger)" />
              ) : (
                <IconLogout size={19} stroke={1.75} color="var(--danger)" />
              )}
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => setShowAiOrganize(true)}
              disabled={bag.packs.flatMap((p) => p.items).length < 2}
              aria-label="AI로 정리"
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 disabled:opacity-30"
            >
              <span className="text-[13px] font-semibold leading-none" style={{ color: "var(--accent)" }}>
                AI
              </span>
              <IconSparkles size={16} stroke={1.75} color="var(--accent)" />
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
                    onClick={() =>
                      premium ? setPdfPreviewUrl(src) : setShowPdfPremiumModal(true)
                    }
                    className="relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-text-secondary"
                    aria-label={premium ? "PDF 미리보기" : "PDF 미리보기 (프리미엄 전용)"}
                  >
                    <IconFileText size={20} stroke={1.75} />
                    <span className="text-[9px]">PDF</span>
                    {!premium && (
                      <span
                        className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                      >
                        <IconLock size={9} stroke={2} color="#fff" />
                      </span>
                    )}
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
          <div
            className="flex gap-2 mb-4 flex-wrap sticky top-0 z-10 py-2"
            style={{ background: "var(--background)" }}
          >
            <button
              onClick={() => setShowImport(true)}
              aria-label="팩 불러오기"
              className="rounded-lg border border-border p-2"
            >
              <IconPackageImport size={17} stroke={1.75} />
            </button>
            <button
              onClick={handleAddPack}
              disabled={bag.packs.length >= 10}
              aria-label="새 팩 추가"
              className="relative rounded-lg border border-border p-2 disabled:opacity-40"
            >
              <IconPackage size={17} stroke={1.75} />
              <span
                className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                style={{ background: "var(--accent)" }}
              >
                <IconPlus size={9} stroke={3} color="#fff" />
              </span>
            </button>
            <button
              onClick={handleToggleViewMode}
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] flex items-center gap-1"
              aria-label={viewMode === "pack" ? "메모장뷰로 보기" : "팩뷰로 보기"}
            >
              {viewMode === "pack" ? (
                <>
                  <IconNotes size={13} stroke={1.75} />메모장뷰
                </>
              ) : (
                <>
                  <IconLayoutGrid size={13} stroke={1.75} />팩뷰
                </>
              )}
            </button>
            {bag.packs.length > 0 && (
              <div className="flex items-center gap-2.5 ml-auto rounded-lg border border-border px-2 py-1">
                <button
                  onClick={() => setHideChecked((v) => !v)}
                  aria-label={hideChecked ? "완료 항목 다시 보이기" : "완료 항목 숨기기"}
                >
                  {hideChecked ? (
                    <IconEyeOff size={17} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconEye size={17} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </button>
                {viewMode === "pack" && (
                  <button
                    onClick={() => setShowNotebookQuickAdd(true)}
                    aria-label="항목 추가"
                  >
                    <IconPlus size={17} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                )}
                {viewMode === "pack" && (
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
                )}
                {viewMode === "notebook" && (
                  <button
                    onClick={() => setShowNotebookQuickAdd(true)}
                    aria-label="항목 추가"
                  >
                    <IconPlus size={17} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                )}
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
        ) : viewMode === "notebook" ? (
          <NotebookView
            packs={effectivePacks}
            libraryPacks={libraryPacks}
            onToggleItem={handleToggleItem}
            onChangeItemText={handleChangeItemText}
            onDeleteItem={handleDeleteItem}
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
            dragOverItemPosition={drag?.overItemPosition ?? null}
            dragOverPackId={drag?.overPackId ?? packDrag?.overPackId ?? null}
            dragOverPackPosition={drag?.overItemId ? null : packDrag?.overPackPosition ?? null}
            onStartPackDrag={handleStartPackDrag}
            dragSourcePackId={packDrag?.packId ?? null}
            hideChecked={hideChecked}
          />
        ) : (
          <PackGrid
            packs={effectivePacks}
            libraryPacks={libraryPacks}
            onToggleItem={handleToggleItem}
            onChangeItemText={handleChangeItemText}
            onDeleteItem={handleDeleteItem}
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
            dragOverItemPosition={drag?.overItemPosition ?? null}
            dragOverPackId={drag?.overPackId ?? packDrag?.overPackId ?? null}
            dragOverPackPosition={drag?.overItemId ? null : packDrag?.overPackPosition ?? null}
            onStartPackDrag={handleStartPackDrag}
            dragSourcePackId={packDrag?.packId ?? null}
            hideChecked={hideChecked}
            onAddItem={(packId, data) => handleCreateItem(packId, data)}
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

      {showNotebookQuickAdd && (
        <NotebookQuickAddModal
          packs={bag.packs}
          onClose={() => setShowNotebookQuickAdd(false)}
          onAddToPack={(packId, data) => handleCreateItem(packId, data)}
          onCreatePack={(name, data) => handleQuickAddNewPack(name, data)}
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
          mode="edit"
          initialType={itemModal.item.type}
          initialText={itemModal.item.text}
          initialBold={!!itemModal.item.bold}
          initialStrike={!!itemModal.item.strike}
          initialColor={itemModal.item.color || ""}
          onClose={() => setItemModal(null)}
          onSave={(targetPackIds, data) => {
            const targetPackId = targetPackIds[0];
            handleUpdateItem(itemModal.sourcePackId, itemModal.item.id, targetPackId, data);
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
          title={isOwner ? "이 가방을 휴지통으로 보낼까요?" : "이 가방에서 나갈까요?"}
          message={
            isOwner
              ? "설정 > 휴지통에서 30일간 보관되며, 그 안에 복구할 수 있어요. 다른 그룹원들은 그대로 볼 수 있어요."
              : "그룹 가방에서 나가면 더 이상 이 가방을 볼 수 없어요. 가방 자체와 다른 그룹원들의 내용은 그대로 유지돼요."
          }
          confirmLabel={isOwner ? "휴지통으로" : "나가기"}
          tone="accent"
          onCancel={() => setConfirmDeleteBag(false)}
          onConfirm={() => {
            setConfirmDeleteBag(false);
            if (isOwner) {
              onDeleteBag(bag);
            } else {
              handleLeave();
            }
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

      {pdfPreviewUrl && (
        <PdfPreviewModal url={pdfPreviewUrl} onClose={() => setPdfPreviewUrl(null)} />
      )}

      {showPdfPremiumModal && (
        <PremiumLimitModal
          message="PDF 첨부/미리보기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
          onClose={() => setShowPdfPremiumModal(false)}
          onUnlocked={() => {
            setShowPdfPremiumModal(false);
            show("이용권 코드가 적용됐어요! PDF 기능을 다시 시도해주세요");
          }}
        />
      )}

      {showHelp && (
        <HelpTutorialModal slides={bagEditorHelpSlides} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}
