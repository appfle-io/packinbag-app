import { BagMemberProfile } from "@/lib/types";

// 텍스트 안에서 "@닉네임" 형태로 실제 언급된 멤버들의 uid를 찾아낸다. 별도로 멘션 상태를
// 추적하지 않고 "보낼 때 텍스트에서 다시 스캔"하는 방식이라 구현이 단순해진다 -
// 자동완성으로 넣었든 손으로 직접 쳤든 "@닉네임"이 최종 텍스트에 남아있으면 멘션으로 친다.
// (일반 문장에 우연히 "@닉네임"이 들어가면 오탐될 수 있지만, 소그룹 신뢰 기반 앱이라
// 감수할만한 트레이드오프로 판단)
export function extractMentionedUids(
  text: string,
  members: { uid: string; nickname: string }[]
): string[] {
  const uids: string[] = [];
  for (const m of members) {
    if (!m.nickname) continue;
    const escaped = m.nickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\s)@${escaped}(?=\\s|$)`, "u");
    if (re.test(text)) uids.push(m.uid);
  }
  return uids;
}

// Bag.memberIds + Bag.memberProfiles로부터 멘션 자동완성/스캔에 쓸 멤버 목록을 만든다.
export function buildMentionMembers(
  memberIds: string[],
  memberProfiles: Record<string, BagMemberProfile> | undefined,
  excludeUid?: string
): { uid: string; nickname: string; avatarId: string }[] {
  return memberIds
    .filter((uid) => uid !== excludeUid)
    .map((uid) => ({
      uid,
      nickname: memberProfiles?.[uid]?.nickname ?? "멤버",
      avatarId: memberProfiles?.[uid]?.avatarId ?? "cat",
    }));
}
