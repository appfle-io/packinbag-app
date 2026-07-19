# 팩인백 QA 체크리스트

메뉴/화면 단위로 검증한 테스트케이스를 모아두는 문서. 새 기능이 추가되면 해당 화면
섹션 아래에 다음 번호로 이어붙인다. 기존 항목이 관련된 코드가 바뀌면 상태를 다시
확인하고 갱신한다.

## 사용법 (다음 대화방에서 이 문서를 열 때)

- 화면 하나를 검증/수정할 때는 그 화면에 해당하는 섹션을 먼저 훑고, 관련 코드를
  건드렸다면 영향받는 항목의 상태를 다시 확인한다.
- 새 항목 추가 형식: `[코드] 항목 설명 — 관련 파일` 한 줄 + 필요하면 확인 방법/비고를
  아래 들여쓰기로.
- 코드 접두어: `A-` 로그인/회원가입, `P-` 팩 보관함, `B-` 가방 보관함, `E-` 가방 속
  기능들, `N-` 네이티브(Capacitor) 배포 전 확인. 화면이 늘어나면 새 접두어를 추가한다
  (예: 설정 `S-`).
- 상태 아이콘
  - ✅ 코드 검토로 정상 확인됨
  - 🔍 코드는 확인했지만 실기기/실사용 테스트가 필요함
  - ⚠️ 정책/의도 확인이 필요함 (버그는 아니지만 의사결정 필요)
  - ❌→🔧 버그였다가 수정 완료 (하단 "발견 후 수정한 이슈" 참고)

## 발견 후 수정한 이슈

1. **초대코드 재발급 무효화 안 됨** (2026-07-12 발견/수정)
   `firestore.rules`의 `inviteCodes`는 `allow update, delete: if false`라서 클라이언트가
   옛 코드 문서를 지울 수 없었음 → 재발급해도 옛 코드로 계속 참여 가능했던 버그.
   `app/api/regenerate-invite-code`(Admin SDK) 신설로 수정.
2. **이용권 만료 시각 실시간 감지 안 됨** (2026-07-12 발견/수정)
   `unlockCodes/{code}` 문서 자체가 안 바뀌면 `onSnapshot`이 재실행되지 않아, 세션을
   계속 켜둔 채로 만료 시각이 지나가도 감지 못했던 문제. `AuthProvider.tsx`에 만료
   시각 도달 시 1회 재평가하는 `setTimeout`(20일 단위 재귀, 오버플로 방지) 추가.
3. **PDF 첨부가 storage.rules에 막혀 항상 실패** (2026-07-12 발견/수정 겸 기능추가)
   `storage.rules`의 write 조건이 `contentType.matches('image/.*')`만 허용해서 PDF는
   배포 이후로 한 번도 실제로 업로드 성공한 적이 없었음. 이 기회에 **PDF를 프리미엄
   전용 기능으로 전환**: storage.rules에 `isPremium()` 함수를 추가해 읽기/쓰기 요청자가
   실시간으로 프리미엄인지 검사(마스터 이메일 또는 유효한 unlockCode). 다운그레이드해도
   별도 동기화 배치 없이 다음 요청부터 즉시 차단됨(팩/가방의 `locked` 필드 방식과 달리
   실시간 평가라 sync-lock-status 같은 추가 인프라가 필요 없음). 클라이언트에는
   `PdfPreviewModal.tsx`(iframe 기반 인앱 미리보기) + `BagEditorScreen`의 프리미엄
   업셀 모달(PremiumLimitModal 재사용)을 추가해서 무료회원이 실패를 겪기 전에 먼저
   안내하도록 함.
5. **ConfirmDialog가 파일 삭제 시트 안에서 클릭이 안 먹힘** (2026-07-12 발견/수정)
   `ConfirmDialog`가 `z-[70]`이었는데, 팩을 삭제하려고 할 때 팩 편집 시트(AppShell의
   `z-[75]` 백드롭) 안에서 띄으면 그 다이얼로그가 시트 백드롭보다 낮은 z-index에
   가려졌다. 시각적으로는 다이얼로그가 보이지만 실제 클릭은 그 위에 있는 시트 백드롭(=닫기
   동작)이 받아버려서, "휴지통으로" 버튼을 누르면 삭제가 안 되고 시트만 닫혀는 버그가
   있었음. `z-[95]`로 올려서 앱 내 모든 시트/모달보다 항상 위에 오도록 수정.
