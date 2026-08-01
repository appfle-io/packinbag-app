// 앱스토어 리뷰어 계정에 실제 예시처럼 보이는 더미데이터(가방 여러 개 + 팩 보관함 대량)를
// 한 번에 넣어주는 스크립트. Admin SDK를 쓰므로 firestore.rules(클라이언트 생성 제한)와
// 무관하게 서버 권한으로 직접 씀.
//
// 실행법:
//   cd packinbag
//   node scripts/seed-review-data.mjs
//
// .env.local의 FIREBASE_SERVICE_ACCOUNT_KEY를 그대로 사용한다(app/api 라우트들과 동일 방식).
// 대상 계정은 REVIEWER_EMAIL(아래) - 이미 Firebase Auth에 가입되어 있어야 한다
// (앱에서 최소 한 번 로그인한 적 있는 계정이면 됨).
//
// 다시 실행해도 안전하게: bagId/packId는 이름 기반 고정 UUID를 쓰지 않고 매번 새로 생성하므로,
// 여러 번 실행하면 데이터가 중복으로 쌓인다. 재실행 전엔 리뷰어 계정 데이터를 앱에서
// 먼저 정리하거나, 필요하면 말해줘 - 정리용 스크립트도 만들어줄 수 있음.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const REVIEWER_EMAIL = "appfle.io+review@gmail.com";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// ---- .env.local에서 FIREBASE_SERVICE_ACCOUNT_KEY만 파싱 ----
function loadServiceAccount() {
  const envPath = join(projectRoot, ".env.local");
  const raw = readFileSync(envPath, "utf8");
  const line = raw
    .split("\n")
    .find((l) => l.trim().startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="));
  if (!line) {
    throw new Error(".env.local에서 FIREBASE_SERVICE_ACCOUNT_KEY를 찾을 수 없어요");
  }
  let value = line.slice(line.indexOf("=") + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(value.replace(/\\n/g, "\n"));
  }
}

const serviceAccount = loadServiceAccount();
initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

// ---------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------
function nowIso(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function futureDateStr(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// items: 문자열 배열. checkedIdx: 체크된 상태로 표시할 인덱스 배열(현실감용)
function checklistPack(name, items, { checkedIdx = [], parentId, minutesAgo = 60 } = {}) {
  return {
    id: randomUUID(),
    name,
    type: "pack",
    ...(parentId ? { parentId } : {}),
    items: items.map((text, i) => ({
      id: randomUUID(),
      type: "check",
      text,
      checked: checkedIdx.includes(i),
    })),
    createdAt: nowIso(-minutesAgo),
    updatedAt: nowIso(-Math.max(1, Math.floor(minutesAgo / 4))),
  };
}

function editorPack(name, lines, { parentId, minutesAgo = 60 } = {}) {
  return {
    id: randomUUID(),
    name,
    kind: "editor",
    type: "pack",
    ...(parentId ? { parentId } : {}),
    items: [],
    editorDoc: {
      type: "doc",
      content: lines.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
    },
    editorPreviewText: lines.join("\n"),
    createdAt: nowIso(-minutesAgo),
    updatedAt: nowIso(-Math.max(1, Math.floor(minutesAgo / 4))),
  };
}

function folderPack(name, { minutesAgo = 90 } = {}) {
  return {
    id: randomUUID(),
    name,
    type: "folder",
    items: [],
    createdAt: nowIso(-minutesAgo),
    updatedAt: nowIso(-minutesAgo),
  };
}

async function wipeExistingData(uid) {
  // 1) 내가 소유한 가방 전부 삭제 (+ 연결된 inviteCodes 문서도 같이 삭제)
  const ownedBags = await db.collection("bags").where("ownerId", "==", uid).get();
  let batch = db.batch();
  let ops = 0;
  const commits = [];
  function addOp(fn) {
    fn(batch);
    ops++;
    if (ops >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }
  for (const doc of ownedBags.docs) {
    const bag = doc.data();
    addOp((b) => b.delete(doc.ref));
    if (bag.inviteCode) {
      addOp((b) => b.delete(db.collection("inviteCodes").doc(bag.inviteCode)));
    }
  }

  // 2) 팩 보관함(libraryPacks) 전부 삭제
  const libraryPacksSnap = await db.collection("users").doc(uid).collection("libraryPacks").get();
  for (const doc of libraryPacksSnap.docs) {
    addOp((b) => b.delete(doc.ref));
  }

  commits.push(batch.commit());
  await Promise.all(commits);

  console.log(
    `기존 데이터 삭제 완료: 가방 ${ownedBags.size}개, 팩 보관함 ${libraryPacksSnap.size}개`
  );
}

async function main() {
  const user = await auth.getUserByEmail(REVIEWER_EMAIL);
  const uid = user.uid;
  console.log(`리뷰어 계정 확인: ${REVIEWER_EMAIL} (uid: ${uid})`);

  await wipeExistingData(uid);

  const ownerProfile = { nickname: "제이", avatarId: "fox", joinedAt: nowIso() };

  function makeBag(name, packs, extra = {}) {
    const bagId = randomUUID();
    const inviteCode = generateInviteCode();
    return {
      doc: {
        id: bagId,
        name,
        images: [],
        packs,
        memberIds: [uid],
        memberProfiles: { [uid]: ownerProfile },
        ownerId: uid,
        inviteCode,
        createdAt: nowIso(-500),
        updatedAt: nowIso(-30),
        ...extra,
      },
      inviteCode,
    };
  }

  // =======================================================================
  // 가방 (Bags) - 서로 다른 성격의 5개
  // =======================================================================
  const bags = [];

  // 1. 여행 (개인)
  bags.push(
    makeBag(
      "제주도 3박4일 여행",
      [
        checklistPack("의류", ["반팔티 3벌", "반바지 2벌", "속옷 / 양말", "잠옷", "가벼운 바람막이"], {
          checkedIdx: [0, 2],
        }),
        checklistPack("세면도구", ["칫솔 / 치약", "스킨 / 로션", "선크림", "면도기"], {
          checkedIdx: [0, 2],
        }),
        checklistPack("전자기기", ["휴대폰 충전기", "보조배터리", "카메라", "이어폰"], {
          checkedIdx: [0, 3],
        }),
        checklistPack("서류 / 기타", ["신분증", "항공권 예약 확인서", "여행자보험 서류", "현금 / 카드"], {
          checkedIdx: [1],
        }),
        editorPack("여행 일정", [
          "1일차: 제주공항 도착 → 렌터카 수령 → 숙소 체크인",
          "2일차: 성산일출봉 → 우도 → 해산물 저녁",
          "3일차: 한라산 둘레길 → 카페 투어",
          "4일차: 공항 이동 → 렌터카 반납 → 출국",
        ]),
      ],
      {
        notice: "다들 여권/신분증 챙기는 거 잊지 마세요!",
        travelDate: futureDateStr(21),
        reminderOffsets: [3, 1, 0],
      }
    )
  );

  // 2. 업무 - 워크샵
  bags.push(
    makeBag(
      "신입 워크샵 준비",
      [
        checklistPack("발표자료", ["팀 소개 슬라이드", "아이스브레이킹 자료", "설문지 QR코드"], {
          checkedIdx: [0],
        }),
        checklistPack("현장 준비물", ["명찰", "네임펜", "포스트잇", "간식 / 음료", "빔프로젝터 케이블"], {
          checkedIdx: [0, 1],
        }),
        checklistPack("예산", ["숙소 예약금", "식대", "기념품 비용", "교통비"], {
          checkedIdx: [0],
        }),
        editorPack("참가자 명단 메모", [
          "총 인원: 24명 (신입 18 + 진행 6)",
          "알레르기: 견과류 2명, 갑각류 1명",
          "숙소 배정표는 공유 시트 참고",
        ]),
      ],
      {
        notice: "명찰은 도착 순서대로 나눠주세요",
        travelDate: futureDateStr(10),
        reminderOffsets: [1, 0],
      }
    )
  );

  // 3. 이사
  bags.push(
    makeBag(
      "자취방 이사 체크리스트",
      [
        checklistPack("버릴 것 / 정리할 것", ["안 입는 옷 정리", "유통기한 지난 식품 처분", "고장난 가전 폐기 신청"], {
          checkedIdx: [0],
        }),
        checklistPack("새 집 준비물", ["도배 / 청소 상태 확인", "인터넷 설치 예약", "가스레인지 점검", "커튼 / 블라인드"], {
          checkedIdx: [1],
        }),
        checklistPack("이사 당일", ["사다리차 / 용달 예약 확인", "포장박스 라벨링", "귀중품 따로 챙기기"], {
          checkedIdx: [],
        }),
        checklistPack("행정처리", ["전입신고", "우편물 주소 변경", "관리비 정산", "인터넷 / 정수기 이전 신청"], {
          checkedIdx: [],
        }),
      ],
      {
        notice: "관리사무소 이사 신고는 3일 전까지!",
        travelDate: futureDateStr(14),
        reminderOffsets: [3, 0],
      }
    )
  );

  // 4. 신생아 준비
  bags.push(
    makeBag(
      "신생아 맞이 준비",
      [
        checklistPack("출산가방(병원용)", ["산모 수유복", "신생아 배냇저고리", "속싸개 / 겉싸개", "기저귀 / 물티슈", "손발싸개"], {
          checkedIdx: [3],
        }),
        checklistPack("아기용품", ["신생아 카시트", "젖병 / 젖병소독기", "기저귀 갈이대", "체온계"], {
          checkedIdx: [0],
        }),
        checklistPack("산모용품", ["산모패드", "복대", "유축기", "마사지 오일"], {
          checkedIdx: [],
        }),
      ],
      {
        notice: "출산예정일 기준 준비물, 병원 가방은 미리 현관에 둘 것",
        travelDate: futureDateStr(35),
        reminderOffsets: [3, 1, 0],
      }
    )
  );

  // 5. 결혼식 준비
  bags.push(
    makeBag(
      "결혼식 준비",
      [
        checklistPack("예식 당일 준비물", ["예복 / 드레스", "청첩장 여분", "예물 / 반지", "부케"], {
          checkedIdx: [2],
        }),
        checklistPack("신혼여행 준비물", ["여권", "환전", "여행자 보험", "캐리어"], {
          checkedIdx: [],
        }),
        editorPack("답례품 / 축의금 메모", [
          "답례품 100세트 주문완료 (업체: OO몰)",
          "축의금 봉투 대여 명단 확인 필요",
          "부모님 자리 좌석표 최종 확인",
        ]),
      ],
      {
        notice: "리허설은 예식 3일 전 오후 2시",
        travelDate: futureDateStr(45),
        reminderOffsets: [3, 1, 0],
      }
    )
  );

  // =======================================================================
  // 팩 보관함(libraryPacks) - 가방에 안 들어있는 재사용용 팩들, 폴더 포함
  // =======================================================================
  const libraryDocs = [];

  // 폴더: 여행
  const travelFolder = folderPack("여행");
  libraryDocs.push(
    travelFolder,
    checklistPack("공항 체크리스트", ["여권 유효기간 확인", "탑승권 출력 / 모바일 등록", "기내 반입 금지 물품 확인", "환전"], {
      parentId: travelFolder.id,
    }),
    checklistPack("숙소 체크아웃 체크리스트", ["충전기 / 케이블 두고 가지 않기", "냉장고 확인", "귀중품 확인", "쓰레기 정리"], {
      parentId: travelFolder.id,
    }),
    checklistPack("해외여행 필수품", ["여권 사본", "해외 유심 / 로밍", "멀티 어댑터", "상비약"], {
      parentId: travelFolder.id,
    }),
    checklistPack("국내여행 필수품", ["텀블러", "돗자리", "선크림", "우산"], {
      parentId: travelFolder.id,
    })
  );

  // 폴더: 업무
  const workFolder = folderPack("업무");
  libraryDocs.push(
    workFolder,
    checklistPack("출장 준비물", ["노트북 / 충전기", "명함", "정장 / 셔츠", "법인카드"], {
      parentId: workFolder.id,
    }),
    checklistPack("신입사원 온보딩 체크리스트", ["사원증 발급", "PC / 계정 세팅", "사내 시스템 교육", "멘토 배정"], {
      parentId: workFolder.id,
    }),
    checklistPack("화상회의 준비물", ["이어폰 / 헤드셋", "배경 정리", "발표자료 최종본", "네트워크 상태 확인"], {
      parentId: workFolder.id,
    })
  );

  // 폴더: 생활
  const lifeFolder = folderPack("생활");
  libraryDocs.push(
    lifeFolder,
    checklistPack("대청소 체크리스트", ["침구 세탁", "냉장고 정리", "화장실 곰팡이 제거", "창문 / 방충망 청소"], {
      parentId: lifeFolder.id,
    }),
    checklistPack("차량 정기점검", ["엔진오일 교체", "타이어 공기압 점검", "와이퍼 상태 확인", "블랙박스 메모리 확인"], {
      parentId: lifeFolder.id,
    }),
    checklistPack("반려동물 병원 준비물", ["이동장", "예방접종 수첩", "간식", "리드줄"], {
      parentId: lifeFolder.id,
    })
  );

  // 최상위(폴더 없이) 팩들 - 다양한 취미/상황
  libraryDocs.push(
    checklistPack("캠핑 준비물", ["텐트", "침낭", "버너 / 코펠", "랜턴", "방충 스프레이"], { checkedIdx: [0] }),
    checklistPack("등산 준비물", ["등산화", "스틱", "물 / 간식", "우비", "무릎보호대"], {}),
    checklistPack("헬스장 준비물", ["운동복", "수건", "운동화", "샤워용품"], {}),
    checklistPack("골프 준비물", ["골프복", "장갑", "골프화", "볼마커 / 티"], {}),
    checklistPack("낚시 준비물", ["낚싯대", "릴", "미끼", "아이스박스", "구명조끼"], {}),
    checklistPack("스키장 준비물", ["스키복", "고글", "장갑", "핫팩", "이너웨어"], {}),
    checklistPack("필라테스 준비물", ["필라테스 양말", "요가매트", "수건", "물"], {}),
    checklistPack("홈파티 준비물", ["케이크", "풍선 / 가랜드", "일회용 접시", "음료"], {}),
    checklistPack("크리스마스 파티 준비", ["트리 장식", "선물 포장", "캐롤 플레이리스트", "케이크 예약"], {}),
    checklistPack("수능 / 자격증 시험 준비물", ["수험표", "신분증", "컴퓨터용 사인펜", "아날로그 시계", "간식"], {
      checkedIdx: [0],
    }),
    checklistPack("프로젝트 킥오프 체크리스트", ["일정표 공유", "역할 분담 확정", "협업툴 세팅", "킥오프 미팅 어젠다"], {}),
    editorPack("선물 아이디어 메모", [
      "엄마 생신: 마사지기 or 스카프",
      "친구 결혼선물: 커피머신 (같이 사기로 함)",
      "조카 생일: 레고 or 그림책 세트",
    ])
  );

  // =======================================================================
  // Firestore에 기록 (batch는 500개 제한이 있어 넉넉히 나눠서 처리)
  // =======================================================================
  let batch = db.batch();
  let opCount = 0;
  const commits = [];

  function addOp(fn) {
    fn(batch);
    opCount++;
    if (opCount >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      opCount = 0;
    }
  }

  for (const { doc, inviteCode } of bags) {
    addOp((b) => b.set(db.collection("bags").doc(doc.id), doc));
    addOp((b) => b.set(db.collection("inviteCodes").doc(inviteCode), { bagId: doc.id }));
  }
  for (const pack of libraryDocs) {
    addOp((b) => b.set(db.collection("users").doc(uid).collection("libraryPacks").doc(pack.id), pack));
  }
  commits.push(batch.commit());
  await Promise.all(commits);

  console.log("완료!");
  console.log(`- 가방 ${bags.length}개 생성: ${bags.map((b) => b.doc.name).join(", ")}`);
  console.log(`- 팩 보관함: 폴더 3개(여행/업무/생활) + 팩 ${libraryDocs.length - 3}개`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("시드 데이터 생성 실패:", err);
    process.exit(1);
  });
