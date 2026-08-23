"use client";

import { useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

export default function PackSettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updatePackSettings } = useAuth();
  const { show } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);

  const handleReset = async () => {
    try {
      await updatePackSettings({
        moveCompletedToBottom: true,
        alwaysCollapseOnEntry: false,
        itemMaxLines: 1,
        packTreeHintEnabled: true,
        noteSpellcheckEnabled: false,
        dueDateDisplayMode: "dday",
        dueDateIntensifyEnabled: true,
        dueDateIntensifyDays: 7,
      });
      setConfirmReset(false);
      show("팩 설정이 기본값으로 초기화되었어요");
    } catch {
      show("설정 초기화에 실패했어요");
    }
  };
  // 명시적으로 꺼둔 적이 없으면 기본 켜짐
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  // 명시적으로 켜둔 적이 없으면 기본 꺼짐
  const alwaysCollapseOnEntry = profile?.packSettings?.alwaysCollapseOnEntry ?? false;
  // 짐 최대 표시 줄 수 (없으면 1줄 기본값)
  const itemMaxLines = profile?.packSettings?.itemMaxLines ?? 1;
  // 스와이프 힌트 물방울 보이기 여부 (명시적으로 꺼둔 적이 없으면 기본 켜짐)
  // - 가방↔팩 보관함 양방향 스와이프 힌트 버튼을 이 값 하나로 같이 켜고 끈다.
  const packTreeHintEnabled = profile?.packSettings?.packTreeHintEnabled ?? true;
  // 메모 맞춤법 검사 (없으면 기본 false 끄기)
  const noteSpellcheckEnabled = profile?.packSettings?.noteSpellcheckEnabled ?? false;

  // 짐 마감일 표시 방식 (없으면 "dday" 기본값)
  const dueDateDisplayMode = profile?.packSettings?.dueDateDisplayMode ?? "dday";
  // 마감일이 다가올수록 뱃지 색상을 점점 진하게 보여줄지 (없으면 기본값 켜짐)
  const dueDateIntensifyEnabled = profile?.packSettings?.dueDateIntensifyEnabled ?? true;
  // 위 옵션이 켜져 있을 때, 며칠 전부터 색상이 진해지기 시작할지 (없으면 7일전 기본값)
  const dueDateIntensifyDays = profile?.packSettings?.dueDateIntensifyDays ?? 7;

  // select 공통 스타일 - 라벨 옆에 붙는 작은 드롭다운 (토글 스위치와 같은 자리에 놓인다)
  const selectClassName =
    "shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[13px] outline-none";
  const selectStyle = { background: "var(--surface-2)", color: "var(--foreground)" };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">팩 설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        <p className="text-[11px] text-text-muted -mb-1">
          가방/팩 안의 짐 목록이 보여지는 방식을 설정해요
        </p>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">완료된 항목 맨 아래로 이동</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              체크한 짐을 목록 아래쪽으로 내려서 보여줘요
            </p>
          </div>
          <ToggleSwitch
            checked={moveCompletedToBottom}
            onChange={(v) => updatePackSettings({ moveCompletedToBottom: v })}
            ariaLabel="완료된 항목 맨 아래로 이동"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">가방 열 때 팩 접어서 보기</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              가방에 들어갈 때마다 팩이 접힌 상태로 시작돼요. 이후엔 자유롭게 펼치고 접을 수 있어요.
            </p>
          </div>
          <ToggleSwitch
            checked={alwaysCollapseOnEntry}
            onChange={(v) => updatePackSettings({ alwaysCollapseOnEntry: v })}
            ariaLabel="가방 열 때 팩 접어서 보기"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">짐 최대 표시 줄 수</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              짐 이름이 길면 여기서 고른 줄 수까지만 보여주고 나머지는 ...으로 줄여요
            </p>
          </div>
          <select
            value={String(itemMaxLines)}
            onChange={(e) => updatePackSettings({ itemMaxLines: Number(e.target.value) as 1 | 2 | 3 })}
            aria-label="짐 최대 표시 줄 수"
            className={selectClassName}
            style={selectStyle}
          >
            <option value="1">1줄</option>
            <option value="2">2줄</option>
            <option value="3">3줄</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">짐 마감일 표시 방식</p>
              <p className="text-[11.5px] text-text-secondary mt-0.5">
                짐별로 마감일을 설정해둔 경우, 리스트에서 어떤 형식으로 보여줄지 골라요
              </p>
            </div>
            <select
              value={dueDateDisplayMode}
              onChange={(e) => updatePackSettings({ dueDateDisplayMode: e.target.value as "dday" | "date" })}
              aria-label="짐 마감일 표시 방식"
              className={selectClassName}
              style={selectStyle}
            >
              <option value="dday">D-day (D-3)</option>
              <option value="date">실제 날짜 (7/30)</option>
            </select>
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">마감일 다가올수록 색상 진하게</p>
              <p className="text-[11.5px] text-text-secondary mt-0.5">
                당일이 가까워질수록 뱃지가 회색에서 새빨간색으로 점점 진해져요. 끄면 지난/임박/평소 3단계로만 구분돼요.
              </p>
            </div>
            <select
              value={dueDateIntensifyEnabled ? String(dueDateIntensifyDays) : "off"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "off") {
                  updatePackSettings({ dueDateIntensifyEnabled: false });
                } else {
                  updatePackSettings({ dueDateIntensifyEnabled: true, dueDateIntensifyDays: Number(v) });
                }
              }}
              aria-label="마감일 다가올수록 색상 진하게"
              className={selectClassName}
              style={selectStyle}
            >
              <option value="off">끄기</option>
              <option value="3">3일전부터</option>
              <option value="7">1주일전부터</option>
              <option value="14">2주일전부터</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">가방 보관함 ↔ 팩 보관함 이동 버튼</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              가방 보관함 왼쪽, 팩 보관함 오른쪽 가장자리에 서로 오갈 수 있는 버튼을 띄워줘요. 꺼도 가장자리를 스와이프하면 버튼 없이도 화면을 오갈 수 있어요.
            </p>
          </div>
          <ToggleSwitch
            checked={packTreeHintEnabled}
            onChange={(v) => updatePackSettings({ packTreeHintEnabled: v })}
            ariaLabel="팩 보관함 열기 버튼"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">메모 맞춤법 검사 (빨간 밑줄)</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              메모팩 작성 시 기술 용어나 오탈자 아래에 표시되는 브라우저 빨간 밑줄을 켜거나 꺼요. (메모팩 안 툴바에서도 바로 변경할 수 있어요)
            </p>
          </div>
          <ToggleSwitch
            checked={noteSpellcheckEnabled}
            onChange={(v) => updatePackSettings({ noteSpellcheckEnabled: v })}
            ariaLabel="메모 맞춤법 검사"
          />
        </div>

        <div className="mt-4 mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-lg border border-border px-4 py-2 text-[12.5px] text-text-secondary hover:text-foreground bg-surface-2 transition-colors"
          >
            팩 설정 초기화
          </button>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="팩 설정을 초기화하시겠어요?"
          message="완료된 항목 이동, 짐 최대 줄 수, 마감일 표시 방식 등 모든 팩 설정이 기본값으로 돌아가요."
          confirmLabel="초기화"
          tone="accent"
          onCancel={() => setConfirmReset(false)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
