import { Bag, Item, AvatarId } from "@/lib/types";

export const GUIDE_SAMPLE_MEMBERS: Array<{ uid: string; nickname?: string; avatarId?: AvatarId }> = [
  { uid: "sample-user", nickname: "나", avatarId: "dog" },
  { uid: "friend-1", nickname: "민수", avatarId: "cat" },
];

export const GUIDE_SAMPLE_BAG: Bag = {
  id: "sample-guide-bag",
  name: "도쿄 3박4일 자유여행",
  images: [],
  ownerId: "sample-user",
  memberIds: ["sample-user", "friend-1"],
  memberProfiles: {
    "sample-user": { nickname: "나", avatarId: "dog", joinedAt: new Date().toISOString() },
    "friend-1": { nickname: "민수", avatarId: "cat", joinedAt: new Date().toISOString() },
  },
  inviteCode: "TOKYO2026",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  travelDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
  packs: [
    {
      id: "pack-1",
      name: "전자기기 & 충전",
      type: "pack",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        { id: "i-1", type: "check", text: "여권 원본 (유효기간 6개월 이상)", checked: false },
        { id: "i-2", type: "check", text: "110V 돼지코 어댑터", checked: true },
        { id: "i-3", type: "check", text: "보조배터리 20000mAh", checked: false },
      ],
    },
    {
      id: "pack-2",
      name: "세면 & 위생용품",
      type: "pack",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        { id: "i-4", type: "check", text: "칫솔 & 치약 세트", checked: false },
        { id: "i-5", type: "check", text: "선크림 SPF50+", checked: true },
      ],
    },
    {
      id: "pack-3",
      name: "여행 일정 & 맛집 메모",
      type: "pack",
      kind: "editor",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      editorPreviewText: "Day 1: 나리타 공항 도착 (14:15)\n- N'EX 타고 신주쿠역 이동\n- 저녁: 신주쿠 츠케멘\n- 도쿄도청 전망대",
    },
  ],
};

export const GUIDE_SAMPLE_ITEM: Item = {
  id: "guide-sample-item-1",
  type: "check",
  text: "여권 원본 (유효기간 6개월 이상)",
  checked: false,
  dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
};
