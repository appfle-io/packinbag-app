"use client";

import { useState } from "react";
import type { BagFolder } from "@/lib/types";
import { normalizeFolderName } from "@/lib/bagFolderNames";
import { Button, Sheet } from "@/components/v2/ui";

const MAX_NAME = 20;

// 가방 폴더 만들기(folder 없음) / 이름 바꾸기·삭제(folder 있음).
// target: null이면 닫힘, "new"면 새 폴더, BagFolder면 그 폴더 편집.
export function FolderSheet({
  target,
  folders,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  target: "new" | BagFolder | null;
  // 이름 겹침 검사용(폴더는 1단계라 같은 이름이면 칩에서 구분할 수 없다)
  folders: BagFolder[];
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folderId: string) => void;
}) {
  const [cached, setCached] = useState(target);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 열릴 때마다(대상이 바뀔 때마다) 입력칸을 새로 채운다
  if (target && target !== cached) {
    setCached(target);
    setName(target === "new" ? "" : target.name);
    setConfirmDelete(false);
  }
  const t = target ?? cached;
  const isNew = t === "new";
  const folder = t && t !== "new" ? t : null;
  const trimmed = name.trim();
  const nameTaken =
    !!trimmed &&
    folders.some((f) => f.id !== folder?.id && normalizeFolderName(f.name) === normalizeFolderName(trimmed));

  const submit = () => {
    if (!trimmed || nameTaken) return;
    if (isNew) onCreate(trimmed);
    else if (folder && trimmed !== folder.name) onRename(folder.id, trimmed);
    onClose();
  };

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={isNew ? "새 폴더" : "폴더"}
      footer={
        <Button block disabled={!trimmed || nameTaken} onClick={submit}>
          {isNew ? "만들기" : "저장"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={name}
            maxLength={MAX_NAME}
            autoFocus
            aria-label="폴더 이름"
            placeholder="예: 여행, 일상, 업무"
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="done"
            className="h-12 w-full rounded-field border border-line bg-card px-4 text-body outline-none focus:border-ink"
          />
          {nameTaken && <p className="m-0 pt-2 text-caption text-alert">같은 이름의 폴더가 있어요</p>}
        </form>

        {folder &&
          (confirmDelete ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-body text-sub">폴더만 지워지고, 안에 있던 가방은 &lsquo;전체&rsquo;에 그대로 남아요.</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  취소
                </Button>
                <Button
                  className="flex-1 bg-alert text-on-brand"
                  onClick={() => {
                    onDelete(folder.id);
                    onClose();
                  }}
                >
                  폴더 삭제
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" className="self-start px-0" onClick={() => setConfirmDelete(true)}>
              폴더 삭제
            </Button>
          ))}
      </div>
    </Sheet>
  );
}
