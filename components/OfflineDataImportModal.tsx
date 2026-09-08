"use client";

import { useMemo, useState } from "react";
import {
  IconX,
  IconCheck,
  IconBackpack,
  IconFolder,
  IconNotes,
  IconListCheck,
  IconCloudUpload,
  IconInfoCircle,
} from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { useAuth } from "@/contexts/AuthProvider";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useToast } from "@/components/Toast";
import {
  getOfflineDataSummary,
  getImportedOfflineIds,
  importOfflineDataToOnline,
} from "@/lib/offlineImportService";

interface OfflineDataImportModalProps {
  onClose: () => void;
  onImportComplete?: () => void;
}

export default function OfflineDataImportModal({
  onClose,
  onImportComplete,
}: OfflineDataImportModalProps) {
  const { user, profile } = useAuth();
  const { show: showToast } = useToast();
  const ambientLayer = useOverlayLayer();
  const zIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const summary = useMemo(() => getOfflineDataSummary(), []);
  const importedIds = useMemo(() => getImportedOfflineIds(), []);

  // 기본적으로 아직 가져오지 않은 항목들을 체크 상태로 초기화
  const [selectedBagIds, setSelectedBagIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const bag of summary.bags) {
      if (!importedIds.has(bag.id)) {
        set.add(bag.id);
      }
    }
    return set;
  });

  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const pack of summary.packs) {
      if (!importedIds.has(pack.id)) {
        set.add(pack.id);
      }
    }
    return set;
  });

  const [busy, setBusy] = useState(false);

  const toggleBag = (id: string) => {
    setSelectedBagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePack = (id: string) => {
    setSelectedPackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotalCount = selectedBagIds.size + selectedPackIds.size;

  const handleImport = async () => {
    if (!user || !profile) return;
    if (selectedTotalCount === 0) {
      showToast("가져올 항목을 1개 이상 선택해주세요.");
      return;
    }

    setBusy(true);
    try {
      const result = await importOfflineDataToOnline({
        user,
        profile,
        selectedBagIds: Array.from(selectedBagIds),
        selectedPackIds: Array.from(selectedPackIds),
      });

      showToast(
        `오프라인 가방 ${result.importedBagsCount}개, 팩 ${result.importedPacksCount}개를 내 계정으로 가져왔어요.`
      );
      if (onImportComplete) onImportComplete();
      onClose();
    } catch (err) {
      console.error("[OfflineDataImportModal] 가져오기 실패:", err);
      showToast("가져오기 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[2px] transition-opacity"
        style={{ zIndex }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-accent-soft text-accent shrink-0">
                <IconCloudUpload size={20} stroke={1.75} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-foreground">오프라인 데이터 가져오기</h2>
                <p className="text-[11.5px] text-text-muted mt-0.5">
                  오프라인에서 작성한 가방과 팩을 내 온라인 계정으로 복사해요.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="닫기"
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <IconX size={20} stroke={1.75} />
            </button>
          </div>

          {/* 안내 배너 */}
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-surface-2 border border-border/80 flex items-start gap-2 text-[11.5px] text-text-secondary leading-relaxed shrink-0">
            <IconInfoCircle size={16} stroke={1.75} className="shrink-0 text-accent mt-0.5" />
            <span>
              가져온 데이터는 내 온라인 계정에 안전하게 저장되며, <strong>오프라인 로컬 데이터도 그대로 보존</strong>되어 언제든 다시 열람할 수 있어요.
            </span>
          </div>

          {/* 목록 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 가방 섹션 */}
            {summary.bags.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-text-secondary flex items-center gap-1.5">
                    <span>오프라인 가방</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-surface-2 text-text-muted">
                      {summary.bags.length}
                    </span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  {summary.bags.map((bag) => {
                    const isChecked = selectedBagIds.has(bag.id);
                    const isAlreadyImported = importedIds.has(bag.id);
                    return (
                      <div
                        key={bag.id}
                        onClick={() => toggleBag(bag.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-accent-soft/20 border-accent/70"
                            : "bg-surface border-border/70 hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBag(bag.id)}
                            className="rounded accent-accent w-4 h-4 cursor-pointer"
                          />
                          <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                            <IconBackpack size={16} stroke={1.75} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium truncate">{bag.name}</span>
                              {isAlreadyImported && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                                  가져옴
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-text-muted">팩 {bag.packs?.length || 0}개</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 팩 보관함 섹션 */}
            {summary.packs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-text-secondary flex items-center gap-1.5">
                    <span>오프라인 보관함 팩</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-surface-2 text-text-muted">
                      {summary.packs.length}
                    </span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  {summary.packs.map((pack) => {
                    const isChecked = selectedPackIds.has(pack.id);
                    const isAlreadyImported = importedIds.has(pack.id);
                    const isFolder = pack.type === "folder";
                    const isEditor = pack.kind === "editor";
                    return (
                      <div
                        key={pack.id}
                        onClick={() => togglePack(pack.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-accent-soft/20 border-accent/70"
                            : "bg-surface border-border/70 hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePack(pack.id)}
                            className="rounded accent-accent w-4 h-4 cursor-pointer"
                          />
                          <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                            {isFolder ? (
                              <IconFolder size={16} stroke={1.75} />
                            ) : isEditor ? (
                              <IconNotes size={16} stroke={1.75} />
                            ) : (
                              <IconListCheck size={16} stroke={1.75} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium truncate">{pack.name}</span>
                              {isAlreadyImported && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                                  가져옴
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-text-muted">
                              {isFolder ? "폴더" : isEditor ? "메모팩" : `체크리스트 ${pack.items?.length || 0}개`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {summary.bags.length === 0 && summary.packs.length === 0 && (
              <div className="p-8 text-center text-text-muted text-[13px]">
                가져올 수 있는 오프라인 데이터가 없어요.
              </div>
            )}
          </div>

          {/* 하단 액션 버튼 */}
          <div className="p-4 border-t border-border flex items-center justify-between gap-2 shrink-0 bg-surface">
            <span className="text-[12px] text-text-muted">
              선택됨: <strong className="text-foreground">{selectedTotalCount}</strong>개
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-3 py-2 rounded-xl text-[13px] font-medium text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={busy || selectedTotalCount === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-contrast font-semibold text-[13px] shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
              >
                {busy ? "가져오는 중..." : "내 계정으로 가져오기"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