6. **알림종이 설정 아이콘을 가림** (2026-07-12 발견/수정)
   처음에 `AppShell` 레벨에서 항상 우상단에 고정된 독립 오버레이로 만들었다가,
   팩/가방 보관함 화면 자체의 헤더 아이콘 줄(검색/도움말/설정)과 같은 자리를 놓고
   겹쳐서 설정 아이콘을 가려 누를 수 없게 된 버그. 지금은 PacksScreen/HomeScreen/
   SettingsScreen 각자의 헤더 아이콘 줄 안에 다른 아이콘들과 나란히 들어가는 평범한
   인라인 버튼으로 바꿔서 위치 충돌 자체가 구조적으로 불가능해졌다.
7. **이메일 미인증 계정으로 로그인 시도 시 홈 화면이 잠깐 반짝였다가 튕겨나감** (2026-07-12 발견/수정)
   `signUpWithEmail`/`resendVerificationByCredential`은 `authBusy` 가드로 감싸져 있었지만,
   정작 로그인 버튼이 호출하는 `signInWithEmail`에는 이 가드가 빠져있었음.
   `signInWithEmailAndPassword`가 성공하면 Firebase가 이메일 인증 여부와 무관하게 일단
   로그인 상태로 만들어버려서 `onAuthStateChanged`가 즉시 발동되는데, `authBusy`가 없으면
   우리 코드가 `emailVerified`를 확인하고 다시 로그아웃시키는 그 짧은 순간 동안 AppShell이
   홈 화면(+ EmailVerifyBanner)을 잠깐 보여줬다가 다시 로그인 화면으로 튕겨나가는 깜빡임이
   생김 — appflo가 예전에 겪었다고 말한 바로 그 증상. `signInWithEmail`도 나머지 두 함수와
   동일하게 `setAuthBusy(true)/finally setAuthBusy(false)`로 감싸서 수정.

---

## 로그인 / 회원가입 (AuthScreen.tsx, AuthProvider.tsx, GoogleProfileSetup.tsx)

### 이메일 인증 강제 (핵심 요구사항)

- A-01 회원가입 직후 자동 로그인되지 않고 로그인 화면으로 돌아옴, 인증 메일 발송 안내 토스트 — `signUpWithEmail` ✅
- A-02 이메일 미인증 계정으로 로그인 시도 시 로그인 차단 + "인증 메일 다시 받기" 버튼 노출 — `signInWithEmail`(`EMAIL_NOT_VERIFIED`) ✅
- A-03 인증 완료 후 정상 로그인 — `emailVerified === true` 통과 ✅
- A-04 구글 로그인은 이메일 인증 개념 자체가 없음(구글이 이미 검증) — `EmailVerifyBanner`가 `providerId === "password"`인 계정에만 노출되도록 필터링 ✅
  - 🔍 실기기에서 구글 계정으로 가입 시 인증 관련 문구/배너가 전혀 안 뜨는지 확인

### 화면 전환 매끄러움 (깜빡임 방지) — appflo가 특히 강조한 부분

- A-05 회원가입 처리 중(계정생성→인증메일발송→로그아웃) 홈 화면으로 안 튀는지 — `authBusy` 가드, `AppShell`의 `if (!user || authBusy)` ✅
- A-06 **이메일 미인증 계정 로그인 시도 시 홈 화면 반짝임 — 오늘 발견/수정(위 이슈 7번), `signInWithEmail`에 `authBusy` 가드 추가** 🔧
  - 🔍 실기기에서 미인증 계정으로 로그인 버튼 눌러보고 화면이 로그인→(스플래시)→로그인(인증안내) 순으로만 자연스럽게 넘어가는지, 홈 화면이 스치듯이라도 보이지 않는지 확인 필요
