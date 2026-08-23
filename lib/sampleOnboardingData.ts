// 신규 가입자 온보딩용 샘플 데이터.
// 계정을 막 만든 사람이 빈 화면을 보지 않도록, "프로필을 처음 완성하는 시점"에
// 딱 한 번(AuthProvider의 signUpWithEmail/completeProfile에서 first-time 판정)
// 이 데이터를 채워준다.
//
// [무료 회원 제한 기준 준수]
// - 가방(Bag): FREE_MAX_ACTIVE_BAGS(3) 중 2개 생성 (1개 여유 슬롯)
//   - 가방 1: "도쿄 3박 4일 자유여행" (팩 4개: 체크리스트 3개 + 실시간 동기화 메모팩 1개)
//   - 가방 2: "주말 글램핑 & 캠핑 1박 2일" (팩 3개: 체크리스트 2개 + 가방 전용 메모팩 1개)
// - 팩 보관함(Library Packs): FREE_MAX_LIBRARY_PACKS(10) 중 5개 생성 (5개 여유 슬롯)
//   - 폴더 1개: "✈️ 여행 기본 세트" (folder)
//   - 내부 팩 2개: "전자기기 & 충전", "의류 & 위생용품" (폴더 안)
//   - 루트 팩 1개: "바베큐 & 먹거리"
//   - 루트 메모팩 1개: "여행 일정 & 맛집 메모" (가방 1과 실시간 동기화 연동)

