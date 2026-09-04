import { Bag, Pack } from "./types";
import { saveLocalBag, saveLocalLibraryPack } from "./localBagsService";
import { createBagRemote } from "./bagsService";
import { saveLibraryPackRemote } from "./packsService";
import type { User } from "firebase/auth";

export interface BackupFileContent {
  version: "1.0";
  appName: "PackInBag";
  exportedAt: string;
  bags: Bag[];
  libraryPacks: Pack[];
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
  const text = await file.text();
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
    bags: (obj.bags as Bag[]) || [],
    libraryPacks: Array.isArray(obj.libraryPacks) ? (obj.libraryPacks as Pack[]) : [],
  };
}

/**
 * 백업 파일의 데이터를 현재 환경(로컬 모드 또는 온라인 클라우드 계정)으로 복원합니다.
 */
function isRemoteUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export async function restoreBackupData(
  data: BackupFileContent,
  mode: "local" | "cloud",
  user?: User | null,
  ownerProfile?: { nickname: string; avatarId: string } | null
): Promise<{
  restoredBagsCount: number;
  restoredPacksCount: number;
  hasExcludedRemoteMedia: boolean;
}> {
  let bagsCount = 0;
  let packsCount = 0;
  let hasExcludedRemoteMedia = false;

  if (mode === "local") {
    // 1. 로컬 모드로 복원 (오프라인 전용 ID 및 소유자 할당, 온라인 원격 이미지는 제외)
    // 에디터 본문 등에 온라인 Firebase Storage URL이 포함되어 있는지 확인
    const jsonStr = JSON.stringify(data);
    if (
      jsonStr.includes("https://firebasestorage.googleapis.com") ||
      jsonStr.includes("http://") ||
      jsonStr.includes("https://")
    ) {
      hasExcludedRemoteMedia = true;
    }

    for (const bag of data.bags) {
      const originalBagImages = bag.images ?? [];
      const localBagImages = originalBagImages.filter((img) => !isRemoteUrl(img));
      if (localBagImages.length < originalBagImages.length) {
        hasExcludedRemoteMedia = true;
      }

      const sanitizedPacks = (bag.packs ?? []).map((p) => {
        const packImages = p.images ?? [];
        const localPackImages = packImages.filter((img) => !isRemoteUrl(img));
        if (localPackImages.length < packImages.length) {
          hasExcludedRemoteMedia = true;
        }
        return { ...p, images: localPackImages };
      });

      const newBag: Bag = {
        ...bag,
        id: `local_bag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ownerId: "local-offline-user",
        memberIds: ["local-offline-user"],
        memberProfiles: {
          "local-offline-user": {
            nickname: "오프라인 사용자",
            avatarId: "avatar-1",
            joinedAt: new Date().toISOString(),
          },
        },
        images: localBagImages,
        packs: sanitizedPacks,
        inviteCode: "OFFLINE",
        updatedAt: new Date().toISOString(),
      };
      saveLocalBag(newBag);
      bagsCount++;
    }

    for (const pack of data.libraryPacks) {
      const packImages = pack.images ?? [];
      const localPackImages = packImages.filter((img) => !isRemoteUrl(img));
      if (localPackImages.length < packImages.length) {
        hasExcludedRemoteMedia = true;
      }

      const newPack: Pack = {
        ...pack,
        id: `local_pack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        images: localPackImages,
        updatedAt: new Date().toISOString(),
      };
      saveLocalLibraryPack(newPack);
      packsCount++;
    }
  } else {
    // 2. 온라인 계정으로 복원 (서버 API를 통해 새 소유자로 안전하게 생성)
    if (!user) throw new Error("로그인 상태가 아니에요.");

    const profile = ownerProfile ?? {
      nickname: user.displayName || "나",
      avatarId: "avatar-1",
    };

    for (const bag of data.bags) {
      const newBagId = `bag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      // 타인의 백업 파일이더라도 현재 로그인한 유저의 소유로 완전히 정제
      const newBag: Bag = {
        ...bag,
        id: newBagId,
        ownerId: user.uid,
        memberIds: [user.uid],
        memberProfiles: {
          [user.uid]: {
            nickname: profile.nickname,
            avatarId: profile.avatarId,
            joinedAt: new Date().toISOString(),
          },
        },
        inviteCode: "", // createBagRemote 내부에서 서버가 안전하게 새 코드를 생성
        updatedAt: new Date().toISOString(),
      };
      await createBagRemote(user, newBag, profile);
      bagsCount++;
    }

    for (const pack of data.libraryPacks) {
      const newPackId = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newPack: Pack = {
        ...pack,
        id: newPackId,
        updatedAt: new Date().toISOString(),
      };
      // isNew = true 로 호출하여 Admin SDK 서버 API(/api/create-library-pack)를 통해 생성
      await saveLibraryPackRemote(user, newPack, true);
      packsCount++;
    }
  }

  return {
    restoredBagsCount: bagsCount,
    restoredPacksCount: packsCount,
    hasExcludedRemoteMedia,
  };
}