- A-07 "인증 메일 다시 받기"(로그인 화면에서, 비밀번호로 재로그인 후 발송) 흐름도 동일하게 `authBusy`로 감싸져 있어 깜빡임 없음 — `resendVerificationByCredential` ✅
- A-08 재로그인/재발송 실패 시(비밀번호 틀림 등) 에러 메시지만 뜨고 화면 전환 없음 ✅
- A-09 로딩 스플래시(`SplashScreen`)가 `loading` 상태 동안 항상 위를 덮고 있어서, 위 A-05/A-06 가드가 혹시 놓치는 타이밍이 있어도 2차 방어선 역할 ✅

### 회원가입 폼

- A-10 비밀번호/비밀번호확인 불일치 시 제출 차단 + 실시간 안내문구 ✅
- A-11 닉네임 미입력 시 제출 차단 ✅
- A-12 닉네임 랜덤 추천, 아바타 선택 ✅
- A-13 가입 성공 시 이메일은 유지하고 비밀번호 필드만 초기화(재로그인 편의) ✅
- A-14 인증 메일 발송 자체가 실패해도 가입은 완료 처리(별도 안내 문구로 구분) — `sent` 플래그 ✅

### 비밀번호 재설정

- A-15 로그인 화면 → 비밀번호 재설정 화면 전환, 로그인 시도 중이던 이메일 자동 채움 ✅
- A-16 재설정 메일 발송 후 로그인 화면으로 자동 복귀 ✅

### 구글 최초 로그인 (닉네임/아바타 없음)

- A-17 구글 최초 로그인 시 `GoogleProfileSetup`(닉네임+아바타 선택) 강제 노출 — `AppShell`의 `if (!profile?.nickname || !profile?.avatarId)` ✅
- A-18 "다른 계정으로 로그인" — 로그아웃 확인 다이얼로그 후 로그아웃 ✅
- A-19 프로필 저장 완료 시 샘플 온보딩 데이터(`seedSampleDataForNewUser`) 최초 1회만 생성 ✅

---

## 팩 보관함 (PacksScreen.tsx)

### 티어 / 잠금 (무료 3개 제한)

- P-01 무료 팩 3개 미만일 때 정상 생성/저장 — `app/api/create-library-pack` ✅
- P-02 무료 팩 3개 도달 시 4번째 생성 차단(`PACK_LIMIT_REACHED` → `PremiumLimitModal`) — `app/api/create-library-pack`, `AppShell.tsx` ✅
- P-03 유료 전환 후 자유롭게 생성 — `premiumServer.ts isPremiumServer` ✅
- P-04 유료→무료 다운그레이드 시 최신 3개만 유지, 나머지 잠금 — `app/api/sync-lock-status` ✅
- P-05 잠긴 팩 devtools 우회 수정 시도 차단 — `firestore.rules`(libraryPacks update 규칙)
  - 🔍 **로컬 파일 내용과 Firebase 콘솔에 실제 배포된 규칙이 일치하는지 수동 대조 필요** (규칙 배포는 코드 배포와 별도 파이프라인)
- P-06 휴지통으로 보낸 팩은 잠금 계산에서 제외 — `computeLockedPackIds`, `sync-lock-status` ✅
- P-07 빠른팩(QUICK_PACK_ID)은 개수 제한/잠금 항상 예외 — `premiumLimits.ts`, `create-library-pack/route.ts` ✅
- P-08 확장/축소 3단계, 벌크삭제, 그리드 핀(최대2), 드래그 정렬, 카드 사이즈/폰트 슬라이더, 색상 설정이 티어와 무관하게 동작 — `AuthProvider.tsx` 각 update 함수
  - 🔍 실기기 클릭 테스트 권장 (핀 2개 초과 무시, 확장 전환 애니메이션 등)

### 검색

- P-09 팩 이름 / 팩 속 짐 텍스트 검색 — `lib/librarySearch.ts searchLibraryPacks` ✅
- P-10 짐 검색 결과 클릭 시 해당 팩으로 이동 + 자동 스크롤/하이라이트 — `PackLibraryEditorScreen.tsx`의 `focusItemId` effect ✅
  - 🔍 시트 렌더 타이밍(150ms 지연)이 느린 기기에서 스킵될 수 있는지 실기기 확인 권장
