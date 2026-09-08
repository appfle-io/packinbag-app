import type { User } from "firebase/auth";
import { Bag, Pack, UserProfile } from "./types";
import { getLocalBags, getLocalLibraryPacks } from "./localBagsService";
import { createBagRemote } from "./bagsService";
import { saveLibraryPackRemote } from "./packsService";

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
export function markOfflineIdsAsImported(ids: string[]) {
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
  let importedPacksCount = 0;
  for (const pack of targetPacks) {
    const newId = idMap.get(pack.id) || `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newParentId = pack.parentId ? idMap.get(pack.parentId) : undefined;

    const newPack: Pack = {
      ...pack,
      id: newId,
      parentId: newParentId,
      locked: false,
      updatedAt: new Date().toISOString(),
    };

    // isNew = true 로 호출하여 서버 API를 통해 안전하게 생성
    await saveLibraryPackRemote(user, newPack, true);
    importedPacksCount++;
  }

  // 3. 가방 생성 (가방 안 팩의 linkedLibraryPackId 및 소유자 정제)
  let importedBagsCount = 0;
  const ownerProfile = {
    nickname: profile.nickname || user.displayName || "나",
    avatarId: profile.avatarId || "avatar_1",
  };

  for (const bag of targetBags) {
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

    await createBagRemote(user, newBag, ownerProfile);
    importedBagsCount++;
  }

  // 4. 가져온 항목 ID 기록 (오프라인 로컬 스토리지는 삭제하지 않고 안전하게 보존!)
  const successfullyImportedIds = [
    ...targetBags.map((b) => b.id),
    ...targetPacks.map((p) => p.id),
  ];
  markOfflineIdsAsImported(successfullyImportedIds);

  return {
    importedBagsCount,
    importedPacksCount,
  };
}
