// 신규 가입자 온보딩용 샘플 데이터.
// 계정을 막 만든 사람이 빈 화면을 보지 않도록, "프로필을 처음 완성하는 시점"에
// 딱 한 번(AuthProvider의 signUpWithEmail/completeProfile에서 first-time 판정)
// 이 데이터를 채워준다.
//
// [무료 회원 제한 기준 준수]
// - 가방(Bag): FREE_MAX_ACTIVE_BAGS(3) 중 2개 생성 (1개 여유 슬롯)
//   - 가방 1: "도쿄 3박 4일 자유여행" (팩 4개: 체크리스트 3개 + 실시간 동기화 메모팩 1개)
//   - 가방 2: "어린이집 등원 가방 (개나리반)" (팩 4개: 체크리스트 3개 + 가방 전용 메모팩 1개, 10/27 글램핑에서 바꿈 —
//     가방이 여행 전용이 아님을 보여 주려고. 마감일 아이템 · 글 아이템 · 메모 표 · 할 일 목록 예시)
// - 팩 보관함(Library Packs): FREE_MAX_LIBRARY_PACKS(10) 중 5개 생성 (5개 여유 슬롯)
//   - 폴더 1개: "✈️ 여행 기본 세트" (folder)
//   - 내부 팩 2개: "전자기기 & 충전", "의류 & 위생용품" (폴더 안)
//   - 루트 팩 1개: "어린이집 매일 준비물" (가방 2와 연동)
//   - 루트 메모팩 1개: "여행 일정 & 맛집 메모" (가방 1과 실시간 동기화 연동)

import type { User } from "firebase/auth";
import { Bag, Item, Pack } from "@/lib/types";
import { createBagRemote } from "@/lib/bagsService";
import { saveLibraryPackRemote } from "@/lib/packsService";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function checkItem(text: string, checked = false): Item {
  return { id: uid(), type: "check", text, checked };
}

// 이 기기 날짜 기준 YYYY-MM-DD(toISOString은 UTC라 한국 아침 9시 전엔 하루 밀렸다)
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function textItem(text: string, bold = false): Item {
  return { id: uid(), type: "text", text, ...(bold ? { bold: true } : {}) };
}

// 마감일이 있는 체크 아이템(BAG-ISHEET-12). days = 오늘부터 며칠 뒤
function dueItem(text: string, days: number, checked = false): Item {
  return { ...checkItem(text, checked), dueDate: isoDaysFromNow(days) };
}

// 메모 샘플용 TipTap 블록 도우미
const memoText = (text: string, bold = false) => (bold ? { type: "text", marks: [{ type: "bold" }], text } : { type: "text", text });
const memoPara = (text: string, bold = false) => ({ type: "paragraph", content: [memoText(text, bold)] });
const memoHeading = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [memoText(text)] });
const memoBullets = (texts: string[]) => ({
  type: "bulletList",
  content: texts.map((t) => ({ type: "listItem", content: [memoPara(t)] })),
});
const memoTasks = (tasks: [string, boolean][]) => ({
  type: "taskList",
  content: tasks.map(([t, checked]) => ({ type: "taskItem", attrs: { checked }, content: [memoPara(t)] })),
});
// 첫 줄은 머리글
const memoTable = (rows: string[][]) => ({
  type: "table",
  content: rows.map((cells, r) => ({
    type: "tableRow",
    content: cells.map((c) => ({ type: r === 0 ? "tableHeader" : "tableCell", content: [memoPara(c, r === 0)] })),
  })),
});