- P-11 빈 검색어 / 결과 없음 안내 문구 — `PacksScreen.tsx` ✅
- P-12 검색어 지우기(X) / 취소(검색창 닫기) 상태 초기화 — `PacksScreen.tsx` ✅
- P-13 결과 30개 초과 시 안내 문구("결과가 많아 상위 30개만 보여드려요") — `librarySearch.ts searchLibraryPacks`(truncated 플래그) ✅
- P-14 빠른팩도 검색 대상에 포함, 매칭된 짐 클릭 시 빠른팩이 열리며 동일하게 스크롤+하이라이트 — `PacksScreen.tsx searchablePacks` ✅
- P-15 잠긴 팩도 검색에 노출되고 클릭 시 읽기전용으로 진입(우회 아님) — `AppShell.tsx`의 `lockedPackIds` 계산 ✅
- P-16 영문 대소문자 무관 매칭 — `toLowerCase()` 기반 ✅
  - 🔍 한글 IME 조합 중 입력 관련 이슈는 실기기 타이핑 테스트 필요

---

## 가방 보관함 (HomeScreen.tsx)

### 티어 / 잠금 (무료 동시 진행 3개 제한, 소유 가방 기준)

- B-01 무료 가방 3개 미만일 때 정상 생성 — `app/api/create-bag` ✅
- B-02 무료 가방 3개 도달 시 차단(`BAG_LIMIT_REACHED`) — `app/api/create-bag`, `AppShell.tsx` ✅
- B-03 유료 전환 후 자유 생성 — `isPremiumServer` ✅
- B-04 다운그레이드 시 최신 3개만 유지, 나머지 잠금 — `app/api/sync-lock-status` ✅
- B-05 잠긴 가방 devtools 우회 차단(소유자만 막힘, 다른 멤버는 무관) — `firestore.rules`(bags update/delete 규칙)
  - 🔍 P-05와 동일하게 실제 배포 규칙 수동 대조 필요
- B-06 휴지통 보낸 가방은 잠금 계산에서 제외 — `computeLockedBagIds`, `sync-lock-status` ✅
- B-07 복구 시 서버가 개수 제한 재검증 — `app/api/restore-bag` ✅
- B-08 공유받은(비소유) 가방은 소유자 티어와 무관하게 항상 정상 이용 — `firestore.rules`(ownerId 조건부 잠금) ✅

### 그룹 협업 / 초대코드

- B-09 초대코드로 참여 시 최대 10명 제한 — `firestore.rules`(`memberIds.size() < 10`) ✅
- B-10 이미 멤버인 사람이 같은 코드로 재참여(멱등, 에러 없음) — `joinBagByCode`(arrayUnion) ✅
- B-11 초대코드 재발급 시 옛 코드 무효화 — `app/api/regenerate-invite-code` 🔧 (버그 발견 후 수정, 위 "발견 후 수정한 이슈" 1번)
  - 🔍 재발급 → 옛 코드로 참여 시도 실패 / 새 코드로 참여 성공, 실기기 테스트 필요
- B-12 그룹원 내보내기 후 그 멤버가 옛 초대코드로 재참여 못 하는지 — B-11과 동일 로직, 실기기 확인 권장 🔍

### 검색

- B-13 가방 이름 / 가방 속 팩 이름 / 짐 텍스트 검색 — `librarySearch.ts searchBags` ✅
- B-14 검색 결과 클릭 시 가방 열리며 팩/짐까지 스크롤+하이라이트 — `onOpenBag(bag, {packId, itemId})` → `BagEditorScreen`의 `focusTarget` effect (E-44와 동일 로직) ✅
- B-15 결과 30개 초과 시 안내 문구 — `librarySearch.ts searchBags`(truncated 플래그) ✅
- B-16 잠긴 가방도 검색되고 클릭 시 읽기전용 진입 — `AppShell.tsx`의 `lockedBagIds` 계산 ✅

### 기타 UI

