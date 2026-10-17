import { Bag, Pack } from "./types";
import { saveLocalBag, saveLocalLibraryPack } from "./localBagsService";
import { createBagRemote } from "./bagsService";
import { saveLibraryPackRemote } from "./packsService";
import { hydrateBag } from "./bagNotesCore";
import { fetchBagNotesOnce } from "./bagNotesService";
import {
  buildRestoreProgress,
  libraryRestoreOrder,
  restoredBagPacks,
  restoredLibraryPack,
  restoreProgressKey,
  type BackupFileContent,
  type RestoreProgress,
} from "./backupPlan";
import type { User } from "firebase/auth";

export type { BackupFileContent } from "./backupPlan";

/**
 * 계정 모드 백업용: 목록 가방에는 메모 본문이 없다(10/8부터 bags/{id}/notes에 따로) → 메모가 있는 가방만 본문을 읽어 채운다.
 * 하나라도 못 읽으면 실패로 돌려준다(본문 없는 백업을 만들지 않게). 오프라인 모드 가방은 본문이 안에 있어 부르지 않는다
 */
export async function withBagNoteBodies(bags: Bag[]): Promise<Bag[]> {
  return Promise.all(
    bags.map(async (bag) => {
      const needs = (bag.packs ?? []).some((p) => p.kind === "editor" && p.editorDoc === undefined);
      if (!needs) return bag;
      return hydrateBag(bag, await fetchBagNotesOnce(bag.id));
    }),
  );
}

/**
 * 가방과 팩 보관함 데이터를 하나의 .json 파일로 다운로드합니다.
 */
export function exportBackupData(bags: Bag[], libraryPacks: Pack[]) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const fileName = `packinbag_backup_${dateStr}.json`;

  const backupContent: BackupFileContent = {
    version: "1.0",
    appName: "PackInBag",
    exportedAt: now.toISOString(),
    bags: bags.map((b) => ({
      ...b,
      // 백업 시 불필요한 원격 전용 내부 상태 정리
      locked: false,
    })),
    libraryPacks: libraryPacks.map((p) => ({
      ...p,
      locked: false,
    })),
  };

  const jsonStr = JSON.stringify(backupContent, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 사용자가 선택한 파일이 올바른 팩인백 백업 파일인지 검증하고 내용을 읽습니다.
 */
export async function parseBackupFile(file: File): Promise<BackupFileContent> {
  return parseBackupText(await file.text());
}

function parseBackupText(text: string): BackupFileContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 형식의 파일이 아니에요.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("백업 파일 형식이 올바르지 않아요.");
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.appName !== "PackInBag" || !Array.isArray(obj.bags)) {
    throw new Error("팩인백 백업 파일이 아니거나 손상된 파일이에요.");
  }

  return {
    version: "1.0",
    appName: "PackInBag",
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    bags: ((obj.bags as Bag[]) || []).filter((b) => b && typeof b === "object" && typeof b.id === "string"),
    libraryPacks: Array.isArray(obj.libraryPacks)
      ? (obj.libraryPacks as Pack[]).filter((p) => p && typeof p === "object" && typeof p.id === "string")
      : [],
  };
}

function isRemoteUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// ---- 이어서 하기 기록(이 기기) ----
function readProgress(key: string): RestoreProgress | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    if (v && typeof v === "object" && v.bags && v.packs && Array.isArray(v.done)) return v as RestoreProgress;
  } catch {}
  return null;
}
function writeProgress(key: string, p: RestoreProgress) {
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {}
}
function clearProgress(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

const rand = () => Math.random().toString(36).slice(2, 7);

/** 중간에 멈춘 복원. 같은 파일을 다시 고르면 끝낸 것은 건너뛰고 이어서 한다 */
export class RestorePartialError extends Error {
  constructor(
    message: string,
    readonly done: number,
    readonly total: number,
  ) {
    super(message);
  }
}

export interface RestoreResult {
  restoredBagsCount: number;
  restoredPacksCount: number;
  hasExcludedRemoteMedia: boolean;
  // 지난번에 멈춘 곳부터 이어서 했는지
  resumed: boolean;
}

/**
 * 백업 파일의 데이터를 현재 환경(로컬 모드 또는 온라인 클라우드 계정)으로 복원합니다.
 * 덮어쓰지 않고 새 id로 새로 만든다(lib/backupPlan). onProgress(끝낸 개수, 전체)
 */
export async function restoreBackupData(
  data: BackupFileContent,
  mode: "local" | "cloud",
  user?: User | null,
  ownerProfile?: { nickname: string; avatarId: string } | null,
  onProgress?: (done: number, total: number) => void,
): Promise<RestoreResult> {
  if (mode === "cloud" && !user) throw new Error("로그인 상태가 아니에요.");

  const key = restoreProgressKey(mode === "cloud" ? user!.uid : "local", data);
  const prev = readProgress(key);
  const progress = buildRestoreProgress(
    data,
    (kind) =>
      mode === "local"
        ? `local_${kind}_${Date.now()}_${rand()}`
        : `${kind}_${Date.now()}_${rand()}`,
    prev,
  );
  const done = new Set(progress.done);
  const resumed = done.size > 0;
  writeProgress(key, progress);

  const total = data.libraryPacks.length + data.bags.length;
  const markDone = (id: string) => {
    done.add(id);
    progress.done = [...done];
    writeProgress(key, progress);
    onProgress?.(done.size, total);
  };
  onProgress?.(done.size, total);

  let hasExcludedRemoteMedia = false;
  if (mode === "local") {
    // 에디터 본문 등에 온라인 주소가 들어 있으면 안내한다(오프라인 모드에서는 열리지 않는다)
    if (JSON.stringify(data).includes("http://") || JSON.stringify(data).includes("https://")) hasExcludedRemoteMedia = true;
  }

  const profile = ownerProfile ?? {
    nickname: user?.displayName || "나",
    avatarId: "avatar-1",
  };

  try {
    // 1. 보관함(폴더 먼저)
    for (const pack of libraryRestoreOrder(data.libraryPacks)) {
      const doneKey = `pack:${pack.id}`;
      if (done.has(doneKey)) continue;
      const now = new Date().toISOString();
      const next = restoredLibraryPack(pack, progress, now);
      if (mode === "local") {
        const images = (next.images ?? []).filter((img) => !isRemoteUrl(img));
        if (images.length < (next.images ?? []).length) hasExcludedRemoteMedia = true;
        saveLocalLibraryPack({ ...next, images });
      } else {
        // Admin SDK 서버 API(/api/create-library-pack)를 통해 생성
        await saveLibraryPackRemote(user!, next, true);
      }
      markDone(doneKey);
    }

    // 2. 가방
    for (const bag of data.bags) {
      const doneKey = `bag:${bag.id}`;
      if (done.has(doneKey)) continue;
      const now = new Date().toISOString();
      const packs = restoredBagPacks(bag, progress);
      const base: Bag = { ...bag, id: progress.bags[bag.id], packs, updatedAt: now };
      delete base.trashedByOwnerAt;
      delete base.publicShareToken;
      if (mode === "local") {
        // 오프라인 전용 소유자, 온라인 원격 이미지는 제외
        const images = (bag.images ?? []).filter((img) => !isRemoteUrl(img));
        if (images.length < (bag.images ?? []).length) hasExcludedRemoteMedia = true;
        const localPacks = packs.map((p) => {
          const packImages = (p.images ?? []).filter((img) => !isRemoteUrl(img));
          if (packImages.length < (p.images ?? []).length) hasExcludedRemoteMedia = true;
          return { ...p, images: packImages };
        });
        saveLocalBag({
          ...base,
          ownerId: "local-offline-user",
          memberIds: ["local-offline-user"],
          memberProfiles: {
            "local-offline-user": { nickname: "오프라인 사용자", avatarId: "avatar-1", joinedAt: now },
          },
          images,
          packs: localPacks,
          inviteCode: "OFFLINE",
        });
      } else {
        // 남의 백업 파일 · 함께 쓰던 가방이어도 지금 로그인한 사람만 멤버인 내 가방으로(초대코드는 서버가 새로)
        await createBagRemote(
          user!,
          {
            ...base,
            ownerId: user!.uid,
            memberIds: [user!.uid],
            memberProfiles: { [user!.uid]: { nickname: profile.nickname, avatarId: profile.avatarId, joinedAt: now } },
            inviteCode: "",
          },
          profile,
        );
      }
      markDone(doneKey);
    }
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "백업 파일을 불러오지 못했어요";
    throw new RestorePartialError(message, done.size, total);
  }

  clearProgress(key);
  return {
    restoredBagsCount: data.bags.length,
    restoredPacksCount: data.libraryPacks.length,
    hasExcludedRemoteMedia,
    resumed,
  };
}
