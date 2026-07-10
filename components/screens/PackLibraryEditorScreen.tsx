"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconTrash, IconPlus, IconLock } from "@tabler/icons-react";
import { Item, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import EditableText from "@/components/EditableText";
import ItemRow from "@/components/ItemRow";
import ItemFormModal, { ItemFormSaveData } from "@/components/ItemFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import PackColorDot from "@/components/PackColorDot";
import { useToast } from "@/components/Toast";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 팩 편집 화면: 짐 추가/수정은 하단 "추가" 버튼으로 중앙 모달(ItemFormModal)을 열어서
// 처리한다. 가방 속 팩 편집과 다른 점은, 상단 팩 선택이 라디오형(하나만)이 아니라
// 체크박스형(여러 개)이라는 것 - 라이브러리에 있는 다른 팩도 함께 체크하면 그 팩들에도
// 동시에 짐이 추가/복사된다. 이미 추가된 짐은 기존과 동일하게 오른쪽 스와이프=수정
// (역시 이 모달을 열도록 변경), 왼쪽 스와이프=삭제로 조작하고, 체크박스 제외 영역을
// 롱프레스하면(그립 아이콘 없음) 같은 팩 안에서 순서를 바꿀 수 있다.
export default function PackLibraryEditorScreen({
  initialPack,
  libraryPacks,
  lockedPackIds,
  readOnly,
  onRequestUnlock,
  onBack,
  onSave,
  onSaveOtherPack,
  onDelete,
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
  // true면 지금 편집 중인 이 팩 자체가 잠긴 상태. 보기만 가능하고 모든 수정/삭제가 막힌다.
  readOnly: boolean;
  onRequestUnlock: () => void;
  onBack: () => void;
  onSave: (pack: Pack) => void;
  // 지금 편집 중인 팩이 아닌 "다른" 팩에 짐을 추가/복사할 때 그 팩을 즉시 원격저장.
  onSaveOtherPack: (pack: Pack) => void;
  onDelete: (packId: string) => void;
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
      setPack((p) => ({ ...p, items: [...p.items, buildNewItem(data)] }));
    }

    otherPackIds.forEach((packId) => {
      const target = libraryPacks.find((p) => p.id === packId);
      if (!target) return;
      onSaveOtherPack({ ...target, items: [...target.items, buildNewItem(data)] });
    });

    setItemModal(null);
  };

  // 짐을 새로 추가하면(= 목록 끝에 쌓이면) 입력창 바로 위, 즉 목록 맨 아래로
  // 자동 스크롤해서 방금 추가한 짐이 바로 보이게 한다.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [pack.items.length]);

  // --- 짐 순서 변경(롱프레스 드래그) ------------------------------------
  // 팩이 하나뿐인 화면이라 "다른 팩으로 이동"은 필요 없고, 같은 팩 안에서
  // 순서만 바꾼다. "가방 속 팩"과 동일하게 그립 아이콘 없이 롱프레스로 시작.
  const [drag, setDrag] = useState<{ itemId: string; overItemId: string | null } | null>(null);

  const handleStartItemDrag = (itemId: string) => {
    if (guardReadOnly()) return;
    setDrag({ itemId, overItemId: null });
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
      cancelNativeScroll();
    };
  }, []);

  return (
    <div
      ref={swipeBackRef}
      className="flex flex-col overflow-hidden h-dvh"
      style={viewportHeight != null ? { height: `${viewportHeight}px` } : undefined}
    >
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={onBack}>
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <div className="flex items-center gap-3">
          <span
            className="text-[12px] text-text-muted"
            style={{ opacity: justSaved ? 1 : 0, transition: "opacity 200ms ease" }}
          >
            저장됨
          </span>
          {!readOnly && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg px-2.5 py-1.5"
            >
              <IconTrash size={18} stroke={1.75} color="var(--danger)" />
            </button>
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
          readOnly={readOnly}
          className="text-[18px] font-medium block text-left min-w-0 flex-1"
          inputClassName="text-[18px] font-medium block w-full"
          placeholder="새 팩"
        />
      </div>

      {/* 이미 추가된 짐 목록: 1개면 한 줄을 다 채우고, 늘어날수록 반응형으로
          여러 열로 재배치된다(auto-fit). 오른쪽 스와이프=수정, 왼쪽 스와이프=삭제,
          체크박스 제외 영역 롱프레스=순서변경 드래그 시작. */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-3">
        {displayItems.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">
            아래 추가 버튼으로 짐을 추가해보세요.
          </p>
        ) : (
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
            style={{ gap: "8px 10px", alignItems: "start" }}
          >
            {displayItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={item.type === "check" ? () => toggleItem(item.id) : undefined}
                onChangeText={(text, style) => changeItemText(item.id, text, style)}
                onDelete={() => deleteItem(item.id)}
                onEdit={() => openEditModal(item)}
                onStartDrag={() => handleStartItemDrag(item.id)}
                isDragSource={drag?.itemId === item.id}
                isDragOverTarget={drag?.overItemId === item.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* 하단 중앙 "추가" 버튼 - 누르면 짐 추가/수정 모달(ItemFormModal)이 뜬다.
          가방 속 팩과 달리 상단 팩 선택이 체크박스형(여러개 선택 가능)이다. */}
      {!readOnly && (
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

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 삭제할까요?"
          message="이미 가방에 불러와진 팩에는 영향 없어요."
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