- B-17 핀 고정 2개 제한, 드래그 정렬, 정렬기준 변경 — `listSort.ts` ✅
- B-18 벌크 삭제 시 소유 가방=삭제 / 공유가방=나가기 구분 처리 및 안내문구 분기 — `HomeScreen.tsx`(`bulkDeleteTitle`/`bulkDeleteMessage`) ✅
- B-19 새 가방 만들기 3갈래(빈 가방/샘플/AI메모) 진입 흐름 — `NewBagOptionsSheet.tsx` 등
  - 🔍 각 경로별 실제 생성 결과는 실기기 테스트 필요

---

## 가방 속 기능들 (BagEditorScreen.tsx)

### 실시간 동기화 / 자동저장

- E-01 짐/이름/체크 등 모든 변경이 500ms 디바운스로 자동저장 ✅
- E-02 새 가방의 첫 변경은 디바운스 없이 즉시 저장(=확정), 이후 뒤로가기해도 임시가방으로 안 지워짐 ✅
- E-03 화면 이탈 시(뒤로가기 등) 디바운스 대기 중인 변경 즉시 flush ✅
- E-04 다른 멤버의 원격 변경 실시간 반영, 단 내가 디바운스 대기 중(dirty)이면 그 사이 원격변경은 무시(내 저장이 곧 최신 반영) ✅
- E-05 잠금 상태(locked)가 다른 곳에서 바뀌면 이 화면도 구독으로 즉시 반영 ✅

### 읽기전용(잠긴 가방)

- E-06 모든 mutation 핸들러가 `guardReadOnly()`로 막힘 ✅
- E-07 팩카드/짐 조작 UI(스와이프수정, 드래그핸들 등)는 readOnly를 안 받아서 시각적으로 계속 활성 상태 — 데이터는 guardReadOnly로 안전하게 막히지만, "왜 갑자기 등록 모달이 뜨지?" 하는 사용자 혼란 가능성. 팩 보관함(PackLibraryEditorScreen)도 동일 패턴이라 앱 전체의 일관된 설계 방식으로 보임 ⚠️
- E-08 상단 툴바(팩불러오기/새팩추가/뷰전환/완료숨기기/항목추가/전체접기펼치기)는 readOnly일 때 아예 숨김 ✅

### 팩뷰(PackGrid/PackCard) vs 메모장뷰(NotebookView/NotebookPackSection)

- E-09 팩뷰: 헤더 [진행률링, 개수, 넓게보기, 접기] + 하단 [새로고침, 저장, 삭제] 별도 행 ✅
- E-10 메모장뷰: 헤더 [접기(맨 왼쪽), 그립, 색점, 이름, 진행률링, "⋯"메뉴] — 새로고침/저장/삭제가 드롭다운 메뉴 안으로 통합, 하단 행 없음, "넓게보기" 개념 자체가 없음 ✅
- E-11 "⋯" 메뉴 위치가 마지막 섹션이면 위로(`bottom-full`), 아니면 아래로(`top-full`) 열림 — 화면 하단 섹션에서 메뉴가 잘리지 않는지 실기기 확인 🔍
- E-12 상단 툴바 "전체 넓게보기" 토글은 팩뷰에서만 노출, 메모장뷰엔 없음 ✅
- E-13 "완료 항목 숨기기"는 두 뷰 모두 동일하게 적용(화면표시만 필터링, 데이터 안 바뀜) ✅
- E-14 뷰 모드는 가방별 개인 설정(`profile.bagViewMode[bagId]`) — 그룹원끼리 동기화 안 됨(각자 원하는 뷰로 볼 수 있음), 없으면 전역 기본값 따름 ✅

### 팩 이름 스와이프 수정 (SwipeRenameField)

- E-15 오른쪽으로만 밀림(왼쪽 스와이프는 무시), 가로/세로 판정 임계치로 스크롤과 구분 ✅
- E-16 스와이프 직후 발생하는 마우스 합성 클릭이 다시 닫아버리는 것 방지(`justDraggedRef`) ✅
- E-17 Enter/블러 시 커밋, 빈 값이면 조용히 원래 이름 유지 — 안내문구 없음, UX 확인 필요 ⚠️
- E-18 팩뷰/메모장뷰 양쪽 다 동일 컴포넌트 재사용 확인 ✅

