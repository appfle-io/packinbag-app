import { Bag, Pack, UserProfile } from "./types";

const LOCAL_BAGS_KEY = "pib_offline_bags";
const LOCAL_LIBRARY_PACKS_KEY = "pib_offline_library_packs";
const LOCAL_TRASHED_BAGS_KEY = "pib_offline_trashed_bags";
const LOCAL_TRASHED_PACKS_KEY = "pib_offline_trashed_packs";
const LOCAL_PROFILE_KEY = "pib_offline_profile";

const LOCAL_CHANGE_EVENT = "pib_local_storage_change";

export const OFFLINE_USER_UID = "local-offline-user";

export const DEFAULT_OFFLINE_PROFILE: UserProfile = {
  uid: OFFLINE_USER_UID,
  email: "offline@local",
  displayName: "오프라인 사용자",
  nickname: "오프라인 사용자",
  avatarId: "avatar_1",
  themeMode: "system",
  defaultTab: "home",
  role: "master",
  premiumPurchase: {
    purchased: true,
    purchasedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
};

function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: { key } }));
  } catch (err) {
    console.error(`[LocalBagsService] 로컬 스토리지 저장 실패 (${key}):`, err);
  }
}

// ----------------- Profile -----------------
export function getLocalProfile(): UserProfile {
  return safeGetItem<UserProfile>(LOCAL_PROFILE_KEY, DEFAULT_OFFLINE_PROFILE);
}

export function saveLocalProfile(profile: Partial<UserProfile>) {
  const current = getLocalProfile();
  const updated: UserProfile = { ...current, ...profile };
  safeSetItem(LOCAL_PROFILE_KEY, updated);
}

// ----------------- Bags -----------------
export function getLocalBags(): Bag[] {
  // 이전 버전의 LOCAL_TRASHED_BAGS_KEY가 남아있다면 통합 마이그레이션
  if (typeof window !== "undefined") {
    try {
      const oldTrashed = localStorage.getItem(LOCAL_TRASHED_BAGS_KEY);
      if (oldTrashed) {
        const parsed = JSON.parse(oldTrashed) as Bag[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const current = safeGetItem<Bag[]>(LOCAL_BAGS_KEY, []);
          const existingIds = new Set(current.map((b) => b.id));
          const migrated = [
            ...current,
            ...parsed
              .filter((b) => !existingIds.has(b.id))
              .map((b) => ({
                ...b,
                trashedByOwnerAt: b.trashedByOwnerAt || new Date().toISOString(),
              })),
          ];
          localStorage.setItem(LOCAL_BAGS_KEY, JSON.stringify(migrated));
        }
        localStorage.removeItem(LOCAL_TRASHED_BAGS_KEY);
      }
    } catch {}
  }
  return safeGetItem<Bag[]>(LOCAL_BAGS_KEY, []);
}

export function saveLocalBag(bag: Bag) {
  const list = getLocalBags();
  const idx = list.findIndex((b) => b.id === bag.id);
  const updatedBag: Bag = { ...bag, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    list[idx] = updatedBag;
  } else {
    list.unshift(updatedBag);
  }
  safeSetItem(LOCAL_BAGS_KEY, list);
}

