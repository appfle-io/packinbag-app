"use client";

import { useState } from "react";
import { IconPlus, IconTicket } from "@tabler/icons-react";
import { Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { sortByOption } from "@/lib/listSort";
import BagCard from "@/components/BagCard";
import SortSelect from "@/components/SortSelect";
import JoinBagDialog from "@/components/JoinBagDialog";
import NewBagOptionsSheet from "@/components/NewBagOptionsSheet";
import NoteImportModal, { NoteImportResult } from "@/components/NoteImportModal";
import SampleBagSheet from "@/components/SampleBagSheet";
import { useToast } from "@/components/Toast";

export default function HomeScreen({
  bags,
  initialInviteCode,
  lockedBagIds,
  onOpenBag,
  onNewBag,
  onImportNote,
  onJoinBag,
}: {
  bags: Bag[];
  initialInviteCode?: string;
  // 무료 전환으로 잠긴(내가 소유한) 가방 id 목록. 카드에 자물쇠 표시만 하고, 탭하면
  // 여전히 열린다 - 실제 읽기 전용 처리는 BagEditorScreen(AppShell이 계산해서 넘긴 readOnly)이 한다.
  lockedBagIds?: Set<string>;
  onOpenBag: (bag: Bag) => void;
  onNewBag: () => void;
  onImportNote: (result: NoteImportResult) => void;
  onJoinBag: (code: string) => Promise<void>;
}) {
  const [showJoin, setShowJoin] = useState(!!initialInviteCode);
  const [showNewBagOptions, setShowNewBagOptions] = useState(false);
  const [showNoteImport, setShowNoteImport] = useState(false);
  const [showSampleSheet, setShowSampleSheet] = useState(false);
  const { profile, updateBagSortBy } = useAuth();
  const { show } = useToast();
  const sortBy = profile?.bagSortBy ?? "createdAt";
  const sortedBags = sortByOption(bags, sortBy);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-[22px] font-bold shrink-0">가방</h1>
          <span className="text-[12px] text-text-muted truncate">
            팩을 모아 자유롭게 정리하는 공간이에요
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 gap-2">
        <button
          onClick={() => setShowJoin(true)}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] shrink-0"
        >
          <IconTicket size={14} stroke={1.75} />
          코드로 참여
        </button>
        {bags.length > 0 && (
          <SortSelect value={sortBy} onChange={(v) => updateBagSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
        )}
      </div>

      {bags.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <button
            onClick={() => setShowNewBagOptions(true)}
            className="h-14 w-14 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <IconPlus size={26} stroke={1.75} color="#fff" />
          </button>
          <span className="text-[13px] text-text-muted">
            새 가방 만들기
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {sortedBags.map((bag) => (
            <BagCard
              key={bag.id}
              bag={bag}
              locked={lockedBagIds?.has(bag.id)}
              onClick={() => onOpenBag(bag)}
            />
          ))}
          <button
            onClick={() => setShowNewBagOptions(true)}
            className="aspect-square rounded-xl border border-dashed border-border-strong flex items-center justify-center text-text-muted"
          >
            <IconPlus size={22} stroke={1.75} />
          </button>
        </div>
      )}

      {showJoin && (
        <JoinBagDialog
          initialCode={initialInviteCode}
          onCancel={() => setShowJoin(false)}
          onConfirm={async (code) => {
            await onJoinBag(code);
            setShowJoin(false);
          }}
        />
      )}

      {showNewBagOptions && (
        <NewBagOptionsSheet
          onClose={() => setShowNewBagOptions(false)}
          onBlank={() => {
            setShowNewBagOptions(false);
            onNewBag();
          }}
          onFromSample={() => {
            setShowNewBagOptions(false);
            setShowSampleSheet(true);
          }}
          onFromNote={() => {
            setShowNewBagOptions(false);
            setShowNoteImport(true);
          }}
        />
      )}

      {showSampleSheet && (
        <SampleBagSheet
          onClose={() => setShowSampleSheet(false)}
          onSelect={(result) => {
            setShowSampleSheet(false);
            onImportNote(result);
          }}
        />
      )}

      {showNoteImport && (
        <NoteImportModal
          onClose={() => setShowNoteImport(false)}
          onResult={(result) => {
            setShowNoteImport(false);
            onImportNote(result);
          }}
        />
      )}
    </div>
  );
}