### 드래그 (짐 이동/순서변경, 팩 순서변경)

- E-19 짐을 다른 팩으로 드래그 시 롱프레스 중 상단에 전체 팩 칩바(PackChipBar) 노출, 화면 밖 팩으로도 스크롤 없이 드롭 가능 ✅
- E-20 같은 팩 안 순서변경 시 화면에 "보이는" 순서(완료항목 맨아래 정렬 반영) 기준으로 계산 — 실제 저장 순서와 화면표시 순서가 어긋나지 않는지 실기기 확인 🔍
- E-21 짐 드롭 위치 판정: 텍스트형은 세로(위/아래), 체크형은 가로(좌/우) 기준 — 두 타입 섞인 팩에서 혼동 없는지 실기기 확인 🔍
- E-22 팩 카드 자체 드래그로 순서변경(그립 아이콘), 커서 위치로 위/아래 삽입 판정 ✅
- E-23 팩 최대 10개 캡 — "+팩" 버튼, 팩불러오기 모달의 "새 팩 만들기", 메모장뷰 "+"의 신규팩 생성 세 경로 모두 `handleAddPack`/`handleQuickAddNewPack` 재사용으로 동일하게 막힘 ✅

### 팩 저장/새로고침/삭제

- E-24 최초 저장 시 라이브러리 이름 중복 체크 → `SaveAsDialog`로 이름변경 유도 ✅
- E-25 이미 연동된 팩 재저장 시, 캐시된 상태가 아니라 그 순간 라이브러리와 실시간 비교해서 "변경사항 없음" 정확히 판단 ✅
- E-26 다른 가방/기기가 먼저 라이브러리를 바꿔놓은 "충돌" 상황을 타임스탬프로 감지해서 덮어쓰기 전 확인(`PackUpdateDialog`) ✅
- E-27 "다시 불러오기"는 확인 다이얼로그 후 로컬 내용을 라이브러리 최신본으로 완전히 덮어씀(되돌리기 없음) — 실수로 눌렀을 때 손실 위험 UX상 확인 필요 🔍
- E-28 팩 삭제 시 "라이브러리 원본도 함께 삭제" 체크박스는 실제로 연동된 팩(`canDeleteFromLibrary`)일 때만 노출 ✅
- E-29 라이브러리 삭제만 실패했을 때(가방에서는 이미 삭제됨) 상태 불일치 가능성 — 실패 토스트만 뜨고 되돌리기 없음, 낮은 우선순위 ⚠️

### AI 정리

- E-30 짐 2개 미만이거나 빈 텍스트 항목 있으면 버튼 비활성화 + 안내 문구 ✅
- E-31 AI가 누락한 index는 서버가 "미분류" 팩으로 모아서 데이터 손실 방지 ✅
- E-32 짐 200개 초과(대형 가방)일 때 index 검증 로직 정합성 — `organize-bag`의 유효성 검사가 실제 index 값이 아니라 개수(validCount) 기준이라, 빈 텍스트 항목이 섞인 대형 가방에서 정합성이 깨질 여지 있음. 낮은 우선순위지만 대형 업무용 가방 보유 사용자 있으면 확인 필요 ⚠️
- E-33 일일 AI 할당량 공유(메모가져오기/해시태그생성/AI정리 3개 기능이 카운트 공유) — 가방 화면에서 한도 도달 시 안내 정상 노출 ✅

### 이미지/PDF 첨부 (PDF는 프리미엄 전용, 2026-07 추가)

- E-34 이미지 최대 5장, 업로드 전 1MB 이하로 자동 압축 ✅
- E-35 PDF 업로드 — 프리미엄 전용으로 전환 완료, `storage.rules`가 요청자의 프리미엄 여부를 실시간 검사(최대 3MB) 🔧
  - 🔍 실제 배포 후: 무료회원이 PDF 선택 시 업로드 안 되고 업셀 모달 뜨는지 / 유료회원은 정상 업로드되는지 실기기 확인 필요