export function createLocalBag(name: string): Bag {
  const newBag: Bag = {
    id: `local_bag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "새 가방",
    images: [],
    packs: [],
    memberIds: [OFFLINE_USER_UID],
    memberProfiles: {
      [OFFLINE_USER_UID]: {
        nickname: "오프라인 사용자",
        avatarId: "avatar-1",
        joinedAt: new Date().toISOString(),
      },
    },
    ownerId: OFFLINE_USER_UID,
    inviteCode: "OFFLINE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalBag(newBag);
  return newBag;
}

export function deleteLocalBag(bagId: string) {
  const list = getLocalBags();
  const target = list.find((b) => b.id === bagId);
  if (!target) return;
  target.trashedByOwnerAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();
  safeSetItem(LOCAL_BAGS_KEY, list);
}

export function restoreLocalBag(bagId: string) {
  const list = getLocalBags();
  const target = list.find((b) => b.id === bagId);
  if (!target) return;
  delete target.trashedByOwnerAt;
  target.updatedAt = new Date().toISOString();
  safeSetItem(LOCAL_BAGS_KEY, list);
}

export function permanentDeleteLocalBag(bagId: string) {
  const list = getLocalBags();
  const filtered = list.filter((b) => b.id !== bagId);
  safeSetItem(LOCAL_BAGS_KEY, filtered);
}

// ----------------- Library Packs -----------------
export function getLocalLibraryPacks(): Pack[] {
  // 이전 버전의 LOCAL_TRASHED_PACKS_KEY가 남아있다면 통합 마이그레이션
  if (typeof window !== "undefined") {
    try {
      const oldTrashed = localStorage.getItem(LOCAL_TRASHED_PACKS_KEY);
      if (oldTrashed) {
        const parsed = JSON.parse(oldTrashed) as Pack[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const current = safeGetItem<Pack[]>(LOCAL_LIBRARY_PACKS_KEY, []);
          const existingIds = new Set(current.map((p) => p.id));
          const migrated = [
            ...current,
            ...parsed
              .filter((p) => !existingIds.has(p.id))
              .map((p) => ({
                ...p,
                trashedAt: p.trashedAt || new Date().toISOString(),
              })),
          ];
          localStorage.setItem(LOCAL_LIBRARY_PACKS_KEY, JSON.stringify(migrated));
        }
        localStorage.removeItem(LOCAL_TRASHED_PACKS_KEY);
      }
    } catch {}
  }
  return safeGetItem<Pack[]>(LOCAL_LIBRARY_PACKS_KEY, []);
}

export function saveLocalLibraryPack(pack: Pack) {
  const list = getLocalLibraryPacks();
  const idx = list.findIndex((p) => p.id === pack.id);
  const updatedPack: Pack = { ...pack, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    list[idx] = updatedPack;
  } else {
    list.unshift(updatedPack);
  }
  safeSetItem(LOCAL_LIBRARY_PACKS_KEY, list);
}

export function createLocalLibraryPack(name: string, kind: "checklist" | "editor" = "checklist"): Pack {
  const newPack: Pack = {
    id: `local_pack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "새 팩",
    items: [],
    kind,
    type: "pack",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalLibraryPack(newPack);
  return newPack;
}

function collectSubPackIds(packs: Pack[], parentId: string): Set<string> {
  const result = new Set<string>([parentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of packs) {
      if (p.parentId && result.has(p.parentId) && !result.has(p.id)) {
        result.add(p.id);
        changed = true;
      }
    }
  }
  return result;
}

export function deleteLocalLibraryPack(packId: string) {
  const list = getLocalLibraryPacks();
  const target = list.find((p) => p.id === packId);
  if (!target) return;
  const now = new Date().toISOString();
  const idsToTrash = target.type === "folder" ? collectSubPackIds(list, packId) : new Set([packId]);
  for (const p of list) {
    if (idsToTrash.has(p.id)) {
      p.trashedAt = now;
      p.updatedAt = now;
    }
  }
  safeSetItem(LOCAL_LIBRARY_PACKS_KEY, list);
}

export function restoreLocalLibraryPack(packId: string) {
  const list = getLocalLibraryPacks();
  const target = list.find((p) => p.id === packId);
  if (!target) return;
  const now = new Date().toISOString();
  const idsToRestore = target.type === "folder" ? collectSubPackIds(list, packId) : new Set([packId]);
  for (const p of list) {
    if (idsToRestore.has(p.id)) {
      delete p.trashedAt;
      p.updatedAt = now;
    }
  }
  safeSetItem(LOCAL_LIBRARY_PACKS_KEY, list);
}

export function permanentDeleteLocalLibraryPack(packId: string) {
  const list = getLocalLibraryPacks();
  const target = list.find((p) => p.id === packId);
  if (!target) return;
  const idsToDelete = target.type === "folder" ? collectSubPackIds(list, packId) : new Set([packId]);
  const filtered = list.filter((p) => !idsToDelete.has(p.id));
  safeSetItem(LOCAL_LIBRARY_PACKS_KEY, filtered);
}

export function getLocalTrashedItems(): { bags: Bag[]; packs: Pack[] } {
  return {
    bags: getLocalBags().filter((b) => Boolean(b.trashedByOwnerAt)),
    packs: getLocalLibraryPacks().filter((p) => Boolean(p.trashedAt)),
  };
}

// ----------------- Subscriptions -----------------
export function subscribeLocalData(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(LOCAL_CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(LOCAL_CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function resetLocalAllData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_BAGS_KEY);
  localStorage.removeItem(LOCAL_LIBRARY_PACKS_KEY);
  localStorage.removeItem(LOCAL_TRASHED_BAGS_KEY);
  localStorage.removeItem(LOCAL_TRASHED_PACKS_KEY);
  window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: { key: "all" } }));
}
