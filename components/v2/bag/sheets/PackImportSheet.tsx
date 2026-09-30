"use client";

import { useMemo, useState } from "react";
import { IconChevronRight, IconFolder, IconNotes, IconPlus, IconSearch } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { Badge, Button, CheckMark, ListRow, Sheet, cx } from "@/components/v2/ui";

// 팩 불러오기 시트: 보관함 폴더를 한 단계씩 들어가며 여러 팩을 고른다. 검색은 모든 폴더 대상.
// 이미 이 가방에 들어 있는 보관함 팩(linkedLibraryPackId)은 "가방에 있음"으로 흐리게 보여준다.
export function PackImportSheet({
  open,
  onClose,
  libraryPacks,
  bagPacks,
  onImport,
  onCreateEmpty,
}: {
  open: boolean;
  onClose: () => void;
  libraryPacks: Pack[];
  bagPacks: Pack[];
  onImport: (packs: Pack[]) => void;
  onCreateEmpty: () => void;
}) {
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const entries = useMemo(() => libraryPacks.filter((p) => !p.trashedAt), [libraryPacks]);
  const inBag = useMemo(() => new Set(bagPacks.map((p) => p.linkedLibraryPackId).filter(Boolean) as string[]), [bagPacks]);
  const folderId = path[path.length - 1];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return entries.filter(
        (p) =>
          p.type !== "folder" &&
          (p.name.toLowerCase().includes(q) || p.items.some((i) => i.text.toLowerCase().includes(q)) || (p.editorPreviewText ?? "").toLowerCase().includes(q)),
      );
    }
    const here = entries.filter((p) => (p.parentId ?? undefined) === folderId);
    return [...here.filter((p) => p.type === "folder"), ...here.filter((p) => p.type !== "folder")];
  }, [entries, folderId, query]);

  const crumbs = [{ id: undefined as string | undefined, name: "보관함" }, ...path.map((id) => ({ id, name: entries.find((p) => p.id === id)?.name ?? "폴더" }))];

  const chosen = entries.filter((p) => selected.has(p.id));
  const itemCount = chosen.reduce((n, p) => n + p.items.length, 0);

  const reset = () => {
    setPath([]);
    setQuery("");
    setSelected(new Set());
  };
  const close = () => {
    reset();
    onClose();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const countIn = (folder: string): number =>
    entries.filter((p) => p.parentId === folder).reduce((n, p) => n + (p.type === "folder" ? countIn(p.id) : 1), 0);

  return (
    <Sheet
      open={open}
      onClose={close}
      title="팩 불러오기"
      size="tall"
      footer={
        <Button
          block
          disabled={chosen.length === 0}
          onClick={() => {
            onImport(chosen);
            close();
          }}
        >
          {chosen.length === 0 ? "추가할 팩을 고르세요" : `팩 ${chosen.length}개 추가 · 아이템 ${itemCount}개`}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-field bg-fill px-3">
          <IconSearch size={18} stroke={1.9} className="shrink-0 text-sub" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="팩 검색"
            placeholder="팩 이름이나 아이템으로 검색"
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
          />
        </label>

        {!query && path.length > 0 && (
          <nav aria-label="경로" className="flex flex-wrap items-center gap-1 text-caption text-sub">
            {crumbs.map((c, i) => (
              <span key={c.id ?? "root"} className="flex items-center gap-1">
                {i > 0 && <IconChevronRight size={12} stroke={2} className="text-faint" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => setPath(path.slice(0, i))}
                  className={cx("min-h-8 bg-transparent", i === crumbs.length - 1 ? "font-semibold text-ink" : "text-sub")}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </nav>
        )}

        <div className="flex flex-col">
          {rows.map((p) => {
            if (p.type === "folder") {
              return (
                <ListRow
                  key={p.id}
                  title={<span className="font-semibold">{p.name}</span>}
                  subtitle={`팩 ${countIn(p.id)}개`}
                  leading={<IconFolder size={22} stroke={1.6} className="shrink-0 text-brand" aria-hidden="true" />}
                  chevron
                  onClick={() => setPath([...path, p.id])}
                />
              );
            }
            const already = inBag.has(p.id);
            const on = selected.has(p.id);
            const preview =
              p.kind === "editor"
                ? (p.editorPreviewText ?? "").slice(0, 40) || "메모"
                : p.items
                    .slice(0, 4)
                    .map((i) => i.text)
                    .join(", ") + (p.items.length > 4 ? ` 외 ${p.items.length - 4}개` : "");
            return (
              <ListRow
                key={p.id}
                aria-pressed={on}
                disabled={already}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    {already && <Badge>가방에 있음</Badge>}
                  </span>
                }
                subtitle={preview || "비어 있는 팩"}
                leading={
                  p.kind === "editor" ? (
                    <span className="flex size-5.5 shrink-0 items-center justify-center">
                      {on ? <CheckMark checked shape="square" /> : <IconNotes size={20} stroke={1.6} className="text-sub" aria-hidden="true" />}
                    </span>
                  ) : (
                    <CheckMark checked={on} shape="square" />
                  )
                }
                trailing={p.kind === "editor" ? "메모" : `${p.items.length}개`}
                onClick={() => toggle(p.id)}
              />
            );
          })}
          {rows.length === 0 && <p className="m-0 py-6 text-center text-caption text-faint">{query ? "찾는 팩이 없어요" : "이 폴더는 비어 있어요"}</p>}
          <button
            type="button"
            onClick={() => {
              onCreateEmpty();
              close();
            }}
            className="flex min-h-14 items-center gap-3 bg-transparent text-body font-semibold text-brand"
          >
            <IconPlus size={20} stroke={1.9} aria-hidden="true" />빈 팩으로 직접 입력
          </button>
        </div>
      </div>
    </Sheet>
  );
}