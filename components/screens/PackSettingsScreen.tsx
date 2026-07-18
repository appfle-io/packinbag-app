"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import ToggleSwitch from "@/components/ToggleSwitch";

export default function PackSettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, updatePackSettings } = useAuth();
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  // 명시적으로 꺼둔 적이 없으면 기본 켜짐
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  // 명시적으로 켜둔 적이 없으면 기본 꺼짐
  const alwaysCollapseOnEntry = profile?.packSettings?.alwaysCollapseOnEntry ?? false;
  // 짐 최대 표시 줄 수 (없으면 1줄 기본값)
  const itemMaxLines = profile?.packSettings?.itemMaxLines ?? 1;
  // 짐 더블클릭 복사 토스트 노출 시간 (없으면 3초 기본값, 3~7초)
  const itemCopyToastSeconds = profile?.packSettings?.itemCopyToastSeconds ?? 3;
  // 스와이프 힌트 물방울 보이기 여부 (명시적으로 꺼둔 적이 없으면 기본 켜짐)
  const packTreeHintEnabled = profile?.packSettings?.packTreeHintEnabled ?? true;

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">팩 설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        <p className="text-[11px] text-text-muted -mb-1">
          가방/팩 안의 짐 목록이 보여지는 방식을 설정해요
        </p>

        <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between gap-3">
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

        <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between gap-3">
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

        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-[13px] font-medium">짐 최대 표시 줄 수</p>
          <p className="text-[11.5px] text-text-secondary mt-0.5">
            짐 이름이 길면 여기서 고른 줄 수까지만 보여주고 나머지는 ...으로 줄여요
          </p>
          <div className="mt-2.5 flex rounded-lg border border-border overflow-hidden">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => updatePackSettings({ itemMaxLines: n as 1 | 2 | 3 })}
                className="flex-1 py-2 text-[13px]"
                style={{
                  background: itemMaxLines === n ? "var(--accent)" : "var(--surface-2)",
                  color: itemMaxLines === n ? "#fff" : "var(--foreground)",
                }}
              >
                {n}줄{n === 1 ? " (기본)" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">팩 트리 열기 버튼</p>
            <p className="text-[11.5px] text-text-secondary mt-0.5">
              가방보관함 왼쪽 가장자리에 팩 트리를 열 수 있는 버튼을 띄워줘요. 꺼도 왼쪽 가장자리를 오른쪽으로 스와이프하면 버튼 없이도 팩 트리가 열려요.
            </p>
          </div>
          <ToggleSwitch
            checked={packTreeHintEnabled}
            onChange={(v) => updatePackSettings({ packTreeHintEnabled: v })}
            ariaLabel="팩 트리 열기 버튼"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-[13px] font-medium">짐 더블클릭 복사 알림 노출 시간</p>
          <p className="text-[11.5px] text-text-secondary mt-0.5">
            짐을 더블클릭하면 내용이 클립보드에 복사돼요. 복사된 내용을 알려주는 알림을 몇 초간 보여줄지 골라요
          </p>
          <div className="mt-2.5 flex rounded-lg border border-border overflow-hidden">
            {[3, 4, 5, 6, 7].map((sec) => (
              <button
                key={sec}
                onClick={() => updatePackSettings({ itemCopyToastSeconds: sec })}
                className="flex-1 py-2 text-[13px]"
                style={{
                  background: itemCopyToastSeconds === sec ? "var(--accent)" : "var(--surface-2)",
                  color: itemCopyToastSeconds === sec ? "#fff" : "var(--foreground)",
                }}
              >
                {sec}초
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
