"use client";

import { useState } from "react";
import {
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconPlus,
  IconSquareCheck,
  IconAlignLeft,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";
import PackImportModal from "@/components/PackImportModal";
import { Pack } from "@/lib/types";

export default function GuidePackSaveDemo() {
  const [isSavedInLibrary, setIsSavedInLibrary] = useState(false);
  const [showPackImportModal, setShowPackImportModal] = useState(false);
  const [importedPacks, setImportedPacks] = useState<Pack[]>([]);

  const libraryPacks: Pack[] = [
    {
      id: "lib-pack-1",
      name: "전자기기 & 충전",
      type: "pack",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        { id: "li-1", type: "check", text: "110V 돼지코 어댑터", checked: false },
        { id: "li-2", type: "check", text: "스마트폰 고속 충전기", checked: false },
        { id: "li-3", type: "check", text: "보조배터리 20000mAh", checked: true },
      ],
    },
    {
      id: "lib-pack-2",
      name: "세면 & 위생용품",
      type: "pack",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        { id: "li-4", type: "check", text: "칫솔 & 치약 세트", checked: false },
        { id: "li-5", type: "check", text: "선크림 SPF50+", checked: true },
      ],
    },
  ];

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      <div className="p-3.5 rounded-2xl bg-white dark:bg-surface border border-border flex flex-col gap-3">
        {/* 1단계: 가방 1에서 팩을 보관함에 저장하기 */}
        <div className="rounded-xl border border-border bg-white dark:bg-surface-2 p-3.5 flex flex-col gap-2 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="font-bold text-[13px] text-foreground">전자기기 & 충전</span>
            {isSavedInLibrary && (
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-accent-soft text-accent font-medium">
                보관함에 저장됨
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-text-muted">가방 1</span>
        </div>

        <div className="py-1 flex flex-col gap-1.5 text-[12px] text-text-secondary">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded border border-border-strong bg-surface-2" />
            <span>110V 돼지코 어댑터</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded border border-border-strong bg-surface-2" />
            <span>보조배터리 20000mAh</span>
          </div>
        </div>

        {/* 실제 팩 카드 하단 툴바 */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-text-muted">
            <IconSquareCheck size={16} stroke={1.75} />
            <IconAlignLeft size={16} stroke={1.75} />
          </div>

          <div className="flex items-center gap-1">
            {/* 실제 앱의 저장 버튼 */}
            <button
              type="button"
              onClick={() => setIsSavedInLibrary(!isSavedInLibrary)}
              className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
              title="보관함에 저장"
            >
              {isSavedInLibrary ? (
                <IconDeviceFloppyFilled size={18} stroke={1.75} className="text-accent" />
              ) : (
                <IconDeviceFloppy size={18} stroke={1.75} className="text-text-secondary" />
              )}
            </button>
            <button type="button" className="p-1.5 text-text-muted">
              <IconTrash size={17} stroke={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* 2단계: 가방 2에서 "+ 팩 추가" 버튼을 눌러 보관함에서 실제 팩 카드 불러오기 */}
      <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 flex flex-col gap-2.5 shadow-xs">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[12px] font-bold text-foreground">
            가방 2 (다음 여행)
          </span>
          <span className="text-[10.5px] font-mono text-text-muted">
            {importedPacks.length}개 팩 담김
          </span>
        </div>

        {/* 불러온 실제 PackCard들 렌더링 */}
        {importedPacks.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-border bg-surface/80 backdrop-blur-xs p-3 flex flex-col gap-2 shadow-xs"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <span className="font-bold text-[13px] text-foreground">{p.name}</span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-accent-soft text-accent font-medium">
                  보관함에서 불러옴
                </span>
              </div>
              <span className="text-[11px] font-mono text-text-muted">{p.items.length}개</span>
            </div>

            <div className="flex flex-col gap-1.5 text-[12px]">
              {p.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <div
                    className={`h-3.5 w-3.5 rounded flex items-center justify-center shrink-0 ${
                      item.checked ? "bg-accent text-white" : "border border-border-strong bg-surface/50"
                    }`}
                  >
                    {item.checked && <IconCheck size={10} stroke={3} />}
                  </div>
                  <span className={item.checked ? "line-through text-text-muted" : "text-foreground"}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 실제 가방 하단의 "+ 팩 추가" 버튼 */}
        <button
          type="button"
          onClick={() => setShowPackImportModal(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-border-strong hover:border-accent bg-surface-2/30 hover:bg-surface-2/60 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-foreground transition-all cursor-pointer"
        >
          <IconPlus size={15} stroke={2.5} className="text-accent" />
          <span>팩 추가</span>
        </button>
      </div>
      </div>

      {/* 실제 프로젝트의 PackImportModal 연동 */}
      {showPackImportModal && (
        <PackImportModal
          libraryPacks={libraryPacks}
          onClose={() => setShowPackImportModal(false)}
          onCreateNew={() => setShowPackImportModal(false)}
          onImport={(imported) => {
            setImportedPacks((prev) => [...prev, ...imported]);
            setShowPackImportModal(false);
          }}
        />
      )}
    </div>
  );
}
