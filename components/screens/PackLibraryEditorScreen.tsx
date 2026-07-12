"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconTrash,
  IconPlus,
  IconLock,
  IconX,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import { Bag, Item, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import EditableText from "@/components/EditableText";
import ItemRow from "@/components/ItemRow";
import ItemFormModal, { ItemFormSaveData } from "@/components/ItemFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import PackColorDot from "@/components/PackColorDot";
import Portal from "@/components/Portal";
import { useToast } from "@/components/Toast";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 팩 편집 화면: 짐 추가/수정은 하단 "추가" 버튼으로 중앙 모달(ItemFormModal)을 열어서
// 처리한다. 가방 속 팩 편집과 다른 점은, 상단 팩 선택이 라디오형(하나만)이 아니라
// 체크박스형(여러 개)이라는 것 - 라이브러리에 있는 다른 팩도 함께 체크하면 그 팩들에도
// 동시에 짐이 추가/복사된다. 이미 추가된 짐은 기존과 동일하게 오른쪽 스와이프=수정
// (역시 이 모달을 열도록 변경), 왼쪽 스와이프=삭제로 조작하고, 체크박스 제외 영역을
// 롱프레스하면(그립 아이콘 없음) 같은 팩 안에서 순서를 바꿀 수 있다.
//
// 예외: 지금 편집 중인 팩이 "빠른팩"(pack.isQuickPack)이면, 같은 화면에 다른 팩이
// 안 보여서 드래그로 다른 팩에 옮길 수가 없다. 그래서 이 팩에서만 롱프레스가 순서변경
// 드래그 대신 "다중선택 모드"로 진입한다 - 길게 누른 짐이 선택되고, 이후 다른 짐들을
// 탭해서 선택을 추가/해제할 수 있다. 하단 액션바의 "이동"을 누르면 목적지를 고르는
// 시트가 뜨는데, 목적지는 라이브러리 팩뿐 아니라 특정 가방의 특정 팩까지도 가능하다.
export default function PackLibraryEditorScreen({
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
  variant = "fullscreen",
}: {
  initialPack: Pack;
  // 팩 선택 모달 상단에 보여줄 라이브러리 전체 팩 목록. 지금 편집 중인 팩이
  // 아직 한 번도 저장되지 않았다면(방금 "새 팩 만들기") 이 목록에 없을 수 있어서
  // displayPacks 계산에서 별도로 합쳐준다.
  libraryPacks: Pack[];
  // 무료 전환으로 잠긴 다른 라이브러리 팩 id 목록. "다른 팩에도 같이 추가" 체크박스
  // 목록에서 이 팩들은 제외한다 - 지금 열려있는 팩(unlocked 상태라 이 화면이 열림)을
  // 편집하는 김에 잠긴 팩에 몰래 짐을 추가하는 것을 막기 위함.
  lockedPackIds?: Set<string>;
  // 빠른팩의 "이동" 목적지로 특정 가방의 특정 팩까지 보여주기 위한 전체 가방 목록.
  bags?: Bag[];
  // 무료 전환으로 잠긴(읽기 전용) 가방 id 목록 - 이동 목적지 목록에서 제외한다.
  lockedBagIds?: Set<string>;
  // true면 지금 편집 중인 이 팩 자체가 잠긴 상태. 보기만 가능하고 모든 수정/삭제가 막힌다.
  readOnly: boolean;
  onRequestUnlock: () => void;
  onBack: () => void;
  onSave: (pack: Pack) => void;
  // 지금 편집 중인 팩이 아닌 "다른" 팩에 짐을 추가/복사할 때 그 팩을 즉시 원격저장.
  onSaveOtherPack: (pack: Pack) => void;
  onDelete: (packId: string) => void;
  // 빠른팩에서 짐을 특정 가방의 특정 팩으로 이동할 때 호출. (되돌리기는 아래 콜백)
  onAddItemsToBagPack?: (bagId: string, packId: string, items: Item[]) => void;
  onRemoveItemsFromBagPack?: (bagId: string, packId: string, itemIds: Set<string>) => void;
  // "fullscreen"(기본): 가방 편집화면과 동일하게 화면 전체를 채운다.
  // "sheet": AppShell이 내용 길이에 맞춰 커지는 바텀시트 컨테이너 안에 이 화면을 넣을 때 -
  // 화면 자체가 h-dvh(기기 전체 높이)를 강제하지 않고 부모(시트)가 준 높이를 그대로 채운다.
  variant?: "fullscreen" | "sheet";
  // 검색 결과(짐 매칭)를 눌러서 들어온 경우에만 넘어온다. 있으면 그 짐까지 자동 스크롤 +
  // 잠깐 하이라이트한다 (AppShell이 PacksScreen 검색 결과 클릭을 중계).
  focusItemId?: string | null;
  onFocusHandled?: () => void;
}) {
  const [pack, setPack] = useState<Pack>(initialPack);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // "추가" 버튼으로 열리는 짐 추가/수정 모달의 상태. edit일 때 item은 항상 지금 이
  // 팩(pack) 안에 있는 짐이다 - 다른 팩의 짐을 여기서 수정하는 경우는 없다.
  const [itemModal, setItemModal] = useState<
    { mode: "add" } | { mode: "edit"; item: Item } | null
  >(null);
  const { profile } = useAuth();
  const { show } = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const displayItems = moveCompletedToBottom
    ? [...pack.items].sort(
        (a, b) =>
          Number(a.type === "check" && !!a.checked) - Number(b.type === "check" && !!b.checked)
      )
    : pack.items;

  // 잠긴 팩에서 수정을 시도하는 모든 진입점의 공용 방어선.
  const guardReadOnly = (): boolean => {
    if (!readOnly) return false;
    onRequestUnlock();
    return true;
  };

  const toggleItem = (itemId: string) => {
    if (guardReadOnly()) return;
    setPack((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId ? { ...i, checked: !i.checked } : i
      ),
    }));
  };

  const changeItemText = (
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => {
    if (guardReadOnly()) return;
    setPack((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              text,
              spans: undefined,
              ...(style
                ? { bold: style.bold, strike: style.strike, color: style.color }
                : null),
            }
          : i
      ),
    }));
  };

  const deleteItem = (itemId: string) => {
    if (guardReadOnly()) return;
    let removedItem: Item | undefined;
    let removedIndex = -1;
    setPack((p) => {
      removedIndex = p.items.findIndex((i) => i.id === itemId);
      removedItem = p.items[removedIndex];
      return { ...p, items: p.items.filter((i) => i.id !== itemId) };
    });
    if (removedItem) {
      const restored = removedItem;
      const restoreIndex = removedIndex;
      show("짐을 삭제했어요", {
        actionLabel: "되돌리기",
        onAction: () => {
          setPack((p) => {
            const items = [...p.items];
            items.splice(Math.min(restoreIndex, items.length), 0, restored);
            return { ...p, items };
          });
        },
      });
    }
  };

  // 짐 추가/수정 모달을 위한 팩 선택 목록: 지금 편집 중인 팩(pack, 로컬 최신 상태)과
  // 라이브러리 전체 팩(libraryPacks)을 합친다. 아직 한 번도 저장 안 된 새 팩이면
  // libraryPacks에 없을 수 있어서 그런 경우엔 앞에 끼워 넣는다. 잠긴 다른 팩은 여기서
  // 제외해서, 체크박스로 선택조차 할 수 없게 만든다(lockedPackIds 참고).
  const displayPacks = (
    libraryPacks.some((p) => p.id === pack.id)
      ? libraryPacks.map((p) => (p.id === pack.id ? pack : p))
      : [pack, ...libraryPacks]
  ).filter((p) => p.id === pack.id || !lockedPackIds?.has(p.id));

  // 빠른팩 이동 목적지로 보여줄 가방 목록: 잠긴(읽기 전용) 가방과 팩이 하나도 없는
  // 가방은 제외한다.
  const displayBags = (bags ?? []).filter(
    (b) => !lockedBagIds?.has(b.id) && b.packs.length > 0
  );

  // 방금 새로 추가한 짐의 id. 추가 직후 화면에 그 짐이 보이도록 스크롤을 맞추는 용도로만
  // 쓰이고, 스크롤을 한 번 맞추면 바로 null로 비운다.
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  const buildNewItem = (data: ItemFormSaveData): Item => ({
    id: uid(),
    type: data.type,
    text: data.text,
    ...(data.type === "check"
      ? { checked: false }
      : { bold: data.bold, strike: data.strike, color: data.color }),
  });

  const openAddModal = () => {
    if (guardReadOnly()) return;
    setItemModal({ mode: "add" });
  };
  const openEditModal = (item: Item) => {
    if (guardReadOnly()) return;
    setItemModal({ mode: "edit", item });
  };

  // 모달 저장 처리:
  // - 지금 팩(pack.id)이 체크되어 있으면: add는 새 짐 추가, edit는 원래 자리에서
  //   내용만 갱신(체크박스형 checked 값은 타입이 안 바뀌었으면 유지).
  // - 지금 팩 체크가 빠져 있으면(edit에서만 가능): 이 팩에서는 제거.
  // - 체크된 다른 팩들에는 항상 새 복사본을 만들어서 즉시 원격저장(onSaveOtherPack).
  //   (팩 간 짐은 항상 독립된 복사본이라는 기존 원칙과 동일 - 원본을 옮기는 게 아님)
  const handleModalSave = (selectedPackIds: string[], data: ItemFormSaveData) => {
    if (guardReadOnly()) return;
    const includesCurrent = selectedPackIds.includes(pack.id);
    const otherPackIds = selectedPackIds.filter((id) => id !== pack.id);

    if (itemModal?.mode === "edit") {
      const itemId = itemModal.item.id;
      if (includesCurrent) {
        setPack((p) => ({
          ...p,
          items: p.items.map((i) => {
            if (i.id !== itemId) return i;
            return {
              id: i.id,
              type: data.type,
              text: data.text,
              ...(data.type === "check"
                ? { checked: i.type === "check" ? i.checked : false }
                : { bold: data.bold, strike: data.strike, color: data.color }),
            };
          }),
        }));
      } else {
        setPack((p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }));
      }
    } else if (includesCurrent) {
      // 새 짐 추가: 어디에 정렬되어 보이든(완료 항목 아래로 정리 설정과 무관하게)
      // 추가 직후 화면에 바로 보이도록 이 짐의 id를 기억해서 스크롤을 맞춘다.
      const newItem = buildNewItem(data);
      setPack((p) => ({ ...p, items: [...p.items, newItem] }));
      setLastAddedItemId(newItem.id);
    }

    otherPackIds.forEach((packId) => {
      const target = libraryPacks.find((p) => p.id === packId);
      if (!target) return;
      onSaveOtherPack({ ...target, items: [...target.items, buildNewItem(data)] });
    });

    setItemModal(null);
  };

  // 방금 추가한 짐(lastAddedItemId)이 있으면 그 짐이 화면에 보이도록 스크롤한다.
  // "완료 항목 맨 아래로 이동" 설정이 켜져 있으면 새 짐(미완료)은 미완료 그룹, 즉 화면
  // 위쪽에 놓이는데, 예전에는 무조건 목록 맨 아래(scrollHeight)로 스크롤해서 새로
  // 추가한 짐이 화면 밖으로 밀려나 안 보이는 문제가 있었다 - 이제는 그 짐의 실제
  // 위치로 스크롤을 맞춘다.
  useEffect(() => {
    if (!lastAddedItemId) return;
    const el = listRef.current;
    const itemEl = el?.querySelector(
      `[data-item-id="${lastAddedItemId}"]`
    ) as HTMLElement | null;
    itemEl?.scrollIntoView({ block: "nearest" });
    setLastAddedItemId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAddedItemId]);

  // 검색 결과(짐 매칭)를 눌러서 들어온 경우(focusItemId) 해당 짐으로 스크롤하고 잠깐
  // 하이라이트(pib-search-highlight, globals.css)를 붙였다 뗀다. 이 화면은 팩 하나만 보여주므로
  // BagEditorScreen과 달리 펼치기/접기 처리는 필요 없다.
  useEffect(() => {
    if (!focusItemId) return;
    const targetId = focusItemId;
    const timer = window.setTimeout(() => {
      const el = listRef.current?.querySelector(
        `[data-item-id="${targetId}"]`
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("pib-search-highlight");
        window.setTimeout(() => el.classList.remove("pib-search-highlight"), 1850);
      }
      onFocusHandled?.();
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItemId]);

  // --- 짐 순서 변경(롱프레스 드래그) / 빠른팩 다중선택 이동 --------------------
  // 팩이 하나뿐인 화면이라 "다른 팩으로 이동"은 필요 없고, 같은 팩 안에서
  // 순서만 바꾼다. "가방 속 팩"과 동일하게 그립 아이콘 없이 롱프레스로 시작.
  // (빠른팩은 예외 - 아래 selectedItemIds 참고)
  const [drag, setDrag] = useState<{ itemId: string; overItemId: string | null } | null>(null);
  // 빠른팩에서만 쓰이는 다중선택 상태. null이면 선택 모드가 아님, Set이면 선택된 짐 id들.
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string> | null>(null);
  // 이동 목적지 시트 표시 여부 + (가방을 골라서 드릴다운했으면) 그 가방 id
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [moveSheetBagId, setMoveSheetBagId] = useState<string | null>(null);

  const handleStartItemDrag = (itemId: string) => {
    if (guardReadOnly()) return;
    if (pack.isQuickPack) {
      // 이미 선택 모드면 이 짐도 선택에 추가하고, 아니면 이 짐 하나로 선택 모드 시작.
      setSelectedItemIds((prev) => {
        const next = new Set(prev ?? []);
        next.add(itemId);
        return next;
      });
      return;
    }
    setDrag({ itemId, overItemId: null });
  };

  // 선택 모드 중 짐을 탭하면 선택을 토글한다. 전부 해제되면 선택 모드를 자동으로 끈다.
  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next.size === 0 ? null : next;
    });
  };

  const cancelSelection = () => {
    setSelectedItemIds(null);
    setShowMoveSheet(false);
    setMoveSheetBagId(null);
  };

  // 선택된 짐들을 목적지(라이브러리 팩 또는 가방의 특정 팩)로 이동한다: 지금 팩(빠른팩)
  // 에서는 제거하고, 목적지에는 새 복사본들을 즉시 원격저장한다. 되돌리기는 새로 생긴
  // 복사본들의 id만 기준으로 목적지에서 제거 + 원래 짐들을 다시 빠른팩에 복원한다.
  const commitMove = (
    destination: { kind: "library"; packId: string } | { kind: "bag"; bagId: string; packId: string }
  ) => {
    if (guardReadOnly()) return;
    if (!selectedItemIds || selectedItemIds.size === 0) return;
    const movedItems = pack.items.filter((i) => selectedItemIds.has(i.id));
    if (movedItems.length === 0) return;
    const copies = movedItems.map((i) => ({ ...i, id: uid() }));
    const copyIds = new Set(copies.map((c) => c.id));

    setPack((p) => ({ ...p, items: p.items.filter((i) => !selectedItemIds.has(i.id)) }));
    setSelectedItemIds(null);
    setShowMoveSheet(false);
    setMoveSheetBagId(null);

    let destinationLabel = "";
    if (destination.kind === "library") {
      const target = displayPacks.find((p) => p.id === destination.packId);
      if (!target) return;
      destinationLabel = target.name;
      onSaveOtherPack({ ...target, items: [...target.items, ...copies] });
    } else {
      const bag = displayBags.find((b) => b.id === destination.bagId);
      const targetPack = bag?.packs.find((p) => p.id === destination.packId);
      if (!bag || !targetPack) return;
      destinationLabel = `${bag.name} · ${targetPack.name}`;
      onAddItemsToBagPack?.(destination.bagId, destination.packId, copies);
    }

    show(`"${destinationLabel}"(으)로 ${movedItems.length}개 옮겼어요`, {
      actionLabel: "되돌리기",
      onAction: () => {
        setPack((p) => ({ ...p, items: [...p.items, ...movedItems] }));
        if (destination.kind === "library") {
          const target = displayPacks.find((p) => p.id === destination.packId);
          if (target) {
            onSaveOtherPack({ ...target, items: target.items.filter((i) => !copyIds.has(i.id)) });
          }
        } else {
          onRemoveItemsFromBagPack?.(destination.bagId, destination.packId, copyIds);
        }
      },
    });
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
      const overItemId = itemEl?.getAttribute("data-item-id") ?? null;
      setDrag((d) => (d ? { ...d, overItemId } : d));
    };

    const handleUp = () => {
      setDrag((d) => {
        if (d && d.overItemId && d.overItemId !== d.itemId) {
          setPack((p) => {
            const item = p.items.find((i) => i.id === d.itemId);
            if (!item) return p;
            const without = p.items.filter((i) => i.id !== d.itemId);
            const targetIndex = without.findIndex((i) => i.id === d.overItemId);
            if (targetIndex === -1) return p;
            return {
              ...p,
              items: [
                ...without.slice(0, targetIndex),
                item,
                ...without.slice(targetIndex),
              ],
            };
          });
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

  const deletingRef = useRef(false);

  // 짐을 추가/삭제/수정/순서변경하거나 팩 이름·색상을 바꿀 때마다(=pack 상태가 바뀔 때마다)
  // 0.5초 후 자동으로 저장한다. 상단의 별도 "저장" 버튼 없이도 항상 최신 상태가
  // 라이브러리에 반영되도록 하는 것이 목적. 처음 화면이 열릴 때(아직 아무것도 안 바꼈을 때)는
  // 저장하지 않는다. readOnly면 위의 모든 setPack 진입점이 guardReadOnly로 막혀있어서
  // pack 상태 자체가 변하지 않으므로, 이 effect도 자연히 실행되지 않는다.
  const [justSaved, setJustSaved] = useState(false);
  const isFirstPackEffect = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const justSavedTimerRef = useRef<number | null>(null);
  const onSaveRef = useRef(onSave);
  const packRef = useRef(pack);
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
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      onSaveRef.current(pack);
      setJustSaved(true);
      if (justSavedTimerRef.current) window.clearTimeout(justSavedTimerRef.current);
      justSavedTimerRef.current = window.setTimeout(() => setJustSaved(false), 1200);
    }, 500);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [pack]);

  // 화면을 나갈 때(뒤로가기 등) 아직 저장 안 된(디바운스 대기 중인) 변경사항이 있으면
  // 그 즉시 마지막 상태로 저장한다. 단, 팩 삭제 흐름 중에는 삭제된 팩이 다시
  // 만들어지는 경합을 피하기 위해 저장을 건너뛴다.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current && !deletingRef.current) {
        window.clearTimeout(saveTimerRef.current);
        onSaveRef.current(packRef.current);
      }
    };
  }, []);


  // iOS Safari/WKWebView는 키보드가 올라올 때 "레이아웃 뷰포트" 크기는 그대로 두고
  // 포커스된 입력창을 보여주려고 페이지 자체를 슬쩍 스크롤(팬)시킨다. 이 화면 높이를
  // visualViewport.height로 맞춰주는 것만으로는 이 자체 스크롤을 막지 못해서, 높이 보정과
  // 브라우저의 스크롤 보정이 동시에 일어나 헤더가 화면 밖으로 밀려버리는 문제가 있었다.
  // 그래서 (1) 화면 높이는 visualViewport.height로 맞추고, (2) 그 갱신 시점마다
  // window.scrollTo(0, 0)을 반복 호출해서 브라우저가 만들어내는 스크롤을 계속 취소한다.
  // resize/scroll 이벤트 직후 한 번, 그리고 iOS가 살짝 늦게 다시 스크롤시키는 경우까지
  // 잡기 위해 rAF + 짧은 지연 후 한 번 더 취소한다.
  // (sheet variant일 때도 그대로 켜둔다 - 인라인 이름 편집 중 키보드가 올라오면 시트가
  // 그만큼 위로 키를 채워서 입력창이 키보드에 가리지 않게 해준다.)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const cancelNativeScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };

    const update = () => {
      setViewportHeight(vv.height);
      cancelNativeScroll();
      requestAnimationFrame(cancelNativeScroll);
      window.setTimeout(cancelNativeScroll, 60);
      window.setTimeout(cancelNativeScroll, 200);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", cancelNativeScroll);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", cancelNativeScroll);
    };
  }, []);

  const selecting = pack.isQuickPack && selectedItemIds !== null;

  return (
    <div
      ref={swipeBackRef}
      className={`flex flex-col overflow-hidden ${variant === "sheet" ? "h-full" : "h-dvh"}`}
      style={variant === "fullscreen" && viewportHeight != null ? { height: `${viewportHeight}px` } : undefined}
    >
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={selecting ? cancelSelection : onBack}>
          {selecting ? (
            <IconX size={20} stroke={1.75} />
          ) : (
            <IconArrowLeft size={20} stroke={1.75} />
          )}
        </button>
        <div className="flex items-center gap-3">
          {selecting ? (
            <span className="text-[13px] font-medium">{selectedItemIds!.size}개 선택됨</span>
          ) : (
            <>
              <span
                className="text-[12px] text-text-muted"
                style={{ opacity: justSaved ? 1 : 0, transition: "opacity 200ms ease" }}
              >
                저장됨
              </span>
              {!readOnly && !pack.isQuickPack && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg px-2.5 py-1.5"
                >
                  <IconTrash size={18} stroke={1.75} color="var(--danger)" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <button
          onClick={onRequestUnlock}
          className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left shrink-0"
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

      {pack.isQuickPack && !selecting && (
        <p className="mx-4 mb-2 text-[11px] text-text-muted shrink-0">
          빠른입력으로 던져둔 짐들이에요. 짐을 길게 누르면 선택 모드가 시작돼요 - 다른 짐도
          탭해서 함께 선택한 뒤 원하는 팩(또는 가방 속 팩)으로 옮길 수 있어요.
        </p>
      )}

      <div className="flex items-center gap-2 px-4 pb-2 shrink-0">
        <PackColorDot
          colorId={pack.color}
          onChange={(colorId) => {
            if (guardReadOnly()) return;
            setPack((p) => ({ ...p, color: colorId }));
          }}
        />
        <EditableText
          value={pack.name}
          onChange={(name) => setPack((p) => ({ ...p, name }))}
          readOnly={readOnly || pack.isQuickPack}
          className="text-[18px] font-medium block text-left min-w-0 flex-1"
          inputClassName="text-[18px] font-medium block w-full"
          placeholder="새 팩"
        />
      </div>

      {/* 이미 추가된 짐 목록: 1개면 한 줄을 다 채우고, 늘어날수록 반응형으로
          여러 열로 재배치된다(auto-fit). 오른쪽 스와이프=수정, 왼쪽 스와이프=삭제,
          체크박스 제외 영역 롱프레스=순서변경 드래그 시작(빠른팩은 다중선택 모드 시작).
          다중선택 모드 중에는 탭 = 선택 토글이고 스와이프/드래그는 비활성화된다. */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pt-1 pb-3">
        {displayItems.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">
            아래 추가 버튼으로 짐을 추가해보세요.
          </p>
        ) : (
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
            style={{ gap: "8px 10px", alignItems: "start" }}
          >
            {displayItems.map((item) => {
              const isSelected = selecting && selectedItemIds!.has(item.id);
              return (
                <div
                  key={item.id}
                  style={
                    selecting
                      ? {
                          boxShadow: isSelected
                            ? "0 0 0 2px var(--accent)"
                            : "0 0 0 2px transparent",
                          borderRadius: 8,
                          background: isSelected ? "var(--accent-soft)" : undefined,
                        }
                      : undefined
                  }
                >
                  <ItemRow
                    item={item}
                    onToggle={item.type === "check" ? () => toggleItem(item.id) : undefined}
                    onChangeText={(text, style) => changeItemText(item.id, text, style)}
                    onDelete={() => deleteItem(item.id)}
                    onEdit={() => openEditModal(item)}
                    onStartDrag={() => handleStartItemDrag(item.id)}
                    isDragSource={drag?.itemId === item.id}
                    isDragOverTarget={drag?.overItemId === item.id}
                    disabled={selecting}
                    onRowTap={selecting ? () => toggleSelectItem(item.id) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 액션 영역: 평소엔 "추가" 버튼, 빠른팩 다중선택 중에는 "이동" 액션바로 바뀐다. */}
      {selecting ? (
        <div
          className="shrink-0 border-t border-border p-3 flex items-center gap-2"
          style={{ paddingBottom: "max(26px, calc(env(safe-area-inset-bottom) + 14px))" }}
        >
          <button
            onClick={cancelSelection}
            className="rounded-lg px-4 py-2.5 text-[14px]"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            취소
          </button>
          <button
            onClick={() => setShowMoveSheet(true)}
            className="flex-1 rounded-lg py-2.5 text-[14px] font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            이동
          </button>
        </div>
      ) : (
        !readOnly && (
          <div
            className="shrink-0 border-t border-border p-3 flex justify-center"
            style={{ paddingBottom: "max(26px, calc(env(safe-area-inset-bottom) + 14px))" }}
          >
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-1.5 rounded-full px-8 py-3 text-[15px] font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <IconPlus size={18} stroke={2} />
              추가
            </button>
          </div>
        )
      )}

      {itemModal && (
        <ItemFormModal
          packs={displayPacks}
          selectionMode="multi"
          initialSelectedPackIds={[pack.id]}
          mode={itemModal.mode}
          initialType={itemModal.mode === "edit" ? itemModal.item.type : "check"}
          initialText={itemModal.mode === "edit" ? itemModal.item.text : ""}
          initialBold={itemModal.mode === "edit" ? !!itemModal.item.bold : false}
          initialStrike={itemModal.mode === "edit" ? !!itemModal.item.strike : false}
          initialColor={itemModal.mode === "edit" ? itemModal.item.color || "" : ""}
          onClose={() => setItemModal(null)}
          onSave={handleModalSave}
        />
      )}

      {showMoveSheet && (
        <Portal>
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => {
              setShowMoveSheet(false);
              setMoveSheetBagId(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-2"
              style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
            >
              {moveSheetBagId ? (
                (() => {
                  const bag = displayBags.find((b) => b.id === moveSheetBagId);
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => setMoveSheetBagId(null)} aria-label="뒤로">
                          <IconChevronLeft size={18} stroke={1.75} color="var(--text-secondary)" />
                        </button>
                        <span className="text-[15px] font-medium truncate">
                          {bag?.name ?? "가방"}
                        </span>
                        <button
                          onClick={() => {
                            setShowMoveSheet(false);
                            setMoveSheetBagId(null);
                          }}
                          aria-label="닫기"
                          className="ml-auto"
                        >
                          <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                        {(bag?.packs ?? []).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => commitMove({ kind: "bag", bagId: bag!.id, packId: p.id })}
                            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left"
                            style={{ background: "var(--surface-2)" }}
                          >
                            <span className="text-[13px] font-medium truncate">{p.name}</span>
                            <span className="text-[11px] text-text-muted shrink-0">
                              {p.items.length}개
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[15px] font-medium">이동할 곳 선택</span>
                    <button
                      onClick={() => {
                        setShowMoveSheet(false);
                        setMoveSheetBagId(null);
                      }}
                      aria-label="닫기"
                    >
                      <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] text-text-muted px-1">라이브러리 팩</p>
                      {displayPacks.filter((p) => p.id !== pack.id).length === 0 ? (
                        <p className="text-[12px] text-text-muted py-2 px-1">
                          이동할 수 있는 라이브러리 팩이 없어요.
                        </p>
                      ) : (
                        displayPacks
                          .filter((p) => p.id !== pack.id)
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => commitMove({ kind: "library", packId: p.id })}
                              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left"
                              style={{ background: "var(--surface-2)" }}
                            >
                              <span className="text-[13px] font-medium truncate">{p.name}</span>
                              <span className="text-[11px] text-text-muted shrink-0">
                                {p.items.length}개
                              </span>
                            </button>
                          ))
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] text-text-muted px-1 mt-1">가방 속 팩</p>
                      {displayBags.length === 0 ? (
                        <p className="text-[12px] text-text-muted py-2 px-1">
                          이동할 수 있는 가방이 없어요.
                        </p>
                      ) : (
                        displayBags.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => setMoveSheetBagId(b.id)}
                            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left"
                            style={{ background: "var(--surface-2)" }}
                          >
                            <span className="min-w-0">
                              <span className="text-[13px] font-medium truncate block">{b.name}</span>
                              <span className="text-[11px] text-text-muted">
                                팩 {b.packs.length}개
                              </span>
                            </span>
                            <IconChevronRight
                              size={16}
                              stroke={1.75}
                              color="var(--text-muted)"
                              className="shrink-0"
                            />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 휴지통으로 보낼까요?"
          message="설정 > 휴지통에서 30일간 보관되며, 그 안에 복구할 수 있어요. 이미 가방에 불러온 팩에는 영향 없어요."
          confirmLabel="휴지통으로"
          tone="accent"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deletingRef.current = true;
            onDelete(pack.id);
          }}
        />
      )}
    </div>
  );
}