import type { User } from "firebase/auth";
import { Bag, Item, Pack } from "@/lib/types";
import { createBagRemote } from "@/lib/bagsService";
import { saveLibraryPackRemote } from "@/lib/packsService";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function checkItem(text: string, checked = false): Item {
  return { id: uid(), type: "check", text, checked };
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

  // -------------------------------------------------------------------------
  // 1) 팩 보관함 (Library Packs) 생성: 총 5개 (한도 10개 중 5개 사용, 여유 5개)
  // -------------------------------------------------------------------------

  // 1-1. 폴더 생성: "✈️ 여행 기본 세트"
  const folderTravel: Pack = {
    id: uid(),
    name: "✈️ 여행 기본 세트",
    type: "folder",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveLibraryPackRemote(user, folderTravel, true);

  // 1-2. 폴더 내부 팩 1: "전자기기 & 충전"
  const libraryElecPack: Pack = {
    id: uid(),
    name: "전자기기 & 충전",
    parentId: folderTravel.id,
    type: "pack",
    createdAt: now,
    updatedAt: now,
    items: [
      checkItem("110V 돼지코 어댑터 (2개)", true),
      checkItem("스마트폰 고속 충전기 & 케이블"),
      checkItem("보조배터리 20000mAh (기내 수하물 필수)"),
      checkItem("eSIM / 포켓 와이파이 바우처", true),
      checkItem("노이즈 캔슬링 이어폰 / 헤드폰"),
      checkItem("애플워치 / 스마트워치 충전 독"),
    ],
  };
  await saveLibraryPackRemote(user, libraryElecPack, true);

  // 1-3. 폴더 내부 팩 2: "의류 & 위생용품"
  const libraryClothesPack: Pack = {
    id: uid(),
    name: "의류 & 위생용품",
    parentId: folderTravel.id,
    type: "pack",
    createdAt: now,
    updatedAt: now,
    items: [
      checkItem("상의 3벌 / 하의 2벌 / 편한 잠옷"),
      checkItem("속옷 4세트 & 양말 4켤레"),
      checkItem("휴대용 세면도구 세트 & 칫솔/치약", true),
      checkItem("상비약 (소화제, 타이레놀, 밴드, 인공눈물)"),
      checkItem("접이식 3단 우산 / 미니 크로스백"),
      checkItem("선크림 / 립밤 / 핸드크림"),
    ],
  };
  await saveLibraryPackRemote(user, libraryClothesPack, true);

  // 1-4. 루트 팩: "바베큐 & 먹거리"
  const libraryFoodPack: Pack = {
    id: uid(),
    name: "바베큐 & 먹거리",
    type: "pack",
    createdAt: now,
    updatedAt: now,
    items: [
      checkItem("삼겹살 / 목살 / 수제 소시지"),
      checkItem("모둠 쌈채소, 마늘, 청양고추, 쌈장, 김치"),
      checkItem("봉지라면, 햇반, 구이용 마시멜로우", true),
      checkItem("생수 2L, 탄산음료, 캔맥주, 각얼음"),
      checkItem("종이컵, 나무젓가락, 일회용 접시, 도톰한 물티슈", true),
      checkItem("허브솔트 / 참기름 / 호일"),
    ],
  };
  await saveLibraryPackRemote(user, libraryFoodPack, true);

  // 1-5. 루트 메모팩: "여행 일정 & 맛집 메모" (가방 1과 실시간 동기화 연동)
  const memoDocContent = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "✈️ 도쿄 3박 4일 일정 & 맛집 총정리" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "📌 필수 예약 & 교통 정보" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "숙소: 호텔 그레이서리 신주쿠 (체크인 15:00 / 예약번호: JP-883920)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "N'EX 나리타 익스프레스 왕복권: 1터미널 JR 동일본 여행 서비스 센터에서 발권" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "시부야 스카이 전망대: 2일차 14:00 입장 예약 완료 (모바일 QR 캡처 필수)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "교통카드: 아이폰 애플페이 스이카(Suica) 등록 완료 (마스터/현대카드 충전)" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "🗓️ 일자별 상세 코스" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Day 1 (신주쿠 중심)" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "11:30 나리타 공항 도착 → 입국심사(Visit Japan Web QR) → 12:45 N'EX 탑승" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "14:30 호텔 체크인 & 짐 정리 후 신주쿠 거리 산책" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "16:30 늦은 점심: 타츠노야 신주쿠점 (매운 곱창 츠케멘 강추!)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "19:00 도쿄도청 남쪽 전망대 (무료 입장, 21:30 마감) 야경 감상" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "21:00 오모이데요코초 꼬치 골목에서 생맥주(나마비루) 한 잔 🍢" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Day 2 (시부야 & 하라주쿠 & 롯폰기)" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "10:30 오모테산도 힐즈 & 캣스트리트 쇼핑 (키디랜드, 슈프림)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "12:30 점심: 하라주쿠 아후리(AFURI) 유자시오 라멘" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "14:00 시부야 스카이 전망대 입장 (13:45까지 도착하기)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "16:00 미야시타 파크 카페 휴식 & 넘버슈가 수제 카라멜 구매" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "19:30 저녁: 롯폰기 츠루동탄 (세숫대야 명란 크림 우동)" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Day 3 (아사쿠사 & 긴자 & 오다이바)" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "09:30 아사쿠사 센소지 신사 산책 & 나카미세도리 간식 (실크푸딩)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "12:00 점심: 긴자 모토무라 규카츠 (웨이팅 예상, 마 소스 추가)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "15:00 유리카모메 탑승 → 오다이바 해변공원, 자유의 여신상, 다이버시티 건담" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "18:30 레인보우 브릿지 야경 감상 & 덱스 도쿄 비치 저녁 식사" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Day 4 (쇼핑 & 귀국)" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "10:00 호텔 체크아웃 (캐리어 로비에 무료 보관)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "11:00 돈키호테 신주쿠 가부키초점 (면세 10% + 5% 할인쿠폰 적용)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "13:30 호텔에서 짐 픽업 → 신주쿠역 N'EX 탑승" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "15:30 나리타 공항 면세점: 도쿄바나나, 시로이코이비토, 닷사이 23 사케 구매" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "🛍️ 쇼핑 위시리스트 & 꿀팁" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "의약품: 샤론파스 140매, 오타이산 소화제, 이브 퀵(EVE Quick) 진통제, 로토 안약" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "화장품/잡화: 비오레 선크림, 휴족시간, 멜라노 CC 에센스" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "주류: 산토리 가쿠빈 위스키 (1인당 2병 면세 한도 확인)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "🚨 긴급 연락처: 주일 대한민국 대사관 +81-3-3452-7770 / 영사콜센터 +82-2-3210-0404" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const memoPreviewText = [
    "✈️ 도쿄 3박 4일 일정 & 맛집 총정리",
    "• Day 1: 나리타 공항 도착 → 호텔 체크인 → 타츠노야 츠케멘 → 도쿄도청 야경",
    "• Day 2: 하라주쿠 쇼핑 → 시부야 스카이(14:00 예약) → 롯폰기 츠루동탄",
    "• Day 3: 아사쿠사 센소지 → 긴자 규카츠 → 오다이바 해변공원 & 건담",
    "• Day 4: 돈키호테 면세 쇼핑 → 나리타 익스프레스(N'EX) → 면세점 쇼핑 & 귀국",
    "📌 필수 팁: 스이카 교통카드 애플페이 충전, 비짓재팬웹 입국 QR 사전 등록 완료",
  ].join("\n");

  const libraryMemoPack: Pack = {
    id: uid(),
    name: "여행 일정 & 맛집 메모",
    kind: "editor",
    type: "pack",
    items: [],
    editorDoc: memoDocContent,
    editorPreviewText: memoPreviewText,
    createdAt: now,
    updatedAt: now,
  };
  await saveLibraryPackRemote(user, libraryMemoPack, true);

  // -------------------------------------------------------------------------
  // 2) 가방 1: "도쿄 3박 4일 자유여행" (팩 4개)
  // -------------------------------------------------------------------------
  const travelBag: Bag = {
    id: uid(),
    name: "도쿄 3박 4일 자유여행",
    images: [],
    notice: "출발 3시간 전 인천공항 1터미널 H카운터 집결! 여권 만료일 6개월 이상 남았는지 꼭 확인해요",
    travelDate: isoDaysFromNow(14),
    reminderOffsets: [3, 1, 0],
    packs: [
      // 팩 1: 여권 & 필수 서류 (제스처 팁 포함)
      {
        id: uid(),
        name: "여권 & 필수 서류",
        items: [
          checkItem("👉 오른쪽으로 밀어보면 수정할 수 있어요"),
          checkItem("👈 왼쪽으로 밀면 삭제할 수 있어요"),
          checkItem("여권 원본 (유효기간 6개월 이상 확인)", true),
          checkItem("항공권 e-티켓 출력본 / 모바일 캡처", true),
          checkItem("해외여행자 보험 가입 증권"),
          checkItem("일본 Visit Japan Web 입국심사 QR 등록", true),
          checkItem("비상용 엔화 현금 30,000엔 & 트래블로그 카드"),
        ],
      },
      // 팩 2: 전자기기 & 충전 (팩 보관함 연동)
      {
        id: uid(),
        name: libraryElecPack.name,
        items: libraryElecPack.items.map((it) => ({ ...it, id: uid() })),
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryElecPack.id,
        linkedLibraryUpdatedAt: libraryElecPack.updatedAt,
      },
      // 팩 3: 의류 & 위생용품 (팩 보관함 연동)
      {
        id: uid(),
        name: libraryClothesPack.name,
        items: libraryClothesPack.items.map((it) => ({ ...it, id: uid() })),
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryClothesPack.id,
        linkedLibraryUpdatedAt: libraryClothesPack.updatedAt,
      },
      // 팩 4: 여행 일정 & 맛집 메모 (메모팩 + 실시간 동기화 켜짐)
      {
        id: uid(),
        name: libraryMemoPack.name,
        kind: "editor",
        items: [],
        editorDoc: memoDocContent,
        editorPreviewText: memoPreviewText,
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryMemoPack.id,
        linkedLibraryUpdatedAt: libraryMemoPack.updatedAt,
        autoSyncEnabled: true,
      },
    ],
    memberIds: [user.uid],
    ownerId: user.uid,
    inviteCode: "",
    createdAt: now,
    updatedAt: now,
  };

  // -------------------------------------------------------------------------
  // 3) 가방 2: "주말 글램핑 & 캠핑 1박 2일" (팩 3개)
  // -------------------------------------------------------------------------
  const campingMemoDocContent = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "🏕️ 가평 달빛 글램핑장 이용 안내 & 체크리스트" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "⏰ 입·퇴실 및 시설 규칙" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "입실(체크인): 15:00 / 퇴실(체크아웃): 익일 11:00" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "매너타임: 밤 22:00부터 (음악 OFF, 고성방가 금지)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "숯불 바베큐 세트: 18:00 시작 요청 완료 (그릴/숯/토치/장갑 제공)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "불멍 장작 세트: 현장 결제 15,000원 (오로라 가루 서비스)" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "🛒 인근 마트 & 편의시설" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "하나로마트 가평농협 자라섬점: 차량 10분 거리 (영업시간: 08:30~20:00)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "CU 가평달빛점: 도보 3분 거리 (24시간 영업, 장작/얼음 구비)" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "글램핑장 관리실 비상 연락처: 010-8765-4321" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "🔥 맛있는 바베큐 굽기 순서 팁" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "1. 숯불이 하얗게 달아오르면 먼저 목살/소고기부터 올리기" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "2. 삼겹살은 기름이 떨어져 불쇼가 날 수 있으니 가장자리나 호일 위에서 굽기" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "3. 마무리로 남은 불씨에 호일 감싼 고구마 & 마시멜로우 굽기 🍠" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const campingMemoPreviewText = [
    "🏕️ 가평 달빛 글램핑장 이용 안내 & 체크리스트",
    "• 체크인: 15:00 / 체크아웃: 11:00 (매너타임 22:00)",
    "• 숯불 바베큐 18:00 예약 완료, 불멍 장작 현장 결제",
    "• 하나로마트 가평농협점(차량 10분, 20시 마감)에서 장보기",
    "🔥 팁: 삼겹살은 호일 위에서 굽기, 고구마/마시멜로우 챙기기",
  ].join("\n");

  const campingBag: Bag = {
    id: uid(),
    name: "주말 글램핑 & 캠핑 1박 2일",
    images: [],
    notice: "입실 15:00 / 퇴실 11:00 (매너타임 22:00부터) - 숯불 바베큐 세트 18시 예약 완료!",
    travelDate: isoDaysFromNow(7),
    reminderOffsets: [1, 0],
    packs: [
      // 팩 1: 캠핑 & 취침 장비
      {
        id: uid(),
        name: "캠핑 & 취침 장비",
        items: [
          checkItem("사계절 침낭 / 담요 / 개인 베개", true),
          checkItem("충전식 LED 캠핑 랜턴 & 감성 조명", true),
          checkItem("방한 겉옷 / 핫팩 / 모기 기피제"),
          checkItem("블루투스 스피커 & 보드게임 (루미큐브)"),
          checkItem("휴대용 무선 미니 선풍기", true),
          checkItem("멀티탭 3구 (글램핑 텐트 내부용)"),
        ],
      },
      // 팩 2: 바베큐 & 먹거리 (팩 보관함 연동)
      {
        id: uid(),
        name: libraryFoodPack.name,
        items: libraryFoodPack.items.map((it) => ({ ...it, id: uid() })),
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryFoodPack.id,
        linkedLibraryUpdatedAt: libraryFoodPack.updatedAt,
      },
      // 팩 3: 캠핑장 이용 안내 & 체크인 (가방 전용 메모팩)
      {
        id: uid(),
        name: "캠핑장 이용 안내 & 체크인",
        kind: "editor",
        items: [],
        editorDoc: campingMemoDocContent,
        editorPreviewText: campingMemoPreviewText,
      },
    ],
    memberIds: [user.uid],
    ownerId: user.uid,
    inviteCode: "",
    createdAt: now,
    updatedAt: now,
  };

  // createBagRemote를 통해 서버 API(/api/create-bag)로 가방 2개 생성
  await createBagRemote(user, travelBag, ownerProfile);
  await createBagRemote(user, campingBag, ownerProfile);
}