// 샘플 가방 · 팩을 만들기만 한다(저장 없음). 새 가입자(seedSampleDataForNewUser)와 체험 모드(lib/demoSeed.ts)가 같이 쓴다(2026-10-18)
export function buildSampleData(ownerUid: string): { libraryPacks: Pack[]; bags: Bag[] } {
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

  // 1-4. 루트 팩: "어린이집 매일 준비물" (가방 2와 연동)
  const libraryDaycarePack: Pack = {
    id: uid(),
    name: "어린이집 매일 준비물",
    type: "pack",
    createdAt: now,
    updatedAt: now,
    items: [
      checkItem("기저귀 5장 (이름 쓴 지퍼백에)", true),
      checkItem("물티슈 1팩 (뚜껑형, 월요일에 새로)", true),
      checkItem("여벌 옷 한 벌: 상의 · 하의 · 내복 · 양말"),
      checkItem("빨대컵 물통 (씻어서 말린 것, 이름표 확인)", true),
      checkItem("수저통: 숟가락 · 포크 · 젓가락"),
      checkItem("가제 손수건 2장"),
      checkItem("알림장 확인 · 키즈노트 투약의뢰서"),
      checkItem("실내화 (금요일에 가져와서 세탁)"),
    ],
  };

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
                  { type: "text", text: "14:30 호텔 체크인 & 아이템 정리 후 신주쿠 거리 산책" },
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
                  { type: "text", text: "13:30 호텔에서 아이템 픽업 → 신주쿠역 N'EX 탑승" },
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
          checkItem("👉 누르면 체크, 길게 누르면(PC는 오른쪽 클릭) 이름 · 마감일 · 다른 팩으로 옮기기"),
          checkItem("👆 팩 이름을 길게 누르면 모두 체크 · 보관함에 저장 · 삭제"),
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
    memberIds: [ownerUid],
    ownerId: ownerUid,
    inviteCode: "",
    createdAt: now,
    updatedAt: now,
  };

  // -------------------------------------------------------------------------
  // 3) 가방 2: "어린이집 등원 가방 (개나리반)" (팩 4개)
  // 가방이 여행 전용이 아니라는 걸 보여 주는 생활 가방(2026-10-27, 예전 "주말 글램핑"을 바꿈).
  // 매일 챙길 것(보관함 연동) · D-Day 행사(마감일 아이템 · 글 아이템) · 요일별 · 메모(표 · 할 일 목록)를 고루 담는다
  // -------------------------------------------------------------------------
  const daycareMemoDocContent = {
    type: "doc",
    content: [
      memoHeading(2, "🧸 햇살어린이집 개나리반 (만 2세)"),
      memoPara("📞 연락처 · 시간", true),
      memoBullets([
        "담임 김하늘 선생님 · 키즈노트 메시지가 가장 빨라요",
        "원 사무실 02-1234-5678 (평일 08:00~19:30)",
        "등원 08:30~09:00 · 하원 16:00 (연장반은 19:30까지)",
        "결석 · 지각은 08:30 전에 키즈노트로 알리기",
      ]),
      memoHeading(3, "💊 투약 · 건강"),
      memoBullets([
        "약은 투약의뢰서를 쓰고, 약병에 이름 · 용량 · 먹일 시간 적기",
        "37.5도가 넘으면 등원이 어려워요 (해열제 없이 24시간 열이 없으면 등원)",
        "복숭아 알레르기 — 원에 알림 완료, 매달 간식표에서 한 번 더 확인",
      ]),
      memoHeading(3, "🗓️ 이번 달 일정"),
      memoTable([
        ["언제", "일정", "준비"],
        ["D-Day", "고구마 캐기 현장학습", "체육복 · 운동화 · 도시락"],
        ["둘째 주 금요일", "이달 생일 파티", "간식은 원에서 준비"],
        ["셋째 주", "부모 상담 주간", "키즈노트로 상담 시간 신청"],
        ["매주 수요일", "영어 · 체육 특활", "특활 가방 · 실내 운동화"],
      ]),
      memoHeading(3, "✅ 선생님께 전달할 것"),
      memoTasks([
        ["요즘 낮잠을 늦게 자요 — 원에서 몇 시에 자는지 여쭤보기", false],
        ["원에 여벌 바지 1벌 더 두기", true],
        ["현장학습 날 하원을 15:00로 앞당겨도 되는지", false],
      ]),
      memoPara("💡 모든 물건에 이름 스티커! 같은 물통 · 실내화가 반에 여러 개예요."),
    ],
  };

  const daycareMemoPreviewText = [
    "🧸 햇살어린이집 개나리반 (만 2세)",
    "• 담임 김하늘 선생님 · 키즈노트 · 원 사무실 02-1234-5678",
    "• 등원 08:30~09:00 · 하원 16:00 · 결석은 08:30 전에 알리기",
    "• 투약의뢰서 + 약병에 이름 · 용량 · 시간 / 복숭아 알레르기",
    "🗓️ D-Day 고구마 캐기 현장학습 · 셋째 주 부모 상담",
  ].join("\n");

  const daycareBag: Bag = {
    id: uid(),
    name: "어린이집 등원 가방 (개나리반)",
    images: [],
    notice: "매일 08:50까지 등원 · D-Day는 고구마 캐기 현장학습 날이에요 (체육복 · 운동화)",
    travelDate: isoDaysFromNow(3),
    reminderOffsets: [1, 0],
    packs: [
      // 팩 1: 어린이집 매일 준비물 (팩 보관함 연동)
      {
        id: uid(),
        name: libraryDaycarePack.name,
        items: libraryDaycarePack.items.map((it) => ({ ...it, id: uid() })),
        savedAsLibraryPack: true,
        linkedLibraryPackId: libraryDaycarePack.id,
        linkedLibraryUpdatedAt: libraryDaycarePack.updatedAt,
      },
      // 팩 2: D-Day 행사 — 마감일 아이템 · 글 아이템 예시
      {
        id: uid(),
        name: "현장학습 · 고구마 캐기 (D-Day)",
        items: [
          textItem("📌 원 안내: 도시락은 한입 크기로, 간식은 한 가지만 보내 주세요", true),
          dueItem("현장학습 참가 동의서 서명해서 보내기", 1),
          dueItem("참가비 5,000원 — 봉투에 이름 써서 보내기", 2),
          checkItem("도시락: 한입 유부초밥 · 방울토마토 · 사과 (보냉 가방에)"),
          checkItem("간식 한 가지: 떡뻥 1봉"),
          checkItem("이름표 붙인 물통 (보리차 가득)"),
          checkItem("모자 · 선크림 (등원 전에 발라 주기)", true),
          checkItem("체육복 · 운동화 입혀 보내기"),
          checkItem("고구마 담아 올 비닐봉지 2장 · 어린이 장갑"),
          checkItem("흙 묻을 때 갈아 신을 양말 · 물티슈"),
        ],
      },
      // 팩 3: 요일별 챙길 것 — 글 아이템을 소제목처럼
      {
        id: uid(),
        name: "요일별 챙길 것",
        items: [
          textItem("월요일 — 가져가기", true),
          checkItem("세탁한 낮잠 이불 · 베개 커버"),
          checkItem("새 칫솔 · 치약 (매달 첫 월요일)"),
          textItem("수요일 — 영어 · 체육 특활", true),
          checkItem("특활 가방 · 실내 운동화"),
          textItem("금요일 — 가져오기", true),
          checkItem("낮잠 이불 · 실내화 가져와서 세탁", true),
          checkItem("남은 기저귀 · 물티슈 개수 확인", true),
        ],
      },
      // 팩 4: 선생님 전달 사항 & 연락처 (가방 전용 메모팩 — 표 · 할 일 목록)
      {
        id: uid(),
        name: "선생님 전달 사항 & 연락처",
        kind: "editor",
        items: [],
        editorDoc: daycareMemoDocContent,
        editorPreviewText: daycareMemoPreviewText,
      },
    ],
    memberIds: [ownerUid],
    ownerId: ownerUid,
    inviteCode: "",
    createdAt: now,
    updatedAt: now,
  };

  return {
    libraryPacks: [folderTravel, libraryElecPack, libraryClothesPack, libraryDaycarePack, libraryMemoPack],
    bags: [travelBag, daycareBag],
  };
}

export async function seedSampleDataForNewUser(
  user: User,
  ownerProfile: { nickname: string; avatarId: string }
) {
  const { libraryPacks, bags } = buildSampleData(user.uid);
  // 보관함을 먼저(폴더 → 팩 → 메모) 저장한 뒤 가방을 서버 API(/api/create-bag)로 만든다
  for (const pack of libraryPacks) {
    await saveLibraryPackRemote(user, pack, true);
  }
  for (const bag of bags) {
    await createBagRemote(user, bag, ownerProfile);
  }
}
