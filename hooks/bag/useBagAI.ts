"use client";

import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import type { Item, Pack } from "@/lib/types";
import { getApiUrl } from "@/lib/apiBase";
import { useToast } from "@/components/Toast";
import type { BagDocument } from "./useBagDocument";
import { newId } from "./ids";
import { MAX_PACKS_PER_BAG } from "./useBagItems";
import { findInbox } from "./bagStats";

export interface BagAIOptions {
  doc: BagDocument;
  user: User | null;
  premium: boolean;
  offline: boolean;
  onPremiumRequired: (message: string) => void;
}

interface OrganizeResponse {
  packs?: { name: string; itemIndices: number[] }[];
  error?: string;
}

// "팩으로 나눠 담기": 미분류 팩의 아이템만 AI(app/api/organize-bag)로 분류해서
// 이름이 같은 기존 팩에 이어 담고, 없으면 새 팩을 만든다(팩 10개 제한). 분류되지 않은 건 미분류에 남는다.
// 과금 기준은 현행 유지: 구 화면의 "AI 정리"와 같이 프리미엄 전용(서버는 무료 하루 한도도 따로 검사).
export function useBagAI({ doc, user, premium, offline, onPremiumRequired }: BagAIOptions) {
  const { bag, update, guard } = doc;
  const { show } = useToast();
  const [organizing, setOrganizing] = useState(false);

  const organizeInbox = useCallback(async () => {
    if (guard()) return;
    if (offline || !user) return;
    if (!premium) {
      onPremiumRequired("AI 정리는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요.");
      return;
    }
    const inbox = findInbox(bag);
    if (!inbox || inbox.items.length === 0) return;

    const existingNames = bag.packs.filter((p) => !p.isInbox && p.kind !== "editor").map((p) => p.name);
    setOrganizing(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(getApiUrl("/api/organize-bag"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          items: inbox.items.map((i, index) => ({ index, text: i.text })),
          existingPackNames: existingNames,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as OrganizeResponse;
      if (!res.ok) throw new Error(data.error ?? "정리에 실패했어요");
      const groups = data.packs ?? [];

      let moved = 0;
      let cappedOut = false;
      update((prev) => {
        // 개발 모드(StrictMode)에서는 updater가 두 번 불릴 수 있어 매번 새로 센다
        moved = 0;
        cappedOut = false;
        const inboxNow = prev.packs.find((p) => p.id === inbox.id);
        if (!inboxNow) return prev;
        // 요청 이후 미분류에 추가된 아이템은 그대로 남긴다(인덱스는 요청 당시 기준)
        const byIndex = new Map(inbox.items.map((it, i) => [i, it] as const));
        const usedIds = new Set<string>();
        let packs: Pack[] = [...prev.packs];
        for (const g of groups) {
          const items: Item[] = g.itemIndices
            .map((i) => byIndex.get(i))
            .filter((it): it is Item => !!it && inboxNow.items.some((x) => x.id === it.id));
          if (items.length === 0) continue;
          const idx = packs.findIndex((p) => !p.isInbox && p.kind !== "editor" && p.name.trim() === g.name.trim());
          if (idx >= 0) {
            packs = packs.map((p, i) => (i === idx ? { ...p, items: [...p.items, ...items] } : p));
          } else if (packs.length < MAX_PACKS_PER_BAG) {
            // 미분류 바로 아래에 새 팩을 만든다
            const at = packs.findIndex((p) => p.id === inbox.id) + 1;
            packs.splice(at, 0, { id: newId(), name: g.name.trim() || "기타", items });
          } else {
            cappedOut = true;
            continue;
          }
          items.forEach((it) => usedIds.add(it.id));
          moved += items.length;
        }
        packs = packs
          .map((p) => (p.id === inbox.id ? { ...p, items: p.items.filter((it) => !usedIds.has(it.id)) } : p))
          .filter((p) => !(p.id === inbox.id && p.items.length === 0));
        return { ...prev, packs };
      });
      if (moved === 0) show("정리할 만한 분류를 찾지 못했어요");
      else if (cappedOut) show(`팩이 가득 차서 일부는 미분류에 남겼어요 (${moved}개 정리)`);
      else show(`${moved}개를 팩으로 나눠 담았어요`);
    } catch (err) {
      show(err instanceof Error ? err.message : "정리에 실패했어요");
    } finally {
      setOrganizing(false);
    }
  }, [guard, offline, user, premium, onPremiumRequired, bag, update, show]);

  return { organizing, organizeInbox, aiAvailable: !offline && !!user };
}