// 체험 모드 시작 데이터(offline.md OFF-DEMO-04, 2026-10-18).
// 새 가입자 샘플(lib/sampleOnboardingData buildSampleData)과 같은 가방 2개 · 보관함 5개를 이 탭에만 넣는다.
// 탭(sessionStorage)마다 한 번. lib/localBagsService가 체험 모드면 sessionStorage + "pib_demo_" 키로 저장한다

import { buildSampleData } from "@/lib/sampleOnboardingData";
import {
  OFFLINE_USER_UID,
  saveLocalBag,
  saveLocalLibraryPack,
  saveLocalProfile,
} from "@/lib/localBagsService";

const DEMO_SEEDED_KEY = "pib_demo_seeded";

const DEMO_NICKNAME = "체험 중";

export function seedDemoDataOnce() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(DEMO_SEEDED_KEY) === "1") return;
  } catch {
    return;
  }
  const now = new Date().toISOString();
  const { libraryPacks, bags } = buildSampleData(OFFLINE_USER_UID);
  // save*는 목록 맨 앞에 넣으므로 거꾸로 저장해서 원래 순서를 지킨다
  [...libraryPacks].reverse().forEach((p) => saveLocalLibraryPack(p));
  [...bags].reverse().forEach((b) =>
    saveLocalBag({
      ...b,
      inviteCode: "DEMO",
      memberProfiles: {
        [OFFLINE_USER_UID]: { nickname: DEMO_NICKNAME, avatarId: "avatar_1", joinedAt: now },
      },
    })
  );
  saveLocalProfile({ nickname: DEMO_NICKNAME, displayName: DEMO_NICKNAME, avatarId: "avatar_1" });
  try {
    sessionStorage.setItem(DEMO_SEEDED_KEY, "1");
  } catch {}
}
