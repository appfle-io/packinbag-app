"use client";

import Link from "next/link";
import { IconFolder, IconPlus } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import MemoDocViewer from "@/components/MemoDocViewer";
import { Badge, CheckMark, cx } from "@/components/v2/ui";
import { GuestShell } from "./GuestShell";
import { GuestMemoBlock } from "./GuestMemoBlock";

// 팩 · 폴더 · 메모 공유 보기(/p/{토큰}) v2(2026-10-15, share.md 확인 필요 9).
// - 메모 하나면 글 읽기 화면, 그 밖은 팩 카드 목록. 폴더 공유는 하위 폴더 이름으로 묶어 보여 준다(확인 필요 5)
// - 아래 "내 팩 보관함으로 가져오기" → /?importPack={토큰}
function ImportFooter({ token, name }: { token: string; name: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-semibold">{name}</span>
        <span className="truncate text-caption text-sub">내 팩 보관함에 담아 두고 가방에 불러올 수 있어요</span>
      </div>
      <Link
        href={`/?importPack=${token}`}
        className="inline-flex h-12 shrink-0 items-center gap-2 rounded-card bg-ink px-5 text-body font-semibold text-on-ink no-underline"
      >
        <IconPlus size={18} stroke={2.2} />
        가져오기
      </Link>
    </div>
  );
}

function PackCard({ pack }: { pack: Pack }) {
  const isMemo = pack.kind === "editor";
  const items = pack.items ?? [];
  return (
    <section className="flex flex-col gap-2 rounded-card border border-line bg-card px-4 pt-3 pb-4">
      <div className="flex min-h-8 items-center gap-2">
        <h2 className="m-0 min-w-0 flex-1 truncate text-body-lg font-semibold">{pack.name}</h2>
        <Badge>{isMemo ? "메모" : `${items.length}개`}</Badge>
      </div>
      {isMemo ? (
        <GuestMemoBlock pack={pack} />
      ) : items.length === 0 ? (
        <p className="m-0 py-2 text-caption text-faint">아이템이 없어요</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((i) => (
            <li key={i.id} className="flex min-h-10 items-center gap-3">
              {i.type === "text" ? <span className="size-5.5 shrink-0" aria-hidden="true" /> : <CheckMark checked={!!i.checked} />}
              <span className={cx("min-w-0 flex-1 text-body", i.type === "text" ? "text-sub" : "text-ink", i.bold && "font-semibold")}>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GuestPackViewV2({
  token,
  title,
  isFolder,
  entries,
}: {
  token: string;
  title: string;
  isFolder: boolean;
  // 폴더 공유면 하위 폴더 · 팩 · 메모 전부(parentId로 구조), 팩 공유면 팩 하나
  entries: Pack[];
}) {
  const packs = entries.filter((p) => p.type !== "folder");
  const folders = new Map(entries.filter((p) => p.type === "folder").map((f) => [f.id, f]));

  // 메모 하나 공유: 글 읽기 화면
  if (!isFolder && packs.length === 1 && packs[0].kind === "editor") {
    const memo = packs[0];
    return (
      <GuestShell badge={<Badge tone="brand">메모</Badge>} footer={<ImportFooter token={token} name={memo.name || "메모"} />}>
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pt-6 pb-10">
          <h1 className="m-0 text-title font-bold break-words">{memo.name || "제목 없는 메모"}</h1>
          <div className="rounded-card border border-line bg-card p-5">
            <MemoDocViewer pack={memo} />
          </div>
        </article>
      </GuestShell>
    );
  }

  // 하위 폴더 경로("캠핑 / 조리")로 묶는다. 바로 아래 팩은 이름 없이 맨 위
  const pathOf = (parentId?: string): string => {
    const names: string[] = [];
    let cur = parentId ? folders.get(parentId) : undefined;
    let guard = 0;
    while (cur && guard++ < 20) {
      names.unshift(cur.name);
      cur = cur.parentId ? folders.get(cur.parentId) : undefined;
    }
    return names.join(" / ");
  };
  const groups = new Map<string, Pack[]>();
  packs.forEach((p) => {
    const key = pathOf(p.parentId);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  });
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "ko")));
  const totalItems = packs.reduce((n, p) => n + (p.items?.length ?? 0), 0);

  return (
    <GuestShell
      badge={<Badge tone="brand">{isFolder ? "폴더" : "팩"}</Badge>}
      footer={<ImportFooter token={token} name={title} />}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 pt-6 pb-10">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-title font-bold break-words">{title}</h1>
          <p className="m-0 text-caption text-sub">
            {isFolder ? `팩 · 메모 ${packs.length}개 · ` : ""}아이템 {totalItems}개
          </p>
        </div>
        {packs.length === 0 && <p className="m-0 py-16 text-center text-caption text-faint">담긴 팩이 없어요</p>}
        {ordered.map(([path, list]) => (
          <section key={path || "_root"} className="flex flex-col gap-3">
            {path && (
              <h2 className="m-0 flex items-center gap-2 text-caption font-semibold text-sub">
                <IconFolder size={16} stroke={1.75} />
                {path}
              </h2>
            )}
            {list.map((p) => (
              <PackCard key={p.id} pack={p} />
            ))}
          </section>
        ))}
      </div>
    </GuestShell>
  );
}
