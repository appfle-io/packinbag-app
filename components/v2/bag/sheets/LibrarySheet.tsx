"use client";

import { useState } from "react";
import { IconChevronRight, IconCloudDownload, IconCloudUpload, IconCopyPlus } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import type { LibraryStatus } from "@/hooks/bag";
import { Button, ListRow, Sheet } from "@/components/v2/ui";

// 가방 속 팩을 팩 보관함과 맞추는 시트(구 SaveAsDialog + PackUpdateDialog).
// - 보관함에 없는 팩: 이름을 확인하고 새로 저장(같은 이름이 있으면 바꾸게 한다)
// - 보관함과 달라진 팩: 다시 불러오기 / 원본에 덮어쓰기(원본이 다른 곳에서 먼저 바뀌었으면 숨김) / 새로운 팩으로 저장
// (보관함과 같은 팩은 부르는 쪽에서 토스트만 띄우고 이 시트를 열지 않는다)
export function LibrarySheet({
  pack,
  status,
  nameTaken,
  onSaveNew,
  onOverwrite,
  onRefresh,
  onClose,
}: {
  pack: Pack | null;
  status: LibraryStatus | null;
  nameTaken: (name: string) => boolean;
  onSaveNew: (name: string) => void;
  onOverwrite: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!pack && !!status && status.kind !== "same"} onClose={onClose} title="팩 보관함">
      {pack && status && status.kind !== "same" && (
        <LibraryBody
          key={`${pack.id}-${status.kind}`}
          pack={pack}
          status={status}
          nameTaken={nameTaken}
          onSaveNew={onSaveNew}
          onOverwrite={onOverwrite}
          onRefresh={onRefresh}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function LibraryBody({
  pack,
  status,
  nameTaken,
  onSaveNew,
  onOverwrite,
  onRefresh,
  onClose,
}: {
  pack: Pack;
  status: Exclude<LibraryStatus, { kind: "same" }>;
  nameTaken: (name: string) => boolean;
  onSaveNew: (name: string) => void;
  onOverwrite: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"choose" | "name">(status.kind === "unsaved" ? "name" : "choose");
  const [name, setName] = useState(pack.name);
  const trimmed = name.trim();
  const taken = trimmed.length > 0 && nameTaken(trimmed);

  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };

  if (step === "name") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed || taken) return;
          onSaveNew(trimmed);
          onClose();
        }}
      >
        <p className="m-0 text-body text-sub">
          {status.kind === "unsaved"
            ? "이 팩을 팩 보관함에 저장해 두면 다른 가방에서도 바로 불러올 수 있어요."
            : "보관함 원본은 그대로 두고, 지금 내용으로 새 팩을 하나 더 만들어요."}
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-caption font-semibold text-sub">보관함에 저장할 이름</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 rounded-field border border-line bg-card px-4 text-body-lg font-semibold outline-none focus:border-ink"
          />
        </label>
        {taken && <p className="m-0 text-caption text-alert">보관함에 같은 이름의 팩이 있어요. 다른 이름으로 저장해 주세요.</p>}
        <p className="m-0 text-caption text-faint">체크 표시와 담당자는 빼고, 아이템 목록만 저장해요.</p>
        <div className="flex gap-2">
          {status.kind !== "unsaved" && (
            <Button variant="secondary" className="flex-1" onClick={() => setStep("choose")}>
              뒤로
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={!trimmed || taken}>
            저장
          </Button>
        </div>
      </form>
    );
  }

  // 여기부터는 "보관함과 달라짐"일 때만 온다(unsaved는 처음부터 이름 단계)
  if (status.kind !== "changed") return null;

  return (
    <div className="flex flex-col gap-3">
      <p className={status.libraryNewer ? "m-0 text-body text-alert" : "m-0 text-body text-sub"}>
        {status.libraryNewer
          ? `보관함의 '${status.source.name}'이(가) 다른 곳에서 더 최근에 바뀌었어요. 덮어쓰면 그 변경이 사라져서, 다시 불러오거나 새 팩으로 저장할 수 있어요.`
          : `보관함의 '${status.source.name}'과(와) 내용이 달라요. 어떻게 맞출까요?`}
      </p>
      <div className="flex flex-col">
        <ListRow
          title="보관함에서 다시 불러오기"
          subtitle="이 가방의 팩을 보관함 내용으로 바꿔요. 같은 이름의 체크는 그대로 둬요"
          leading={<IconCloudDownload size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
          onClick={done(onRefresh)}
        />
        {!status.libraryNewer && (
          <ListRow
            title="보관함 원본에 덮어쓰기"
            subtitle="보관함의 팩을 지금 이 내용으로 바꿔요"
            leading={<IconCloudUpload size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
            onClick={done(onOverwrite)}
          />
        )}
        <ListRow
          divider={false}
          title="새로운 팩으로 저장"
          subtitle="원본은 두고 보관함에 하나 더 만들어요"
          leading={<IconCopyPlus size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
          trailing={<IconChevronRight size={16} stroke={1.75} className="text-faint" aria-hidden="true" />}
          onClick={() => {
            setName(`${pack.name} (2)`);
            setStep("name");
          }}
        />
      </div>
    </div>
  );
}
