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
  const filtered = list.filter((b) => b.id !== bagId);
  safeSetItem(LOCAL_BAGS_KEY, filtered);

  // 휴지통으로 이동
  const trashed = safeGetItem<Bag[]>(LOCAL_TRASHED_BAGS_KEY, []);
  trashed.unshift({ ...target, updatedAt: new Date().toISOString() });
  safeSetItem(LOCAL_TRASHED_BAGS_KEY, trashed);
}

export function restoreLocalBag(bagId: string) {
  const trashed = safeGetItem<Bag[]>(LOCAL_TRASHED_BAGS_KEY, []);
  const target = trashed.find((b) => b.id === bagId);
  if (!target) return;
  safeSetItem(
    LOCAL_TRASHED_BAGS_KEY,
    trashed.filter((b) => b.id !== bagId)
  );
  saveLocalBag(target);
}

export function permanentDeleteLocalBag(bagId: string) {
  const trashed = safeGetItem<Bag[]>(LOCAL_TRASHED_BAGS_KEY, []);
  safeSetItem(
    LOCAL_TRASHED_BAGS_KEY,
    trashed.filter((b) => b.id !== bagId)
  );
}

// ----------------- Library Packs -----------------
export function getLocalLibraryPacks(): Pack[] {
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

export function deleteLocalLibraryPack(packId: string) {
  const list = getLocalLibraryPacks();
  const target = list.find((p) => p.id === packId);
  if (!target) return;
  safeSetItem(
    LOCAL_LIBRARY_PACKS_KEY,
    list.filter((p) => p.id !== packId)
  );

  // 휴지통으로 이동
  const trashed = safeGetItem<Pack[]>(LOCAL_TRASHED_PACKS_KEY, []);
  trashed.unshift({ ...target, trashedAt: new Date().toISOString() });
  safeSetItem(LOCAL_TRASHED_PACKS_KEY, trashed);
}

export function restoreLocalLibraryPack(packId: string) {
  const trashed = safeGetItem<Pack[]>(LOCAL_TRASHED_PACKS_KEY, []);
  const target = trashed.find((p) => p.id === packId);
  if (!target) return;
  safeSetItem(
    LOCAL_TRASHED_PACKS_KEY,
    trashed.filter((p) => p.id !== packId)
  );
  const { trashedAt: _, ...rest } = target;
  saveLocalLibraryPack(rest as Pack);
}

export function permanentDeleteLocalLibraryPack(packId: string) {
  const trashed = safeGetItem<Pack[]>(LOCAL_TRASHED_PACKS_KEY, []);
  safeSetItem(
    LOCAL_TRASHED_PACKS_KEY,
    trashed.filter((p) => p.id !== packId)
  );
}

export function getLocalTrashedItems(): { bags: Bag[]; packs: Pack[] } {
  return {
    bags: safeGetItem<Bag[]>(LOCAL_TRASHED_BAGS_KEY, []),
    packs: safeGetItem<Pack[]>(LOCAL_TRASHED_PACKS_KEY, []),
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
