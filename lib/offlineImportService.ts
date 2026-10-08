import type { User } from "firebase/auth";
import { Bag, Pack, UserProfile } from "./types";
import { getLocalBags, getLocalLibraryPacks } from "./localBagsService";
import { createBagRemote } from "./bagsService";
import { saveLibraryPackRemote } from "./packsService";
import { PremiumLimitError } from "./premiumLimits";

const IMPORTED_OFFLINE_IDS_KEY = "pib_imported_offline_ids";

/**
 * 이미 온라인으로 가져온 오프라인 항목 ID 목록을 조회합니다.
 */
export function getImportedOfflineIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(IMPORTED_OFFLINE_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {}
  return new Set();
}

/**
 * 가져온 오프라인 항목 ID들을 기록합니다.
 */
function markOfflineIdsAsImported(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const current = getImportedOfflineIds();
    for (const id of ids) {
      current.add(id);
    }
    localStorage.setItem(IMPORTED_OFFLINE_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export interface OfflineDataSummary {
  bags: Bag[];
  packs: Pack[];
  unimportedBagsCount: number;
  unimportedPacksCount: number;
  totalUnimportedCount: number;
}

/**
 * 로컬 스토리지에 존재하는 오프라인 데이터 현황 및 아직 가져오지 않은 개수를 집계합니다.
 */
export function getOfflineDataSummary(): OfflineDataSummary {
  const allBags = getLocalBags().filter((b) => !b.trashedByOwnerAt);
  const allPacks = getLocalLibraryPacks().filter((p) => !p.trashedAt);
  const importedIds = getImportedOfflineIds();

  const unimportedBags = allBags.filter((b) => !importedIds.has(b.id));
  const unimportedPacks = allPacks.filter((p) => !importedIds.has(p.id));

  return {
    bags: allBags,
    packs: allPacks,
    unimportedBagsCount: unimportedBags.length,
    unimportedPacksCount: unimportedPacks.length,
    totalUnimportedCount: unimportedBags.length + unimportedPacks.length,
  };
}

/**
 * 선택한 오프라인 가방 및 팩들을 온라인 Firestore 계정으로 안전하게 복사(가져오기)합니다.
 * - 오프라인 원본 데이터는 절대 삭제하지 않고 보존합니다.
 * - ID 매핑 테이블을 구축하여 폴더(parentId) 및 가방 내 팩의 linkedLibraryPackId 참조 무결성을 100% 보장합니다.
 * - 소유자(ownerId, memberIds, memberProfiles)를 현재 로그인한 계정으로 정제하여 저장합니다.
 */
export async function importOfflineDataToOnline({
  user,
  profile,
  selectedBagIds,
  selectedPackIds,
}: {
  user: User;
  profile: UserProfile;
  selectedBagIds?: string[];
  selectedPackIds?: string[];
}): Promise<{
  importedBagsCount: number;
  importedPacksCount: number;
  // 무료 개수를 넘어 멈춘 경우 서버가 돌려준 안내(남은 것은 이 기기에 그대로 남고, 다음에 다시 고를 수 있다)
  blockedMessage: string | null;
  skippedCount: number;
}> {
  if (!user) throw new Error("로그인 상태가 아니에요.");

  const allLocalBags = getLocalBags().filter((b) => !b.trashedByOwnerAt);
  const allLocalPacks = getLocalLibraryPacks().filter((p) => !p.trashedAt);

  const targetBags = selectedBagIds
    ? allLocalBags.filter((b) => selectedBagIds.includes(b.id))
    : allLocalBags;

  const targetPacks = selectedPackIds
    ? allLocalPacks.filter((p) => selectedPackIds.includes(p.id))
    : allLocalPacks;

  // 1. 충돌 방지용 ID 매핑 테이블 (oldOfflineId -> newOnlineId)
  const idMap = new Map<string, string>();

  for (const pack of targetPacks) {
    const newPackId = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    idMap.set(pack.id, newPackId);
  }

  // 2. 보관함 팩 먼저 생성 (폴더 등 부모 관계 정제)
  // 하나씩 올리고 올린 것은 바로 "가져옴"으로 적는다 - 중간에 멈춰도 다시 했을 때 같은 것이 두 번 올라가지 않게.
  // 무료 개수를 넘으면(PremiumLimitError) 그 자리에서 멈추고 나머지는 이 기기에 남긴다.
  let importedPacksCount = 0;
  let blockedMessage: string | null = null;
  let skippedCount = 0;
  for (let i = 0; i < targetPacks.length; i++) {
    const pack = targetPacks[i];
    const newId = idMap.get(pack.id) || `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newParentId = pack.parentId ? idMap.get(pack.parentId) : undefined;

    const newPack: Pack = {
      ...pack,
      id: newId,
      parentId: newParentId,
      locked: false,
      updatedAt: new Date().toISOString(),
    };

    try {
      // isNew = true 로 호출하여 서버 API를 통해 안전하게 생성
      await saveLibraryPackRemote(user, newPack, true);
    } catch (err) {
      if (err instanceof PremiumLimitError) {
        blockedMessage = err.message;
        skippedCount += targetPacks.length - i;
        break;
      }
      throw err;
    }
    markOfflineIdsAsImported([pack.id]);
    importedPacksCount++;
  }

  // 3. 가방 생성 (가방 안 팩의 linkedLibraryPackId 및 소유자 정제)
  let importedBagsCount = 0;
  const ownerProfile = {
    nickname: profile.nickname || user.displayName || "나",
    avatarId: profile.avatarId || "avatar_1",
  };

  for (let i = 0; i < targetBags.length; i++) {
    const bag = targetBags[i];
    const newBagId = `bag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 가방 내부 팩들의 linkedLibraryPackId를 신규 보관함 팩 ID로 치환
    const sanitizedBagPacks = (bag.packs || []).map((p) => {
      const remappedLinkedId = p.linkedLibraryPackId ? idMap.get(p.linkedLibraryPackId) : undefined;
      return {
        ...p,
        linkedLibraryPackId: remappedLinkedId || p.linkedLibraryPackId,
      };
    });

    const newBag: Bag = {
      ...bag,
      id: newBagId,
      ownerId: user.uid,
      memberIds: [user.uid],
      memberProfiles: {
        [user.uid]: {
          nickname: ownerProfile.nickname,
          avatarId: ownerProfile.avatarId,
          joinedAt: new Date().toISOString(),
        },
      },
      inviteCode: "", // createBagRemote에서 서버가 고유 초대 코드 자동 발급
      packs: sanitizedBagPacks,
      locked: false,
      updatedAt: new Date().toISOString(),
    };

    try {
      await createBagRemote(user, newBag, ownerProfile);
    } catch (err) {
      if (err instanceof PremiumLimitError) {
        blockedMessage = err.message;
        skippedCount += targetBags.length - i;
        break;
      }
      throw err;
    }
    markOfflineIdsAsImported([bag.id]);
    importedBagsCount++;
  }

  // 오프라인 로컬 스토리지는 삭제하지 않고 보존한다(가져온 항목은 위에서 하나씩 기록했다)
  return {
    importedBagsCount,
    importedPacksCount,
    blockedMessage,
    skippedCount,
  };
}