- E-36 PDF 미리보기 — `PdfPreviewModal`(iframe 인앱 뷰어), 무료회원 클릭 시 업셀 모달, 유료회원 클릭 시 미리보기 열림 🔧
  - 🔍 iOS WKWebView / Android WebView에서 iframe PDF 렌더링이 정상 동작하는지 — N-06 참고
- E-37 PDF 썸네일에 잠금 배지 — 무료회원에게만 우측하단 자물쇠 아이콘 노출 ✅
- E-38 유료→무료 다운그레이드 후 기존에 첨부해둔 PDF — 별도 잠금 동기화 없이 다음 열람 시도부터 즉시 차단(실시간 규칙 평가라 sync-lock-status 불필요) ✅
- E-39 이미지 삭제 확인 다이얼로그, 삭제 시 Storage에서도 실제 제거 ✅
- E-40 라이트박스로 이미지 확대보기, 여러장 좌우 넘기기 ✅

### 그룹원 관리

- E-41 그룹원 목록/왕관 아이콘(소유자 표시)/나(current) 표시 ✅
- E-42 초대코드 재발급 → 실제로 무효화됨(위 "발견 후 수정한 이슈" 1번) ✅🔧
- E-43 소유자만 멤버 내보내기 가능, 마지막 남은 소유자는 나가기 대신 삭제 유도 문구 ✅
- E-44 검색 결과로 들어왔을 때(focusTarget) 접힌 팩 자동 펼치고 스크롤+하이라이트 ✅

---

## 네이티브(Capacitor) 배포 전 필수 확인

지금은 Mac(웹)/iPhone·iPad(PWA)/Android(PWA) 전부 같은 웹 코드가 브라우저에서 돌아가는
상태다. Capacitor로 감싼 실제 네이티브 앱(특히 iOS, 나중엔 Android)은 아직 한 번도 Xcode로
빌드/실기기 테스트된 적이 없어서, 아래 항목들은 그 첫 빌드 때 반드시 확인해야 한다
(`capacitor.config.ts`의 `server.url`이 아직 placeholder인 것도 확인).

- N-01 구글 로그인(`signInWithPopup`) — WKWebView는 정책상 임베디드 웹뷰 OAuth를 막을
  가능성이 높음(이미 알려진 미해결 블로커). 재현되면 네이티브 구글 로그인 플러그인으로 교체 필요
- N-02 이메일 로그인/회원가입/이메일 인증 전체 흐름 — 위 A-01~A-19 전부 네이티브 앱에서도
  동일하게 매끄러운지(특히 A-06 깜빡임 방지가 WKWebView에서도 타이밍이 다르지 않은지)
- N-03 파일 선택(`<input type="file" accept="image/*,application/pdf,.pdf" multiple>`) —
  사진첩/파일 앱이 정상적으로 뜨는지, 여러 장 선택이 되는지
- N-04 짐/팩 드래그 앤 드롭(pointer 이벤트 기반) — 터치로 롱프레스 후 드래그가 매끄러운지,
  스크롤과 충돌하지 않는지
- N-05 초대 링크 복사(`navigator.clipboard.writeText`) — Capacitor 웹뷰에서 클립보드 API가
  정상 동작하는지
- N-06 PDF 인앱 미리보기(iframe, `PdfPreviewModal`) — iOS WKWebView는 될 가능성이 높지만
  미검증. **Android는 Capacitor로 감쌀 때(현재는 미착수) WebView 컴포넌트가 Chrome 앱과
  달리 PDF 내장 뷰어가 없을 수 있어 특히 위험 — 빈 화면/다운로드 프롬프트로 뜰 가능성 확인**
- N-07 "새 탭에서 열기" 버튼(`window.open(url, "_blank")`, `PdfPreviewModal`) — Capacitor
  앱은 웹뷰 하나로만 구성돼서 "새 탭" 개념이 없음. 아무 반응 없거나 앱이 그 URL로
  네비게이트해버릴 수 있음 → 문제 확인되면 `@capacitor/browser`(`Browser.open()`)로 교체
  (아직 패키지 미설치 — `package.json`에 없음, 이 시점에 함께 추가)
