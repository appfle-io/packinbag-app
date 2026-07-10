// 신규 가입자 온보딩용 샘플 데이터.
// 계정을 막 만든 사람이 빈 화면을 보지 않도록, "프로필을 처음 완성하는 시점"에
// 딱 한 번(AuthProvider의 signUpWithEmail/completeProfile에서 first-time 판정)
// 이 데이터를 채워준다. 기존 가입자에게는 소급 적용하지 않는다 - 이미 자기
// 데이터가 있고, 필요하면 "샘플로 시작하기"로 언제든 받을 수 있다.
//
// 가방은 2개만 만든다(여행/업무) - FREE_MAX_ACTIVE_BAGS(3)를 가입 즉시 다 채워버리면
// 가입하자마자 자기 가방을 못 만드는 상황이 생겨서, 여유 1개를 남겨둔다.
// 라이브러리 팩은 2개(FREE_MAX_LIBRARY_PACKS=3, 여유 1개) 만들고 그 중 하나를
// 여행 가방 안에 실제로 "가져온" 상태로 넣어서 라이브러리 연동/북마크 흐름을 보여준다.

import type { User } from "firebase/auth";
import { Bag, Item, Pack } from "@/lib/types";
import { createBagRemote } from "@/lib/bagsService";
import { saveLibraryPackRemote } from "@/lib/packsService";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function checkItem(text: string): Item {
  return { id: uid(), type: "check", text, checked: false };
}

function textItem(text: string, opts: { bold?: boolean; color?: string } = {}): Item {
  return { id: uid(), type: "text", text, ...opts };
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function seedSampleDataForNewUser(
  user: User,
  ownerProfile: { nickname: string; avatarId: string }
) {
  const now = new Date().toISOString();

  // 1) 팩 라이브러리 샘플 2개 - 여행 가방 안에서 "가져와 연동"된 형태로 함께 보여준다.
  const libraryTravelPack: Pack = {
    id: uid(),
    name: "여행 필수 준비물",
    color: "blue",
    createdAt: now,
    updatedAt: now,
    items: [
      checkItem("여권/신분증"),
      checkItem("지갑 (카드·현금)"),
      checkItem("휴대폰 충전기"),
      checkItem("보조배터리"),
      checkItem("세면도구 파우치"),
      checkItem("상비약"),
    ],
  };

  const libraryStayPack: Pack = {
    id: uid(),
    name: "숙소 체크인 전 확인",
    color: "orange",
    createdAt: now,
    updatedAt: now,
    items: [
      checkItem("예약 확인서 캡처/출력"),
      checkItem("체크인 가능 시간 확인"),
      checkItem("주차 가능 여부 확인"),
      checkItem("조식 포함 여부 확인"),
    ],
  };

  await saveLibraryPackRemote(user, libraryTravelPack);
  await saveLibraryPackRemote(user, libraryStayPack);

  // 2) 여행 가방 - 위 라이브러리 팩 2개를 실제로 "가져온" 상태로 넣어서 연동을 보여준다.
  //    첫 팩의 첫 두 짐은 스와이프 제스처 안내용 샘플.
  const travelBag: Bag = {
    id: uid(),
    name: "제주도 3박4일 여행",
    images: [],
    notice: "공항 리무진버스 예약 완료 🚌 출발 3시간 전 도착하기!",
    travelDate: isoDaysFromNow(14),
    reminderOffsets: [3, 1, 0],
    packs: [
      {
        id: uid(),
        name: "여권/서류",
        items: [
          checkItem("오른쪽으로 밀어보면 → 수정할 수 있어요"),
          checkItem("왼쪽으로 밀면 ← 삭제할 수 있어요"),
          checkItem("여권"),
          checkItem("여행자보험"),
          checkItem("항공권 e-티켓"),
        ],
      },
      {
        id: uid(),
        name: libraryTravelPack.name,
        color: libraryTravelPack.color,
        items: libraryTravelPack.items.map((it) => ({ ...it, id: uid() })),
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryTravelPack.id,
        linkedLibraryUpdatedAt: libraryTravelPack.updatedAt,
      },
      {
        id: uid(),
        name: libraryStayPack.name,
        color: libraryStayPack.color,
        items: libraryStayPack.items.map((it) => ({ ...it, id: uid() })),
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryStayPack.id,
        linkedLibraryUpdatedAt: libraryStayPack.updatedAt,
      },
      {
        id: uid(),
        name: "제주도 일정",
        items: [
          textItem("Day 1", { bold: true, color: "#3b82f6" }),
          checkItem("공항 도착 · 렌트카 픽업"),
          checkItem("숙소 체크인"),
          textItem("Day 2", { bold: true, color: "#3b82f6" }),
          checkItem("협재해수욕장"),
          checkItem("카페 투어"),
        ],
      },
    ],
    memberIds: [user.uid],
    ownerId: user.uid,
    inviteCode: "",
    createdAt: now,
    updatedAt: now,
  };

  // 3) 업무 가방 - 칸반형(텍스트 카드)으로, 팩인백이 여행뿐 아니라 업무 보드로도
  //    쓸 수 있다는 걸 보여준다.
  const workBag: Bag = {
    id: uid(),
    name: "팀 프로젝트 킥오프",
    images: [],
    notice: "매주 월요일 오전 10시 스탠드업 미팅이에요! ⏰",
    packs: [
      {
        id: uid(),
        name: "할일",
        items: [
          textItem("기획안 초안 작성"),
          textItem("요구사항 정리"),
          textItem("디자인 시안 요청"),
        ],
      },
      {
        id: uid(),
        name: "진행중",
        items: [textItem("API 연동 작업")],
      },
      {
        id: uid(),
        name: "완료",
        items: [textItem("킥오프 미팅")],
      },
    ],
    memberIds: [user.uid],
    ownerId: user.uid,
    inviteCode: "",
    createdAt: now,
    updatedAt: now,
  };

  // createBagRemote가 서버에서 ownerId/memberIds/memberProfiles/inviteCode/updatedAt을
  // 다시 채워주므로, 위에서 넣은 값들은 타입만 맞추기 위한 placeholder다.
  await createBagRemote(user, travelBag, ownerProfile);
  await createBagRemote(user, workBag, ownerProfile);
}