- N-08 .ics 캘린더 다운로드(계획 중인 기능, 아직 미구현) — 네이티브 빌드 시 별도 확인 필요
- N-09 이미지 압축(`compressImageFile`, Canvas 기반) — WKWebView/Android WebView의 Canvas
  API 성능/정확도가 데스크톱 브라우저와 다를 수 있음
- N-10 Firebase Storage 업로드/다운로드 네트워크 요청 — Capacitor 앱이 `firebasestorage.googleapis.com`,
  `generativelanguage.googleapis.com` 등 외부 도메인 요청을 문제없이 보내는지

---

## 문의하기 / 알림종 (SettingsScreen 내 신규 기능, 2026-07 추가)

설정 화면 자체는 별도 체크리스트로 관리하지 않기로 했지만(appflo 요청, 필요할 때 추가 요청),
문의하기 게시판 + 알림종은 신규 기능이라 따로 추적한다.

- I-01 문의 작성(카테고리 선택 + 제목 + 내용) 정상 등록 — `InquiryComposeModal.tsx`, `createInquiryRemote` ✅
- I-02 내 문의 목록(본인 글만) + 미답변 필터 — `InquiryScreen.tsx`, `subscribeToMyInquiries` ✅
- I-03 문의 상세에서 답변 확인(답변 전이면 "아직 답변 없음" 안내) ✅
- I-04 관리자 전체 문의 목록 + 미답변 필터 — `InquiryAdminScreen.tsx`, `subscribeToAllInquiries` ✅
  - 🔍 마스터 계정으로 실제 로그인해서 설정 > 문의 관리 진입점이 보이는지, 일반 계정은 안 보이는지 실기기 확인 필요
- I-05 관리자 답변 등록 → status "answered" 전환 + 작성자에게 알림 자동 생성(배치 처리) — `answerInquiryRemote` ✅
  - 🔍 둘 중 하나만 성공하는 경우가 없는지(배치 원자성) 실기기 확인 권장
- I-06 firestore.rules — 본인 글만 read, 관리자만 전체 read+답변 write, 질문 내용(title/content) 자체는 답변 등록 시에도 위조 불가(status/answer/answeredAt 세 필드만 허용)
  - 🔍 **로컬 파일과 Firebase 콘솔에 실제 배포된 규칙이 일치하는지 수동 대조 필요**(이번에도 새로 추가된 inquiries/notifications 규칙 반영 안 하면 작동 안 함)
- I-07 알림종 배지(읽지 않은 건 있으면 작은 반짝 점), 클릭 시 패널, 개별/전체 읽음처리 — `NotificationBell.tsx` ✅
- I-08 알림종 위치 (2026-07-12 재설계): 처음에 AppShell 고정 오버레이로 만들었다가
  헤더 아이콘 충돌(설정 아이콘을 가림)이 발견되어, PacksScreen/HomeScreen/SettingsScreen 각자의
  헤더 아이콘 줄 안에 들어가는 인라인 버튼으로 재설계(위 "발견 후 수정한 이슈" 6번). **가방 편집
  화면은 여전히 제외**(헤더에 NotificationBell을 따로 넣지 않음) ✅🔧
- I-09 설정 화면 개편: 휴지통 아이콘 제거 + AI기능 아래·고객지원 위 독립 메뉴칸으로 이동 ✅
- I-10 가방 편집 화면 뒤로가기↔물음표 간격 4px→24px로 확대(터치영역 겹침 방지) — `BagEditorScreen.tsx` ✅
- I-11 (2026-07-19) HomeScreen/PacksScreen 헤더의 설정 아이콘 삭제(이미 하단탭 설정 탭과 중복이었음) — 알림종(NotificationBell)은 그대로 남아있으니 이슈 6번의 위치 충돌(설정 아이콘 가림) 자체가 이제 무의미해짐
  - 🔍 실기기에서 두 화면 헤더가 자연스럽게 보이는지(아이콘 간격), 하단탭 설정으로 진입이 잘 되는지 확인 필요

