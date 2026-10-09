# 팩인백 기능 스펙 문서 (리디자인 v2)

앱은 v2 화면만 있다. 2026-10-05에 구 UI(v1) 소스와 `NEXT_PUBLIC_UI_V2` 플래그를 전부 지웠다(v1.0.20). 아래 표의 "플래그를 끄면 구 UI"·"구 UI는 그대로" 같은 말은 그 전 기록이다. 기준 문서: 프로젝트 `UIUX_리디자인_방향.md`, `리디자인_작업계획.md`.

## 10/9 보안 점검 2차

| 기능 | 상태 | 비고 |
|---|---|---|
| **마스터 판정** | 🔒 보안 | 인증한 이메일만 마스터 판정에 씀(`verifyRequestUser`·`aiQuotaServer`·`bagLockSync`·`join-bag`). 예전에는 마스터 이메일로 가입만 하고 인증하지 않아도 관리자가 됐다. 환경변수는 `NEXT_PUBLIC_MASTER_EMAILS` → 서버 전용 `MASTER_EMAILS`(브라우저에서는 항상 false, 화면은 `role === "master"`) |
| **빠른팩 표시로 한도 우회** | 🔒 보안 | 빠른팩은 문서 id `quick-pack`으로만 판단(서버·화면 잠금 계산 모두). 규칙: libraryPacks의 `isQuickPack` 변경 불가 |
| **보관함 팩 덮어쓰기** | 🔒 보안 | create-library-pack·trash-bag-pack·import-shared-pack이 서버 전용 필드(locked·trashedAt·isQuickPack 등)를 버림(`stripServerOnlyPackFields`). 같은 id가 있으면 create-library-pack은 합치기(잠긴 팩은 403), trash-bag-pack은 새 id |
| **보관함 복구** | 🔒 보안 | 무료면 복구 후 잠금 재계산(`syncLibraryPackLocks`, sync-lock-status와 공유) |
| **커스텀 URL** | 🔒 보안 | 서버에서 프리미엄 확인, `create()`로 동시 생성 덮어쓰기 방지 |
| **짧은 URL 한도** | 🔒 보안 | 하루 10개를 트랜잭션 예약으로(동시 요청·조회 실패 통과 없음), 실패하면 되돌림. 주소 2048자까지, 코드에 `/` 들어오면 400 |
| **게스트 제한** | 🔄 변경 | 게스트(익명 로그인)는 AI·짧은/커스텀 URL 생성 불가(계정마다 한도가 있어 게스트를 새로 만들면 초기화됐다). AI는 401 + "로그인하면 쓸 수 있어요", URL은 403 |
| **AI 프리미엄 판정·상한** | 🐛 수정 | 인앱결제 구매자도 AI 프리미엄(예전에는 무료 취급). 프리미엄도 하루 50회(`AI_PREMIUM_DAILY_CAP`, aiUsage `premiumCount`), 마스터는 제한 없음. 라우트는 성공하면 항상 `consumeAiQuota` |
| **AI 입력 상한** | 🔒 보안 | ai-audit-bag(제한 없었음)·날씨·클립보드·가방 정리 길이·개수 제한 |
| **이용권** | 🔒 보안 | 틀린 코드 하루 10회(`unlockRedeemUsage`), 코드 생성은 암호학적 난수 |
| **RevenueCat** | 🔒 보안 | 웹훅 헤더 시간 일정 비교. TRANSFER(구매 복원으로 다른 계정에 옮겨짐) 처리: 받는 계정 프리미엄, 내준 계정 해제(예전에는 무시) |
| **ai-travel-places** | 🗑️ 제거 | 부르는 곳 없음(10/6에 클라이언트만 지웠고 라우트가 남아 있었다) |
| **이상 없음** | ℹ️ | link-meta는 외부 주소를 열지 않음(SSRF 아님), admin/* 전부 `requireMasterUser`, geocode·restore-bag |

## 10/7 ~ 10/8 (v1.0.25 ~ v1.0.28)

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방 메모 본문 분리 (10/8, v1.0.28)** | 🔄 변경 | 가방 안 메모팩 본문(editorDoc)을 가방 문서가 아니라 `bags/{bagId}/notes/{packId}` = `{ doc(JSON 문자열), rev, updatedAt, updatedBy }`에 저장. 가방 문서 팩에는 이름·`editorPreviewText`·`searchText`(앞 2,000자, 홈 검색)·`attachmentUrls`(Storage 정리)·`noteSeparated`만. 체크 하나에 메모 본문까지 멤버 전원에게 다시 보내던 문제 해소. 기존 31개 가방 메모 40개 이전 완료(`scripts/migrate-bag-notes.mjs`, 여러 번 실행해도 안전) |
| ↳ 구조 | ℹ️ 규칙 | 순수 함수 `lib/bagNotesCore.ts`(분리·합치기·요약, 서버 공용), Firestore `lib/bagNotesService.ts`. 열린 가방(`useBagDocument`)만 notes를 구독해 본문을 채운다(hydrateBag). 저장(`saveBagRemote`·`saveSharedBagMergedRemote`)이 본문을 떼어 바뀐 것만 notes에 쓴다. **가방 문서의 packs를 직접 쓰는 새 코드는 반드시 본문을 떼고(`splitBagForSave`/`splitPacksPlain`) `packsRev`를 1 올린다** - 안 그러면 규칙에 막힘. 가방 완전삭제는 notes를 먼저 지운다(`deleteAllBagNotes`). 팩 이동은 notes도 같이 옮긴다. 오프라인 모드·만들기 대기 가방은 본문을 가방 안에 그대로 둔다 |
| ↳ 본문 도착 전 보호 | ℹ️ 규칙 | `BagDocument.notesReady`가 false인 동안 메모 편집기를 열지 않고(불러오는 중 화면), 메모 휴지통·보관함 저장·덮어쓰기·보관함 자동 동기화를 하지 않는다(빈 본문으로 덮어쓰기 방지). 목록 소식은 본문을 바꾸지 않고 notes 소식일 때만 바꾼다(저장 직후 글이 되돌아가는 것 방지) |
| ↳ 규칙 | 🔒 보안 | notes는 가방 멤버만, 잠긴 가방 그룹장은 쓰기 불가, doc 1MB 미만. `notesV: 2` 가방은 packs를 바꿀 때 `packsRev`가 정확히 +1이어야 하고 notesV는 낮출 수 없다 → 새로고침 안 한 옛 탭·업데이트 안 한 포터블은 저장이 거부됨(데이터 보호, 새로고침하면 풀림) |
| **보안 점검 (10/7, v1.0.26)** | 🔒 보안 | 초대코드 위조 차단(inviteCodes create false + join-bag 코드 일치), create-bag 덮어쓰기 차단(트랜잭션 create), share-pack 토큰 바꿔치기 차단(출처 기록), `/v` 초대코드 노출 제거, 이용권 판정을 `claimedBy` 본인 코드만(`lib/unlockCodeCheck.ts`, storage.rules 동일), users의 unlockCode 클라이언트 쓰기 차단, 멤버 내보내기·가방 삭제는 그룹장만, 잠긴 팩 수정 불가·`locked` 클라이언트 변경 불가, 자동저장은 내용 필드만 `updateDoc` |
| **Storage 정리 (10/7)** | 🐛 수정 | `lib/storageCleanup.ts`: 가방·팩 완전삭제, 30일 자동삭제, 탈퇴, 메모 편집기를 닫을 때(본문에서 지운 첨부) 다른 곳이 쓰지 않는 파일만 지움. 공유 가방 메모 첨부는 남김. storage.rules 삭제는 프리미엄 무관, 구매자(premiumPurchase)도 프리미엄으로 인정. 업로드 cacheControl 1년 |
| **비용 절감 (10/7)** | 🔄 변경 | 접속 표시 60초 + 3분 자리 비움 정지, 알림 구독·버전 폴링 한 벌 공유, 관리자 대시보드 Firestore 캐시 1시간, `/v` 60초·`/p` 5분 캐시(공유 갱신 시 비움), 운영 Firestore 로그 error만 |
| **잠김 자동 맞추기 (10/7)** | 🐛 수정 | 화면 계산과 서버 `locked`가 다르면 sync-lock-status 호출(추가 읽기 없음). 무료 팩 10개 초과분은 읽기 전용 |
| **코드 정리 (10/8)** | 🗑️ 제거 | knip으로 안 쓰는 export·코드 정리(`knip.json`), `app/api/generate-sample` 삭제, " 2" iCloud 사본 파일 제거, sw.js 캐시 없을 때 Response.error() |
| **백업 스크립트 (10/8)** | 🆕 신규 | `node scripts/backup-firestore.mjs` → `backups/`(gitignore). .env.local 서버 키로 전체 읽기만. 큰 데이터 변경 전에 실행 |

## 10/3 후반 ~ 10/5 (v1.0.16 ~ v1.0.21)

| 기능 | 상태 | 비고 |
|---|---|---|
| **구 UI(v1) 소스 삭제 (10/5, v1.0.20)** | 🗑️ 제거 | 구 화면·모달·카드 약 150개 파일 삭제(`components/screens/*` 중 메모 편집기 외 전부, `components/auth`, `components/guide`, `/guide` 페이지, DesktopShell·DesktopSidebar, 댓글·리액션·멘션 서비스, lib/helpTutorial 등). `lib/v2/flags.ts`와 모든 `UI_V2` 분기 제거, 포터블 워크플로 env에서도 빠짐. `.pib-v2-legacy`(메모 편집기·관리자)·`.pib-v2-guest`(게스트 보기)는 아직 쓰는 곳이 있어 항상 붙도록 바꿈. Pretendard `preload: true`. 안 쓰는 export 89개는 남아 있음(knip) |
| ↳ AppShell | 🔄 변경 | 칸반 가방 만들기·시작 화면 설정(startPage, `pib_last_viewed`)·오늘 마감 팝업·구 탭 스와이프(마우스 포함)·구 오버레이 4개 삭제. `TabKey`는 `lib/v2/shell.ts`로, 메모로 만든 가방 결과 타입은 `ImportedBagResult`(lib/types), `BagOpenFocus`는 HomeScreenV2로 옮김. 연결 상태 줄은 `ConnectionBar` 직접(구 OfflineStatusBar 삭제) |
| ↳ 메모 편집기 | 🔄 변경 | `PackNoteEditorScreen`의 구 화면(구 툴바·색 팝오버·링크 모달·window.prompt 링크·옛 첨부 함수) 삭제. 다른 기기 변경은 항상 문단 단위로 합침(배너로 보류하는 구 방식 없음) |
| ↳ 로그인·계정 | 🔄 변경 | 세션 없음 + 끊김은 항상 `recheckConnectivity`로 판단(구 navigator.onLine·Electron 전용 확인 삭제). 오프라인 모드 → 로그인은 항상 새로고침 없이. 탈퇴는 항상 본인 확인 먼저. 가방 고정 항상 5개. 가방 참여의 무료 2명 제한은 항상 적용 |
| **버전 표기 자동 (10/5, v1.0.21)** | 🐛 수정 | `lib/changelog.ts`의 `APP_VERSION`이 1.0.0에 멈춰 있던 문제. 이제 `package.json`의 version을 직접 읽는다(`npm version`만 올리면 설정 > 버전 정보도 바뀜). 업데이트 노트 1.0.20 항목 추가 |
| **오프라인 데이터 합치기 시트 (10/5)** | 🔄 변경 | `OfflineImportSheet mode="merge"`(로그인 직후 자동 1회): 제목 "이 기기의 가방·팩 옮기기", "오프라인으로 쓰던 가방 N개 · 팩 M개를 계정으로 옮길게요", "나중에 하기". 무료면 개수 안내 한 줄. 설정 > 데이터에서 여는 시트는 예전 문구(mode "settings") |
| **오프라인 데이터 가져오기 무료 초과·중복 (10/5)** | 🐛 수정 | 예전: 중간에 무료 개수 초과(PremiumLimitError)로 실패하면 이미 올라간 것까지 "안 가져옴"으로 남아 다시 하면 중복 생성. 지금: `importOfflineDataToOnline`이 하나 올릴 때마다 기록하고, 초과하면 그 자리에서 멈춰 `blockedMessage`·`skippedCount`를 돌려줌 → 시트가 "N개를 옮겼어요. M개는 이 기기에 남겨 두었어요" + 프리미엄 시트(onLimit) |
| **"올리기 대기" 표시 (10/5)** | 🆕 신규 | 끊긴 동안 만든 가방·팩(`lib/v2/pendingCreates`)에 홈 목록·캐러셀 카드·팩 탭 줄마다 "올리기 대기" 배지. `BagSummary.pending`(`summarizeBag` 세 번째 인자). 연결되어 올라가면 사라짐. 서버 호출 없음 |
| **넓은 화면: 설정 하위 화면을 상세 칸에 (10/5)** | 🔄 변경 | 예전에는 프로필·휴지통 등이 화면 전체 위에 겹쳐 떴음. WideShell이 상세 칸 안 자리를 `DetailPaneContext`(lib/v2/openDetail.ts)로 설정 탭 목록에만 넘기고, `SlideScreen`은 이 값이 있으면 그 칸에 absolute로 그린다(바탕은 어둡게 깔지 않고 canvas색) |
| **넓은 화면: 열린 가방·팩 강조 (10/5)** | 🆕 신규 | 상세 칸에 열린 가방(팩이 열려 있으면 그 팩)의 목록 줄을 둥근 바탕(bg-fill)으로, `aria-current`. `OpenDetailContext`를 AppShell이 넓은 화면 목록에만 넘김(좁은 화면은 없음) |
| **넓은 화면: 빈 새 가방 정리 (10/5)** | 🐛 수정 | 만들기만 하고 손대지 않은 새 가방(isNewBag)을 둔 채 다른 가방을 고르거나 새 가방을 또 만들면 빈 가방이 남던 문제. 이제 모바일 뒤로가기와 같이 지운다(첫 변경이 저장되면 isNewBag이 꺼져 대상이 아님) |
| **가방 폴더 점 경로 쓰기 (10/5)** | 🐛 수정 | `deleteBagFolder`·`moveBagFolder`·`flattenBagFolders`가 화면의 예전 profile 기준으로 `bagFolders.{id}.필드`를 쓰면, 다른 기기에서 지운 폴더가 "이름 없는 폴더"로 되살아남. 이제 계정 모드는 `writeBagFolderPatch` 트랜잭션(읽기 1)으로 서버 최신본을 보고 폴더가 있을 때만 쓴다. 오프라인 모드·끊김(unavailable)은 예전처럼 writeUser |
| **연결 흐름 (10/4, v1.0.18)** | 🆕 신규 | A 연결 판단 `lib/v2/connectivity.ts`(unknown/online/offline, 끊김 5초·연결 30초 재확인, 탭 숨김 시 중지, 복구 시 enableNetwork + `pib:reconnected`) · F 상태 줄 `ConnectionBar` · D 미리 막기 `useOnlineGuard`(AI·메모로 가방·참여·공유·첨부·계정 연동·이용권·내 URL·공지·문의·비밀번호·탈퇴) · B 시작(세션 없음 + 끊김 → 바로 오프라인 모드) · C 만들기 대기 `lib/v2/pendingCreates.ts`(계정별 localStorage, 재연결 시 같은 id로 생성, 무료 초과는 남기고 안내) · E 합치기(새로고침 없이 계정 전환 + 합치기 시트 1회, 설정 "오프라인 보관함 보기" 제거) |
| **로그인·계정·모달 점검 (10/4, v1.0.17)** | 🐛 수정 | 오프라인 모드는 users 문서를 구독하지 않음(폐쇄망에서 닉네임 화면으로 돌아가던 문제), users 쓰기 39곳을 `writeUser`로 통일(오프라인이면 로컬 프로필). 탈퇴는 본인 확인(이메일=비밀번호, 소셜=4분 지났으면 재로그인) → 데이터 삭제 → 계정 삭제. 포터블은 Google·Apple 버튼 숨김(`isElectronApp`). 로그인 화면은 연결 확인 중 로고만. 오류 문구 `lib/authErrorMessage`. PDF 크게 보기 `components/v2/bag/PdfViewer.tsx`, 게스트 보기 alert → 화면 안내. 앱에 브라우저 alert·confirm·prompt 없음 |
| **떠 있는 탭바(독) (10/4, v1.0.16)** | 🔄 변경 | `TabBarV2`: [팩 · 가방 · 설정] 반투명 캡슐(블러) + 오른쪽 빠른팩 검은 동그라미 +. 지금 탭은 옅은 알약이 미끄러짐. 높이를 재서 `--pib-dock`에 기록 → `ScreenBody`가 아래 여백(숫자로 박지 않음). 탭바를 끌어도 탭이 안 넘어감, 옆 빈 곳은 터치 통과, 터치 기기 입력 중 숨김, 토스트는 `toast-lift`. 투명도 줄이기면 불투명 |
| **앱 글꼴 선택 (10/4, v1.0.16)** | 🆕 신규 | 설정 > 화면 > 글꼴(`FontSheet`, `lib/v2/appFonts.ts`): 기본(Pretendard) · 지마켓 산스 · 개구 · D2코딩. 메모 본문까지, 메모 코드는 항상 D2코딩. next/font/local 셀프 호스팅(preload false), size-adjust·ascent·descent 보정. 저장 `UserProfile.fontFamily` + localStorage, head 스크립트로 첫 화면 깜빡임 방지. 글꼴 파일 7개는 `app/fonts`에 커밋됨 |
| **넓은 화면 셸 통합 (10/3)** | 🔄 변경 | `components/v2/shell/WideShell.tsx` + `lib/v2/shell.ts`. 900px 미만 모바일 / 900px 이상 [목록 \| 상세](목록 아래 탭바) / 1200px 이상 [레일 \| 목록 \| 상세]. 상세 칸에는 하나만(팩·메모 > 가방). 시트는 1024px 이상 가운데 창. 단축키 ⌘/Ctrl + N 새로 만들기 · K 검색 · I 설정 · P 빠른팩 · Esc 상세 닫기 |
| **구 UI 남은 화면 v2화 (10/3)** | 🔄 변경 | 설정 하위 10개(프로필·버전·라이선스·휴지통·문의는 `SubScreen`, 공지·FAQ·내가 만든 URL·오프라인 가져오기·계정 전환은 시트), 사진 크게 보기 `PhotoViewer`, 처리 중 화면 `BusyOverlay`, 로그인 `AuthScreenV2`·`ProfileSetupV2` |
| **관리자 사이트 (10/3)** | 🔄 변경 | 대시보드 개편(`lib/adminStats.ts`, 할 일·핵심 숫자·추이·처음 쓰는 흐름·기능 사용률·결제로 이어지는 곳, 스냅샷 kpis, 5분 캐시), 공통 틀 `AdminPage`, 문의 2단·이용권·공지 시트 편집·활동 로그. 유저 조회 "마지막 AI 사용(날짜 · 횟수)" |

## 10/3 전반까지

| 기능 | 상태 | 비고 |
|---|---|---|
| **구 UI 남은 화면 리스킨 1차 (10/3)** | 🔄 v2 변경 | 구조까지 v2로(색만 바꾼 `.pib-v2-legacy` 의존 제거). ① 빠른팩 입력: `QuickAddModal` → `components/v2/sheets/QuickAddSheet.tsx`(체크/글 세그먼트, 하단 입력창, 방금 넣은 것, "빠른팩 열기 N개") ② 하단 탭바: `BottomTabBar` → `components/v2/shell/TabBarV2.tsx`(알약 없음, 지금 탭만 진한 글자, 빠른팩은 검은 동그라미 +, `pb-safe-2` 유틸 추가) ③ 시작 공지: `InitialGuideCarouselModal` → `AnnouncementSheet.tsx`(하나씩, 다시 보지 않기/확인) ④ 알림: `NotificationBell v2` → `NotificationsSheet.tsx`(점 표시, NEW 글자 대신 브랜드색 점) ⑤ AI: `NoteImportModal`·`AiClipboardModal` → `AiPasteSheets.tsx`(붙여넣기 버튼, 분석 중 닫기 막음), `AiBagAuditModal` → `bag/sheets/AuditSheet.tsx` "빠진 것 확인". API·결과 형태 그대로. 데스크톱 셸은 아직 구 UI. QA QK·TB·AN·NT·AI |
| **빠진 것 확인 중복 호출 (10/3)** | 🐛 v2 수정 | 구 모달은 `useEffect([bag])`라 "담기"·체크로 가방이 바뀔 때마다 AI를 다시 불러 하루 횟수를 더 썼다. v2 시트는 열 때 가방을 찍어 두고 한 번만. 구 UI(플래그 끔)는 그대로 |
| **메모 마크다운 붙여넣기 (10/3)** | 🆕 v2 신규 | `lib/noteEditorMarkdownPaste.ts`(TipTap 확장, `getNoteEditorExtensions`에 등록 → 구 UI 메모에도 적용). 붙여넣는 글이 마크다운처럼 보일 때만(표, # 제목, ``` 코드, - [ ] 체크, **굵게**, [글](링크), 목록 2줄 이상) 서식으로 변환: 표(가운데·오른쪽 정렬) · 제목1~3(####부터 제목3) · 글머리/번호/체크 목록 · 코드 블록 · 구분선 · 굵게/기울임/취소선/코드/링크. 클립보드에 서식 있는 HTML이 같이 오면(웹페이지·메모앱) 기본 붙여넣기. 코드 블록·표 안에서는 변환 안 함. 인용(>)은 토글 블록과 겹쳐 문단으로. 중첩 목록은 펼쳐서 한 단계로. 서버 호출 없음 |
| **메모 본문 네모 테두리 제거 (10/3)** | 🐛 v2 수정 | v2 포커스 표시 규칙(`.pib-v2 *:focus-visible`, 브랜드색 2px)이 메모 본문의 `outline:none`을 덮어 쓰는 동안 본문 전체에 테두리가 보였음. 입력칸·textarea·메모 본문은 포커스 테두리 없음(`app/globals.css`). 버튼 등 키보드 포커스 표시는 그대로 |
| **끌어서 순서 바꾸기 (10/3, `components/v2/ui/ReorderSheet.tsx`)** | 🆕 v2 신규 | 전체 목록 + 줄마다 오른쪽 ≡ 손잡이를 잡고 끌기(한 칸 지날 때 햅틱), "완료"에만 저장(쓰기 1회), X·바깥은 버림. ① 폴더 칩: 칩 길게 누르기 > 폴더 순서 바꾸기(`bagFolderOrder`, 이전 ◀ ▶ 대체) ② 가방: "최근순 ▾" 시트 > 가방 순서 바꾸기, 지금 폴더 안만(`bagOrderByParent[폴더 id\|root]`, 저장하면 정렬 "직접 정한 순서"=custom, 전체는 구 UI `bagOrder`도 이어받음) ③ 팩 탭: 항목 길게 누르기 > 순서 바꾸기, 지금 폴더 안 폴더 / 팩·메모 묶음별(`packOrderByParent`, packSortBy custom). 고정 항목은 목록에서 빠짐. 오프라인은 숨김 |
| **폴더 순서가 저장 후 안 바뀌던 문제 (10/3)** | 🐛 v2 수정 | `AuthProvider`가 users 문서에서 필드를 골라 프로필을 만드는데 `bagFolderOrder`가 빠져 있었음. **새 프로필 필드를 만들면 반드시 여기에도 추가** |
| **다 챙긴 아이템은 아래로 (10/3)** | 🔄 v2 변경 | 설정 > 가방 토글. 구 UI 팩 설정과 같은 `packSettings.moveCompletedToBottom`(없으면 켜짐). 가방 화면 표시 순서만(`getDisplayOrderedItems`), 저장 순서는 그대로. 오프라인은 숨김 |
| **템플릿 공유 등록 모니터링 (10/3)** | 🗑️ 제거 | 설정 v2 > 관리자 메뉴 제거. 소스 파일 삭제는 남은 참조 확인 후 |
| **화면 켜두기 (10/3, 구 "집중 패킹 모드" 대체)** | 🔄 v2 변경 | 별도 전체화면(`PackingModeModal`) 대신 가방 화면 자체에서. 더보기 > "챙길 때" > 화면 켜두기 토글. 켜 두면 가방 화면이 열려 있는 동안 Screen Wake Lock(앱이 뒤로 갔다 오면 다시 요청), 닫으면 풀림. 이 기기에 기억(localStorage `packinbag:v2KeepScreenOn`, 서버 호출 없음). 켜져 있으면 상단에 해 아이콘(잡고 있으면 브랜드색, 못 잡으면 흐림), 누르면 바로 끔. 지원 안 하는 환경은 토스트 안내. `lib/v2/keepAwake.ts`. iOS 앱 웹뷰에서 안 되면 Xcode 단계에서 `@capacitor-community/keep-awake`로 보강. 구 모드의 폭죽·효과음은 없음(다 쌌을 때 햅틱으로 대체), "남은 아이템만"은 기존 "남은 것" 칩 |
| **"내 담당" 필터 칩 (10/3)** | 🆕 v2 신규 | 구 집중 패킹 모드의 "내 아이템만". 함께 쓰는 가방에서 나한테 맡긴 체크 아이템이 있을 때만 "남은 것" 옆에 표시(숫자 = 내 담당 중 안 챙긴 것). 고르면 내 담당 아이템이 있는 팩과 그 아이템만. 다시 누르면 전체 |
| **가방 속 팩에 바로 추가 (10/3)** | 🔄 v2 변경 | 하단 입력창 왼쪽에 "넣을 곳" 칩(`미분류 ▾` / `팩이름 ▾`, 고른 팩이면 브랜드색). 칩을 누르면 "어디에 넣을까요?" 시트(미분류 + 체크리스트 팩). 팩 머리 오른쪽 `+` = 그 팩을 대상으로 고르고 입력창에 바로 포커스(키보드). 위쪽 필터 칩에서 팩 하나를 고르면 대상도 그 팩(미분류 칩이면 미분류). 대상은 바꿀 때까지 유지(연속 입력), 화면을 다시 열면 미분류, 고른 팩이 지워지면 미분류. 팩에 넣으면 그 팩을 펼치고 마지막 아이템까지 스크롤. `+`는 미분류·잠긴 가방·여러 개 선택 중에는 숨김. 저장은 기존 `useBagItems.addItem`(서버 호출 추가 없음) |
| **손가락을 따라오는 스와이프 (10/3)** | 🔄 v2 변경 | 공용 훅 `lib/useHorizontalSwipe.ts`(터치 전용, 10px 움직이면 가로/세로 판정, 가로면 세로 스크롤 막음). 안쪽 요소가 먼저 가져가면 바깥은 물러남. 입력칸·메모 본문에서 시작하면 무시(화면 왼쪽 끝 24px는 허용). 가로 스크롤 영역(칩·캐러셀·가방 목록)은 그 방향으로 더 넘어갈 수 있으면 양보, 끝이면 이어서 바깥 제스처. 끝까지 넘김 기준: 30% 이상 끌기 또는 0.35px/ms 이상 튕기기, 남은 거리는 손 뗀 속도에 맞춘 시간으로. 끌기 직후 click은 막음. PC 마우스 끌기 탭 전환은 v2에서 없음 |
| ↳ 탭 넘기기 | 🔄 v2 변경 | AppShell(모바일): 팩·가방·설정 트랙이 손가락을 실시간으로 따라옴. 첫·마지막 탭은 고무줄(25%). 구 UI는 예전 방식(손 뗀 뒤 전환, 마우스 포함) 그대로 |
| ↳ 탭 안 드릴다운 (`components/v2/ui/PageStack.tsx`) | 🆕 v2 신규 | 팩 폴더, 가방 → 보관함. 들어갈 때 오른쪽에서 밀려 들어오고 아래 화면은 30% 물러남. 오른쪽으로 밀면 위 화면이 따라 밀려나고 상위 화면이 드러남. 바로 아래 화면은 계속 그려 두어(숨김) 돌아와도 스크롤 유지. 검색 중에는 밀어서 나가기 없음. 왼쪽으로 밀면 탭 넘기기 |
| ↳ 겹친 화면 뒤로가기 (`SlideScreen swipeBack`) | 🔄 v2 변경 | 가방 화면, 메모 편집기(팩 탭·가방 안), 설정 하위 화면(프로필·버전·라이선스·휴지통·문의). 화면 어디서나 오른쪽으로 밀면 따라 밀려나고 뒷 어둠도 걷힘. 닫는 함수는 안쪽 화면이 `useSwipeBack`으로 등록한 것(`lib/swipeBackRegistry.ts`) → `onSwipeBack` → `onBackdropClick`. 등록한 화면은 예전 엣지 리스너를 달지 않음(중복 닫힘 방지). 가방 화면은 여러 개 선택 중·메모 편집 중 밀어서 닫기 없음. 뒤로가기가 막히면 제자리로 복구. PC fade 전환 화면은 대상 아님 |
| **홈 가방 목록 페이징 (10/3, `BagListPager.tsx`)** | 🔄 v2 변경 | "가방" 목록은 고정한 가방만 빼고 전부(캐러셀에 나온 가방도 포함, 예전엔 캐러셀 가방을 빼서 3개만 보이기도 했음). 5개씩 한 장, 가로 scroll-snap(한 번에 한 장). 점 7개까지, 그 이상은 "3 / 12". 폴더·정렬 바꾸면 첫 장. 제목 줄에 개수("가방 12") |
| **가방 폴더 칩 순서 (10/3)** | 🆕 v2 신규 | 칩 길게 누르기 → 폴더 시트 "순서 ◀ ▶"(N개 중 M번째). 누를 때마다 바로 저장(쓰기 1회, 시트 뒤 칩이 같이 움직임). 새 필드 `UserProfile.bagFolderOrder`(폴더 id 배열), `lib/bagFolderOrder.ts`. 순서를 한 번도 안 바꿨으면 이름순, 목록에 없는 폴더(새 폴더)는 뒤에 이름순. 기존 폴더를 열 때는 키보드 자동으로 안 뜨게(순서 버튼 가림 방지). 오프라인은 순서 줄 숨김 |
| **홈 v2 (`components/v2/home/HomeScreenV2.tsx`)** | 🆕 v2 신규 | 구 `HomeScreen`과 같은 props. AppShell(모바일)에서 `UI_V2 ? HomeScreenV2 : LegacyHomeScreen`. 데스크톱(DesktopShell/DesktopSidebar)은 셸 통합 단계에서 교체 |
| **홈 구성** | 🆕 v2 신규 | 위에서부터 폴더 칩(전체 + 폴더 + 추가) → "지금 싸는 중" 큰 카드(싸는 중 가방 중 가장 최근 체크한 1개) → 고정 → 최근 → 보관함 한 줄. 검색은 헤더 아이콘(구 홈과 같은 `searchBags`) |
| **홈 정렬** | 🔄 v2 변경 | D-day 0~7일 남은 가방은 가까운 순으로 맨 위, 나머지는 최근 체크 순. 정렬 선택(SortSelect)·카드 크기(1/2/3열)·드래그 순서변경은 v2에서 없음(프로필 필드는 보존) |
| **`Bag.lastCheckedAt` 신규** | 🆕 v2 신규 | 체크/해제·팩 전체 체크·다시 싸기 때 `hooks/bag/useBagItems.ts`가 찍는다. 없으면(예전 가방, 구 UI에서 체크) `updatedAt`으로 대신하고 "N일 전 수정"으로 표시 |
| **가방 상태 표시** | 🆕 v2 신규 | 한 줄: 상태(비어 있음/싸는 중/다 쌌어요) · 출발일 · N분 전 체크 · N명. 다가오는 출발일만 D-day 배지(7일 이내는 브랜드색). 진행률 링 + 챙긴/전체 개수 |
| **가방 폴더 1단계 전환** | 🔄 v2 변경 | `AuthProvider.flattenBagFolders()` 신규: 하위 폴더의 `parentId`를 지우고 원래 값은 `BagFolder.legacyParentId`에 보존(롤백용). 홈 v2가 처음 열릴 때 하위 폴더가 있으면 1회 실행. 가방 배정(`bagFolderAssignments`)은 그대로. 칩 길게 누르기 = 이름 변경/삭제(삭제 시 가방은 "전체"에 남음) |
| **가방 길게 누르기 시트** | 🆕 v2 신규 | 폴더 이동(칩) · 맨 위에 고정(최대 3개) · 보관함 옮기기/꺼내기(되돌리기 토스트) · 삭제(소유자, 휴지통)/나가기(멤버). PC는 우클릭. 구 홈의 다중선택·드래그 폴더 이동은 대체 |
| **보관함** | 🔄 v2 변경 | 홈 맨 아래 "보관함 N" → 화면 안 목록(마지막 사용일만 표시). 여행일 7일 지난 가방 보관 제안은 유지(보관하기/괜찮아요) |
| **새 가방 시트** | 🔄 v2 변경 | 빈 가방 · 메모/글로 채우기(NoteImportModal) · 초대 코드로 참여(JoinBagDialog). 칸반(업무) 가방 만들기는 제거(칸반 보기 제거 결정), 기존 칸반 가방은 일반 가방처럼 보인다 |
| **빠른팩 바(QuickPackBar)** | 🗑️ v2 숨김 | 홈 v2에서는 안 보임(가방 하단 입력창 + 미분류가 대체). 데이터는 그대로 |
| **오프라인 모드** | ⚠️ 제한 | 폴더·고정·보관은 users/{uid}에 저장하는 개인 정리 정보라 오프라인에서는 숨김(구 홈은 보이지만 저장 실패). 새 가방은 빈 가방만 |
| **팩 안 아이템 열 수 (스크롤 압박 완화)** | 🔄 v2 변경 | 팩은 위에서 아래로 쌓고, 팩 안 아이템을 격자로: 가방 화면 폭(`@container/bag`) 672px 미만 1열, 672px 이상 2열, 896px 이상 3열. 순서는 왼쪽→오른쪽, 위→아래. 글(text) 아이템은 한 줄 전체. 폰 세로는 상단 버튼으로 1열↔2열(`UserProfile.bagPhoneColumns`, 계정 저장, 기본 1). 2열에서는 줄 44px, 긴 이름 두 줄까지. 방향 문서의 "열 수 설정 삭제" 결정을 되돌린 것 |
| **가방 화면 최대 폭** | 🔄 v2 변경 | v2 가방 화면은 AppShell SlideScreen의 896px 제한을 풀고 내용 최대 1152px(max-w-6xl). 하단 입력창은 768px 유지 |
| **화면 용어 통일** | 🔄 v2 변경 | 화면 문구의 "카테고리"를 전부 "팩"으로. 새 팩 / 팩 이름 / 팩 삭제 / 아이템 시트 "팩" / 미분류 "팩으로 나눠 담기" |
| **팩 탭 v2 (`components/v2/packs/PacksScreenV2.tsx`)** | 🆕 v2 신규 | 구 `PacksScreen`과 같은 props, AppShell(모바일)에서 플래그 전환. 폴더 펼침 트리 대신 한 단계씩 들어가는 방식 + 위쪽 경로(팩 › 여행 › 해외) + 상위 폴더 버튼. 마지막으로 본 폴더는 이 기기에 기억. 폴더 먼저, 그다음 팩·메모(각 묶음 안은 기존 정렬 기준·고정·직접 정한 순서 유지) |
| **팩 탭 검색** | 🔄 v2 변경 | 검색창 항상 표시, 모든 폴더 대상(`searchLibraryPacks`, 빠른팩 포함). 결과에 폴더 경로 표시 |
| **팩 탭 길게 누르기 시트** | 🆕 v2 신규 | 이름 바꾸기 · 맨 위에 고정 · 다른 폴더로 옮기기(자기 자신·하위 폴더 제외) · 폴더 공유(PackShareModal) · 삭제(휴지통, 연결된 가방 사본 개수 안내). 구 화면의 다중선택·드래그 순서변경·정렬 선택·전체 펼치기는 없음 |
| **새 폴더 이름 입력** | 🔄 v2 변경 | `AppShell.handleCreateFolder(parentId, name?)`: v2는 이름을 먼저 받고 만든다(구 UI는 그대로 "새 폴더") |
| **빠른팩** | 🔄 v2 변경 | 팩 탭 맨 위 화면 **하단(탭바 바로 위)에 고정**, 아이템이 있을 때만 표시(하단 + 로 적은 것을 볼 곳). 10/3 목록 맨 위 → 하단 고정으로 이동. QuickPackBar는 없음 |
| **엑셀/구글시트 가져오기** | 🗑️ 소스 제거 | v2·구 UI 공통 제거(방향 문서 "소스 제거" 결정). `app/api/import-spreadsheet/route.ts` 삭제, `AiClipboardModal`·`NoteImportModal`의 `isSpreadsheetUrl` 분기 제거. 이제 시트 링크를 붙여넣으면 일반 글로 보고 각각 `clipboard-organize`·`import-note`로 보낸다 |
| **설정 v2 (`components/v2/settings/SettingsScreenV2.tsx`)** | 🆕 v2 신규 | 구 `SettingsScreen`과 같은 props, AppShell(모바일)에서 플래그 전환. 화면설정·가방설정·팩설정 하위 화면 없이 한 장: 프로필 / 화면(화면 모드·글자 크기) / 이용권(프리미엄·AI 사용량·내가 만든 URL) / 데이터(휴지통·오프라인 전환·오프라인 데이터 가져오기·백업) / 지원(공지·FAQ·문의) / 정보(버전·라이선스) / 관리자 / 로그아웃·데이터 초기화. 하위 화면(프로필·버전·라이선스·휴지통·문의)은 구 화면 재사용 |
| **설정에서 빠진 옵션** | 🗑️ v2 숨김 | 시작 화면, 강조색, 기본 투명도, 가방/팩 카드 색·투명도·여백·글씨·열 수, 가방 기본 보기(팩뷰/심플뷰), 오늘 마감 팝업, 완료 항목 아래로, 열 때 접기, 최대 표시 줄 수, 마감일 표시 2개, 메모 맞춤법(메모 편집기 툴바에 이미 있음), 사용 가이드·앱 설치 방법(구 UI 스크린샷). 프로필 필드는 모두 보존 |
| **v2 앱 시작 동작** | 🔄 v2 변경 | AppShell: 시작 화면 설정(`startPage`) 무시하고 항상 가방 탭, 오늘 마감 팝업(TodayTasksModal) 안 띄움, 진입 슬라이드에서 가이드·설치 안내 빼고 공지사항만 |
| **짧은 URL 토글 제거** | 🔄 v2 변경 | `isShortUrlFeatureEnabled`: v2에서는 프리미엄이면 항상 켜짐(링크 탭 시 선택 시트). `shortUrlEnabled` 필드는 구 UI용으로 보존 |
| **설정 프리미엄 줄** | 🆕 v2 신규 | 무료 회원에게만 "프리미엄 · 가족 모두와 무제한으로" 줄. 탭하면 프리미엄 시트(이용권 코드 + 네이티브에서만 인앱결제·복원). 게스트는 계정 연동 창. 프리미엄이면 "이용 중" 배지만 |
| **프리미엄 시트 (`components/v2/sheets/PremiumSheet.tsx`)** | 🆕 v2 신규 | 구 `PremiumLimitModal` + `UnlockCodeDialog`를 바텀시트 하나로. 안내 문구 → (네이티브·무제한 아님) 평생 프리미엄 구매·복원 / 이용권 코드 입력 단계. 이메일·프로필을 useAuth에서 직접 읽어서 AppShell의 무료 한도 안내에서도 구매 버튼이 보인다(구 모달은 안 보였음). 사용처: AppShell(모바일), BagScreenV2, SettingsScreenV2 |
| **코드로 참여 시트 (`components/v2/sheets/JoinBagSheet.tsx`)** | 🆕 v2 신규 | 구 `JoinBagDialog` 대체(HomeScreenV2). 실패 이유는 시트 안에 표시, ?invite= 링크로 들어오면 코드가 채워진 채 열림 |
| **토스트 v2** | 🔄 v2 변경 | `components/Toast.tsx`에 UI_V2 분기: 화면 아래 검은 띠(bg-ink, 아이콘 없음), 되돌리기 버튼은 오른쪽 44px. 탭바·입력창을 가리지 않게 살짝 띄움. 표시 시간·API는 그대로 |
| **구 컴포넌트 색·폰트 맞추기 (`.pib-v2-legacy`)** | 🔄 v2 변경 | v2일 때 `app/layout.tsx`가 body에 붙임. 구 토큰(--background/--surface/--accent 등)을 v2 값으로 다시 정의해서 재사용 중인 구 모달·메모 편집기·하위 화면이 v2 색·Pretendard로 보인다. 사용자 강조색·투명도·카드색은 v2에서 무시(프로필 값은 보존) |
| **게스트 보기 리스킨 (`.pib-v2-guest`)** | 🔄 v2 변경 | /p 가방 공유(`GuestBagClientView`)·/v 메모 문서(`GuestMemoArticleView`) 루트에 v2일 때만 클래스를 붙이고, 그 안에서 Tailwind 팔레트 변수(slate·blue·emerald·white)를 v2 색으로 바꾼다. 클래스·구조는 그대로(토큰만 적용). 라이트/다크 두 벌 |
| **v2 글자 크기 적용** | 🐛 v2 수정 | 설정 v2의 글자 크기가 v2 화면에 안 먹던 문제: `[data-font-scale]`에서 v2 글자 토큰 변수(--text-micro~title, 줄 높이 포함)를 작게/크게 값으로 바꾼다 |
| **메모팩 편집기 v2** | 🔄 v2 변경 | `PackNoteEditorScreen` 안 `UI_V2` 분기(로직·TipTap 구성·자동저장·원격 반영·첨부·링크 라벨은 그대로, 결만 교체). 구성: h-11 버튼 줄(뒤로·공유·더보기) → 큰 제목(바로 수정) → 상태 한 줄 → 툴바 한 줄 → 본문(넓은 화면은 오른쪽 목차). 모바일 목차 떠 있는 버튼은 더보기 안 "목차"로 옮김 |
| **메모 툴바 한 줄 (`components/v2/note/NoteToolbar.tsx`)** | 🔄 v2 변경 | 체크박스 · 제목(탭할 때마다 본문→제목1→제목2→제목3 순환) · 굵게 · 표 · 링크 · 첨부(무료는 자물쇠) · 더보기. 커서가 표 안이면 행+ · 열+ · 행- · 열- · 표 메뉴 · 굵게 · 더보기로 바뀜(구 UI의 "표 편집/글자서식" 탭 전환 없음). **글자를 고르면** 같은 줄이 굵게 · 기울임 · 밑줄 · 취소선 · 글씨 색 · 링크 · 서식 지우기로 바뀜(키보드 유지, 시트 없이 한 번에 적용). 떠 있는 버블 메뉴는 iOS 복사/붙여넣기 말풍선과 겹쳐서 쓰지 않음 |
| **메모 공유 시트 (`components/v2/note/MemoShareSheet.tsx`)** | 🔄 v2 변경 | 구 `MemoPackShareModal` 대체. 열 때마다 지금 내용(제목·편집 중 문서)으로 `/api/share-pack` 스냅샷 갱신, 링크 복사 · 보내기(Web Share, 지원하는 기기만) · 열어 보기. 큰 문서 미리보기는 뺀(링크로 확인). 처음 발급된 토큰은 `publicShareToken`으로 저장 |
| **메모 공유 스냅샷 자동 갱신** | 🆕 v2 신규 | 공유 링크는 `sharedPacks/{token}` 스냅샷이라 메모를 고쳐도 저절로 안 바뀜. v2에서는 `publicShareToken`이 있는 메모를 고친 뒤 편집기를 나갈 때(뒤로가기, 화면이 없어질 때) `/api/share-pack`을 한 번 다시 불러 같은 토큰으로 덮어씀(서버는 토큰 재사용 + `set` 덮어쓰기, 라우트 확인함). 공유 안 한 메모·안 고친 메모는 호출 없음. 실패는 콘솔만 |
| **팩 보관함 체크리스트 팩 화면 v2 (`components/v2/packs/PackEditorV2.tsx`)** | 🔄 v2 변경 | 구 `PackLibraryEditorScreen`과 같은 props, AppShell(모바일)에서 플래그 전환(데스크톱은 셸 통합 때). 가방 화면과 같은 구성: 버튼 줄(뒤로·공유·삭제) → 큰 제목(바로 수정) → 아이템 1·2·3열 격자 → 하단 입력창. 탭 = 체크, 길게 누르기 = 아이템 시트(이름·체크/글 종류·여러 개 선택·다른 팩으로 옮기기·복제·삭제). 여러 개 선택은 모든 팩에서 유지(아래 삭제·옮기기, 목적지 = 보관함 팩 또는 가방 → 그 가방의 팩, 되돌리기 포함). 입력창 왼쪽 버튼 = "다른 팩에도 같이 추가"(고른 팩 수 배지, 이 화면을 나가면 초기화). 삭제 확인에 "가방 속 사본도 같이 지우기" 토글. 0.5초 자동저장·나갈 때 즉시 저장·삭제 중 저장 건너뛰기는 구 화면 규칙 그대로. 빠진 것: 스와이프 수정/삭제(→ 길게 누르기 시트), 끌어서 순서 바꾸기, 글 아이템 굵게·색 편집(기존 서식은 보존), "완료 항목 아래로" 정렬 |
| **팩·폴더 공유 시트 (`components/v2/sheets/PackShareSheet.tsx`)** | 🔄 v2 변경 | 구 `PackShareModal`(링크 + 보딩패스·영수증·폴라로이드 이미지 카드) 대체, **이미지 카드는 뺀**(링크만). 링크 복사·보내기·열어 보기. 체크리스트 팩 화면과 팩 탭 길게 누르기 "공유"(폴더면 폴더 + 안의 팩)에서 쓴다. 체크리스트 팩은 메모와 같이 고친 뒤 화면을 나갈 때 스냅샷 자동 갱신, 폴더는 공유 창을 열 때만 갱신. 구 `PackShareModal`은 구 UI·데스크톱에만 남음 |
| **동시 편집 병합 (`lib/syncMerge.ts`)** | 🆕 v2 신규 | 3-way 병합(base=마지막으로 받은 서버 버전, local=내 화면, remote=서버 최신). base 대비 내가 바꾼 것만 remote 위에 얹음. 가방·팩·아이템은 id로 짝을 맞춰 필드 단위(체크·이름·추가·삭제·팩 이동), 메모 문서는 맨 위 문단 단위 diff3(같은 문단을 둘이 고치면 둘 다 남김). 서버 관리 필드(memberIds·ownerId·inviteCode·locked 등)는 항상 서버 값. Firestore 호출 없는 순수 함수 |
| **가방 저장·반영 (v2 `useBagDocument`)** | 🐛 v2 수정 | 예전: 내 저장 대기 중에 온 다른 멤버 변경을 건너뛰고 다시 반영하지 않아, 내 통째 저장(setDoc)이 그 변경을 서버에서도 지움(구 UI 동일). 지금: 구독 중인 스냅샷을 아이템 단위로 합침(추가 읽기 0). 함께 쓰는 가방(멤버 2명+)은 `saveSharedBagMergedRemote` 트랜잭션으로 저장(저장 1번당 읽기 1 + 쓰기 1, 동시에 저장해도 유실 없음, 그 사이 지워진 가방은 다시 만들지 않음, 오프라인이면 통째 저장으로 대신). 혼자 쓰는 가방은 쓰기 1번 그대로. 내 저장 메아리(내용 동일)는 무시해 무한 저장 방지 |
| **체크리스트 팩 화면 다른 기기 반영** | 🐛 v2 수정 | 예전: 열어 둔 동안 다른 기기 변경이 안 보이고 나중에 저장한 쪽이 덮어씀, 저장 시 updatedAt도 안 바뀜. 지금: 구독 중인 libraryPacks를 아이템 단위로 합침(추가 읽기 0), 저장 시 updatedAt 기록 |
| **메모 동시 편집** | 🐛 v2 수정 | 예전: 입력 중에 온 변경은 띠로만 알리고, 내 다음 자동저장이 그 변경을 덮어씀. 지금: 바로 문단 단위로 합치고(`mergeEditorDocs`) 치던 문단에 커서 유지, 내 다음 자동저장이 합친 문서를 올림. 가방 저장 병합도 메모를 문단 단위로 합침. 글자 하나하나를 실시간으로 같이 치는 방식(Yjs)은 아님 - 별도 중계 서버가 필요해서 제외 |
| **화면 모드·글자 크기 기기 간 반영** | 🐛 v2 수정 | 예전: 처음 켤 때 1번만 계정 값 반영. 지금: 다른 기기에서 바꾸면 열어 둔 앱에도 바로 반영(구독 중인 프로필, 추가 읽기 0) |
| **보관함 팩 삭제 → 가방 속 사본 같이 지우기** | 🐛 수정(구 UI 포함) | 확인창 토글 값이 AppShell·DesktopShell에서 버려져 사본이 남던 문제. `removePacksFromBagRemote`(트랜잭션으로 대상 팩만 제거)로 처리, 폴더는 하위 팩 포함, 잠긴 가방은 건너뜀 |
| **가방 속 팩 ↔ 팩 보관함 (v2 `useBagLibrary` + `LibrarySheet`)** | 🆕 v2 신규 | 팩 길게 누르기 시트의 한 줄이 상태에 따라 바뀜: "팩 보관함에 저장"(없음) / "보관함과 맞추기 · 내용이 달라요"(달라짐) / "보관함과 맞추기 · 원본이 더 최신"(다른 곳에서 먼저 바뀜) / "보관함과 같아요"(누르면 "변경사항이 없어요"). 저장 시 이름 확인(같은 이름 불가, 구 SaveAsDialog 규칙), 달라졌으면 다시 불러오기 / 원본에 덮어쓰기(원본이 더 최신이면 숨김, linkedLibraryUpdatedAt 비교) / 새로운 팩으로 저장. 보관함으로 보낼 때 체크·담당자·마감일 제거, 다시 불러올 때 같은 이름 아이템의 체크·담당자 유지. 미분류와 자동 동기화 중인 메모는 줄 숨김. 새 팩 저장은 기존 AppShell 경로(무료 개수 제한은 서버 검사) |
| **다른 가방으로 팩 옮기기 (v2 `MoveToBagSheet`)** | 🆕 v2 신규 | 팩 시트 "다른 가방으로 옮기기". 대상 = 내가 멤버·잠기지 않음·휴지통 아님·팩 10개 미만인 다른 가방(없으면 줄 숨김). 기존 `movePackBetweenBagsRemote` 트랜잭션(두 가방 한 번에)을 쓰고 이 화면은 다시 저장하지 않음(applyServerChange) |
| **날씨로 준비물 추천 (v2 `useBagWeather` + `WeatherSheet`)** | 🔄 v2 변경 | 방향 문서대로 AI 추천 중 날씨만 유지(명소·맛집·특산물 제거). 프리미엄 전용(구 화면과 동일, 무료는 자물쇠 → 프리미엄 시트), 온라인만. 더보기 > 추천 > "날씨로 준비물 추천". 가방 이름에서 장소 찾기 → 출발일이 16일 안이면 그날 예보, 아니면 오늘 날씨(`forecastDateFor`). 기본 추천(무료 규칙) + "AI로 더 추천받기"(누를 때만, AI 하루 횟수 1회). 고른 항목은 "날씨 추천" 팩(aiRecommendSource, 무료 멤버에게 숨김)에. 비용: 자동 호출 없음, 결과는 `aiRecommendCache`(가방 이름·예보일 같고 6시간 안)로 다시 부르지 않음. `aiRecommendCache.bagName`, `WeatherInfo.forDate` 필드 추가 |
| **햅틱 (`lib/haptics.ts`)** | 🆕 v2 신규 | 체크/해제 = 가벼운 진동, 가방을 다 싼 순간 = 성공 진동(iOS 앱만). 웹 빌드는 패키지 없이 통과(`@capacitor/core` registerPlugin). 실제 진동은 `npm i @capacitor/haptics && npx cap sync ios` 후 앱 재빌드·재심사 필요(그 전에는 조용히 아무 일 없음) |
| **메모 더보기·표·색·목차 시트** | 🆕 v2 신규 | `NoteMoreSheet`: 기울임·밑줄·취소선·코드 블록, 본문/제목1·2·3, 글자 크기 -/+, 글씨 색, 맞춤법 토글, 목차, 용량 %, 메모 삭제(보관함에서 연 메모만). 서식·문단 버튼은 적용 후 시트를 닫음(글자 크기 -/+만 열어 둠). `NoteTableSheet`: 열 너비(좁게·넓게·같게·자동), 행 간격, 합치기·나누기, 정렬, 위에 행·왼쪽에 열, 칸 색, 표 삭제(확인 시트). `NoteColorSheet`(구 TEXT_COLORS 그대로 + 직접 고르기), `NoteTocSheet` |
| **메모 링크 시트 통합 (`components/v2/note/LinkSheet.tsx`)** | 🔄 v2 변경 | LinkActionMenu + ShortenUrlModal + CustomUrlModal + EditLinkModal + 링크 삽입 window.prompt를 시트 하나의 단계(메뉴/주소 입력/짧은 URL/커스텀 URL/수정)로. 서버 API 그대로. 링크 넣기는 글자를 골랐으면 그 글자에, 안 골랐으면 주소를 글자로 넣어 링크(구 UI는 선택 없으면 아무 일도 안 일어났음). 아이템·가방 메모의 LinkifiedText는 구 컴포넌트 그대로 |
| **메모 상태 한 줄** | 🔄 v2 변경 | 하나만 표시(우선순위): 다른 기기 최신본(반영) > 용량 초과 > 깊이 초과 > 함께 편집 중 > 보관함 동기화. 동기화는 가방 안 메모 + `linkedLibraryPackId`가 있을 때만, "자동 동기화 중/꺼짐" + 켜기/끄기(`autoSyncEnabled`를 onSave로, 가방 팩 시트와 같은 필드·packSync 로직 그대로) |
| **가방당 공유 인원 (무료 2명)** | 🆕 v2 신규 | 기준은 참여하는 사람이 아니라 **가방을 만든 사람(ownerId)의 이용권**: 무료 2명(나+1), 프리미엄 10명(`FREE_MAX_BAG_MEMBERS`/`MAX_BAG_MEMBERS`/`bagMemberLimit`, lib/premiumLimits.ts). `app/api/join-bag`이 가방에 이미 2명 이상 있을 때만 만든 사람을 `isPremiumServer`로 확인(이메일은 Admin Auth, Firestore 읽기는 이때만 추가), 무료면 403 `BAG_MEMBER_LIMIT`(참여하는 사람 코드 시트에 이유 표시). 이미 인원을 넘긴 가방은 멤버 유지·새 참여만 차단. 이미 멤버면 검사 없이 통과. **`UI_V2`가 켜진 배포에서만 적용**(끈 운영은 예전처럼 10명). 만든 사람을 넘기면 새 만든 사람의 이용권을 따름 |
| **멤버 시트 인원 안내** | 🆕 v2 신규 | 만든 사람에게만 "N명까지 함께할 수 있어요"(멤버는 만든 사람의 이용권을 모르므로 인원 문구 없음). 인원이 다 차면 초대 링크·코드 대신 안내 + (무료면) "프리미엄으로 10명까지" → 프리미엄 시트. 초과 가방은 "지금 멤버는 그대로지만 새로 초대할 수는 없어요". 초대 코드 새로 받기는 그대로 |
| **클라이언트 직접 참여 규칙 삭제 (firestore.rules)** | 🔒 보안(구 UI 포함) | "아직 멤버가 아닌 사람이 자기 uid만 추가" update 규칙 제거 - 이 경로로 무료 참여 3개·가방당 인원 제한을 devtools로 우회할 수 있었음. 앱은 이미 `joinBagByCode` → `/api/join-bag`(Admin SDK)만 써서 동작 변화 없음. Firebase 콘솔 수동 게시 필요 |
| **가방 폴더 이름 겹침 정리 (`lib/bagFolderNames.ts`)** | 🆕 v2 신규 | 하위 폴더를 최상위로 올릴 때(또는 이미 올린 뒤) 같은 이름(대소문자·앞뒤 공백 무시)이 있으면 `flattenBagFolders`가 이름도 같이 바꿈: 원래 최상위였던 폴더(여러 개면 먼저 만든 것)는 그대로, 나머지는 "이름 (원래 부모 이름)", 그래도 겹치면 "이름 2/3...". 원래 이름은 `BagFolder.legacyName`에 보존(롤백용, 처음 한 번만). 홈 v2 진입 시 하위 폴더나 겹침이 있을 때만 1회, 바꿀 게 없으면 쓰기 없음 |
| **폴더 이름 중복 막기 (FolderSheet)** | 🆕 v2 신규 | 새 폴더·이름 바꾸기에서 다른 폴더와 같은 이름이면 "같은 이름의 폴더가 있어요" + 저장 버튼 비활성 |
| **사용 가이드 = 코치마크 투어 (`components/v2/guide/CoachTour.tsx`, `lib/v2/guide.ts`)** | 🔄 v2 변경 | 구 UI의 스크린샷 슬라이드(lib/helpTutorial) 대신 실제 가방 화면 위에서 안내. 화면을 어둡게(scrim) 덮고 `data-guide` 대상만 밝게(브랜드색 테두리) + 반대쪽 설명 카드(제목·설명·N/전체·건너뛰기·이전·다음). 연결선 없음, 길게 누르기는 첫 아이템 위 퍼지는 원. 6단계: 아이템 넣기(하단 입력창) · 체크하고 고치기(화면의 첫 체크리스트 팩) · 2열 버튼 · 다시 싸기 · 함께 챙기는 사람 · 더보기. 화면에 없거나 숨은 대상(넓은 화면의 2열 버튼, 빈 가방의 팩·다시 싸기)은 건너뜀. 대상이 화면 밖이면 스크롤, 스크롤·회전·창 크기에 맞춰 다시 잼. 투어 중엔 아래 화면 터치 막음, Esc로 닫힘 |
| **가이드 실행 시점** | 🆕 v2 신규 | 이 기기에서 처음 가방을 열면 0.7초 뒤 1회 자동(새 가방·잠긴 가방·검색 결과로 들어온 경우 제외). 닫거나 끝까지 보면 `localStorage packinbag:v2GuideBagSeen=1`(서버 읽기·쓰기 없음). 다시 보기: 가방 더보기 > 도움말 > 사용 가이드(바로 시작), 설정 > 정보 > 사용 가이드 다시 보기(기록을 지우고 다음에 가방을 열 때 다시 자동) |
| **가방 아이템 여러 개 선택 (v2 BagScreenV2)** | 🆕 v2 신규 | 아이템 길게 누르기 시트 > "여러 개 선택"(그 아이템이 골라진 채 시작). 선택 중에는 누르기·길게 누르기 = 선택/해제(체크 안 됨), 체크 칸 대신 동그라미 표시 + 연한 브랜드색 배경, 글 아이템도 선택 가능. 하단 입력창 자리에 "N개 선택 · 취소 · 삭제 · 옮기기". 옮기기 = 이 가방의 체크리스트 팩(미분류 포함) 중 하나를 골라 그 팩 맨 끝으로(원래 순서 유지, 이미 그 팩에 있던 것은 제자리, `useBagItems.moveItems`). 삭제 = 한꺼번에 + 되돌리기(원래 팩·원래 자리, `deleteItems`). 뒤로가기(스와이프 포함)는 선택만 끝냄. 다른 가방으로 옮기기는 없음(팩 단위는 팩 시트 "다른 가방으로 옮기기") |
| **출발 날짜 → D-Day** | 🔄 v2 변경 | 더보기 줄 이름 "출발 날짜" → "D-Day"(옆에 D-12 같은 계산 값). 가방 메타 줄 "10월 12일 · D-12 출발" → "D-12 · 10월 12일". 데이터는 그대로 `Bag.travelDate` |
| **D-Day 지우기 안 됨** | 🐛 v2 수정 | 날짜 줄이 `<label>`이라 iOS에서 '지우기' 누름이 날짜 입력으로 넘어가 지워지지 않음 → 줄을 div로, 버튼은 preventDefault·stopPropagation |
| **바텀시트·코치마크 뒤 화면이 안 보임** | 🐛 v2 수정 | 겹 루트에 붙은 `.pib-v2`가 바탕색(canvas)을 칠해 화면 전체를 가림(가이드는 강조 자리가 흰 빈 화면). `.pib-v2-overlay { background: transparent }`를 Sheet·CoachTour 루트에 추가 - 이제 시트 뒤로도 원래 화면이 어둡게 비침 |
| **홈 상단 캐러셀 (`components/v2/home/BagCarousel.tsx`)** | 🔄 v2 변경 | "지금 싸는 중" 큰 카드 1장 → 캐러셀. 넣는 순서: D-day 0~7일(가까운 순) → 싸는 중(최근 체크 순), 고정한 가방은 제외(아래 "고정" 구역에), 겹치면 한 번만, 최대 5장(`homeModel.buildSections`, `HIGHLIGHT_MAX`). 홈 순서: 캐러셀 → 고정(고정한 순서, 정렬 무관) → 가방(정렬). 카드 위 작은 줄: "곧 출발 · 비어 있음" / "지금 싸는 중 · 10분 전 체크". 폰은 밀어서, 넓은 화면(md+)은 좌우 화살표, 점을 눌러 바로 이동(CSS scroll-snap, 라이브러리 없음). **자동 넘김** 5초(끝 다음은 처음), 아래 줄 왼쪽 ⏸/▶ 버튼. 손으로 만지거나(밀기·누르기·휠) 점·화살표를 누르면 그 자리에서 멈춤(이 화면에서만). ⏸로 멈춘 상태는 기기에 기억(`localStorage packinbag:v2HomeCarouselPaused`), 동작 줄이기 설정이면 처음부터 멈춤, 앱이 화면 뒤면 넘기지 않음. 1장뿐이면 점·버튼·자동 넘김 없음. 빈 가방 카드는 "아직 비어 있어요" |
| **가방 고정 5개** | 🔄 v2 변경 | `toggleBagPinned`가 UI_V2일 때 최대 5개(`V2_MAX_PINNED_BAGS`, lib/listSort.ts), 구 UI는 3개 그대로(구 UI는 앞 3개만 고정으로 보임) |
| **홈 목록 정렬** | 🆕 v2 신규 | "고정" 구역 아래 구역 제목 "최근" → "가방", 오른쪽 "최근순 ▾" → 시트: 최근순(기존 규칙: D-day 7일 이내 먼저 + 최근 체크 순) / 이름순(ㄱ→ㅎ) / 이름 역순(ㅎ→ㄱ). 고정 가방은 정렬과 무관하게 항상 위. 캐러셀·고정에 나온 가방은 목록에서 빠짐. 저장은 기존 `UserProfile.bagSortBy`(이름순=nameAsc, 역순=nameDesc, 최근순=updatedAt, 새 필드 없음, 기기 간 동일, 구 UI 정렬과 같은 값). 그 외 예전 값(createdAt·custom)은 최근순으로 보임. 오프라인은 정렬 버튼 숨김(최근순 고정). 폴더 칩을 고르면 그 폴더 안에서 같은 규칙 |

# 팩인백 기능 스펙 문서 (v80 기준)

## v80 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **짧은/커스텀 URL에 표시 이름(label) 추가** | 🆕 v80 신규 | 링크(주소) 자체와 화면에 보이는 이름을 분리. 생성 시 "표시 이름"을 선택입력받아(비워두면 링크 그대로 보임) `shortLinks`/`customShortLinks` 문서에 `label` 필드로 저장(`app/api/shorten-url`, `app/api/custom-shorten-url`). 리다이렉트(`app/s`,`c`/[code]/route.ts)는 전혀 손대지 않아 기존 동작 그대로 유지 |
| **`app/api/link-meta`(GET) 신규** | 🆕 v80 신규 | 코드로 label/longUrl을 조회하는 공개 라우트(리다이렉트가 이미 longUrl을 인증 없이 공개하므로 같은 수준). Authorization 헤더가 있으면 검증해서 `canEdit`(요청자 uid == createdBy)까지 함께 내려준다 |
| **`app/api/update-short-link`(PATCH) 신규** | 🆕 v80 신규 | 본인이 만든 링크의 label/longUrl을 수정. `verifyRequestUser`로 로그인을 확인한 뒤 `createdBy === uid`일 때만 허용(그 외에는 403). 코드(주소 뒷부분) 자체는 수정 불가(이미 공유된 링크가 깨지지 않게) |
| **`lib/linkLabelCache.ts` 신규(모듈 공유 캐시)** | 🆕 v80 신규 | 짧은/커스텀 링크의 label을 code 기준으로 메모리에 캐싱하고 구독(subscribe) 가능하게 함 - `LinkifiedText.tsx`(리액트 상태로 재렌더)와 `PackNoteEditorScreen.tsx`(TipTap DOM 직접 갱신) 양쪽이 같은 캐시를 공유 |
| **`LinkifiedText.tsx` 개편: 라벨 표시 + 수정 진입점** | 🔄 v80 변경 | 아이템/가방메모 안 링크 텔스트가 우리 서비스 짧은/커스텀 링크면 label이 있을 때 그 이름을 보여준다(href는 그대로). 이미 축약된 링크를 탭했을 때는 `fetchLinkMeta`로 본인이 만든 것인지 확인해서(canEdit) 맞으면 "열기/수정" 선택 시트를, 아니면 v78부터의 "바로 열림" 동작을 그대로 유지(다른 사람이 만든 링크까지 매번 확인창을 띄우면 번거로워서) |
| **`PackNoteEditorScreen.tsx` 개편: 같은 로직 TipTap에 적용** | 🔄 v80 변경 | 새 `applyLinkLabels()`가 렌더링된 `<a>` 중 우리 링크만 캐시된 label로 텍스트를 바꿔치기한다(문서 모델/자동저장은 손대지 않음, DOM 렌더링만 변경). 에디터 "update" 이벤트 + 리모트 라이브동기화 시점에 재적용된다. "짧은 URL로 변경"도 이제 `ShortenUrlModal`을 거쳐 표시 이름을 입력받는다(이전에는 모달 없이 즉시 생성) |
| **`ShortenUrlModal.tsx`, `EditLinkModal.tsx` 신규** | 🆕 v80 신규 | `CustomUrlModal`과 같은 바텀시트 패턴. ShortenUrlModal은 표시 이름만(선택) 받고, EditLinkModal은 기존 링크의 표시 이름/연결 주소를 수정(코드는 변경 불가) |
| **`LinkActionMenu.tsx` 개편: `onManage` 슬롯 추가** | 🔄 v80 변경 | onShorten/onCustomize/onManage를 모두 선택(optional)으로 받아, 넘겨진 것만 버튼으로 보여준다 - 축약 전 링크(onShorten+onCustomize)와 본인 소유 축약된 링크(onManage)가 같은 컴포넌트를 공유 |

# 팩인백 기능 스펙 문서 (v79 기준)

## v79 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **아이템 단위 마감일(D-day) 표시 신설** | 🆕 v79 신설 | `Item.dueDate`(YYYY-MM-DD, 옵트인) 추가. 업무용 체크리스트에서 개별 항목별 마감일을 지정할 수 있게 됨. 계산(당일 포함 여부)은 가방 상단 D-day의 `ddayCountTodayAsDayOne`을 그대로 재사용해서 세는 기준을 하나로 통일. `lib/dday.ts`에 `formatItemDueLabel()`/`getDueUrgency()` 헬퍼 추가 |
| **아이템 수정 모달(ItemFormModal)에 마감일 입력 필드 추가** | 🆕 v79 신설 | `<input type="date">` 하나만 추가(TravelDateField와 동일 패턴). 기존 아이템 수정 진입 경로(오른쪽 스와이프 → 수정 버튼 → 모달)는 그대로 유지 |
| **리스트에 마감일 뱃지 표시(ItemRow)** | 🆕 v79 신설 | 아이템 오른쪽 끝에 텍스트만(색상 있는 뱃지 형태 아님)으로 표시. 지난 경우 danger 색상, 임박(오늘/내일)은 accent 색상, 그 외는 muted 색상 |
| **설정 > 팩 설정에 아이템 마감일 표시 방식 토글 신설** | 🆕 v79 신설 | `UserProfile.packSettings.dueDateDisplayMode`(없으면 "dday" 기본값). D-day 표기(D-3/D+1) 또는 실제 날짜(7/30) 중 고를 수 있음. 기존 아이템 최대 표시 줄 수(itemMaxLines)와 같은 세그먼트 컨트롤 UI 패턴 재사용 |
| **팩을 보관함과 오갈 때 dueDate는 항상 제외** | 🆕 v79 신설 | 팩을 보관함에 저장/덮어쓰거나 가방으로 불러올 때(`PackImportModal.cloneAsNewPack`, `BagEditorScreen`의 `commitSaveToLibrary`/`commitOverwriteToLibrary`/`handleRefreshFromLibrary`) 항상 dueDate를 지운다. 템플릿을 재사용할 때 지난 날짜가 그대로 딸려오는 문제를 막기 위함 |

# 팩인백 기능 스펙 문서 (v78 기준)

## v78 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **붙여넣기 즉시 자동 축약 폐지 → 링크 탭해서 선택하는 방식으로 전환** | 🔄 v78 변경 | 아이템/메모/메모팩에 URL을 붙여넣으면 바로 축약되던 기능(v74~v77)을 제거하고, 대신 기존 링크를 탭/클릭했을 때 "링크 열기" / "짧은 URL로 변경" 둘 중 고르는 선택 시트로 바꾸다. 프리미엄+토글 ON이 아니거나 이미 축약된(/s/{code}) 링크면 선택지 없이 바로 열린다. 붙여넣기(onPaste) 가로채기 코드는 `ItemRow`/`ItemFormModal`/`BagNotice`/`PackNoteEditorScreen`(TipTap handlePaste 포함) 모두에서 제거됨 |
| **`LinkActionMenu` 신규 (공통 선택 시트)** | 🆕 v78 신규 | `components/LinkActionMenu.tsx` — Portal 기반 바텀시트, "링크 열기"/"짧은 URL로 변경" 두 버튼을 항상 함께 보여준다(호출하는 쪽이 축약 가능할 때만 열어서). `ItemRow`의 아이템 텍스트(LinkifiedText), `BagNotice`의 가방 메모(LinkifiedText), `PackNoteEditorScreen`의 메모팩 링크 클릭 세 곳에서 공통으로 재사용 |
| **`LinkifiedText` 개편: 단순 표시용 → 상태/동작 보유** | 🔄 v78 변경 | 링크를 누르면 바로 열리던 것을, `user`/`shortenEnabled`/`onReplace` prop을 받아 내부에서 `LinkActionMenu` 열기여부를 직접 판단하고, "짧은 URL로 변경" 선택 시 `createShortLink` 호출 후 `onReplace(원본, 짧은URL)`로 부모의 저장 로직(`onChangeText`/`onChange`)까지 연결되도록 바꾸다. `ItemRow`/`BagNotice`에서 해당 콜백 연결 추가됨 |
| **`lib/shortLinkService.ts` 정리** | 🔄 v78 변경 | 더 이상 쓰이지 않는 `shouldShortenPastedText`/`handleShortenablePaste`(붙여넣기 가로채기용) 제거. 대신 `isAlreadyShortLink(url)` 신규 추가 — 자체 짧은 URL(/s/{code})인지 판단해서 이미 축약된 링크는 선택 시트 없이 바로 열리게 한다(무한 축약 방지) |
| **`PackNoteEditorScreen.tsx`의 직접 붙여넣기 가로채기(handlePaste)/editorRef 제거** | 🗑️ v78 정리 | 더 이상 붙여넣기 시점에 개입하지 않으므로 비동기 교체용 ref가 필요 없어졌다 - 링크 클릭 시 즉석에서(동기) `editor` 변수를 그대로 쓰게 단순화됨. TipTap Link 확장(autolink/linkOnPaste)은 그대로 유지되어 타이핑/붙여넣기로 생긴 URL은 여전히 TipTap이 자동 링크 마크로 만들어준다 |

# 팩인백 기능 스펙 문서 (v77 기준)

## v77 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **"짧은 URL 사용하기" 토글을 설정 최상단 → AI 기능 하위로 이동** | 🔄 v77 변경 | v76에서 설정 최상단에 넣었던 토글을 "AI 기능" 섹션 안으로 이동(이용자 사용량 행 바로 아래). 무료 회원은 토글 자체가 disabled(readonly, 항상 OFF)로 보이고 탭해도 반응하지 않으며, 프리미엄으로 전환하려면 같은 섹션의 "이용권 코드 입력" 버튼을 따로 누르면 된다(토글 자체에 구매 유도 다이얼로그 연결 제거). `components/ToggleSwitch.tsx`에 `disabled` prop 신규 추가(버튼 자체 disabled + opacity 낮춤) |
| **지역 추천 토글 신규 (프리미엄 전용)** | 🆕 v77 신규 | 같은 AI 기능 섹션에 "지역 추천" 토글 추가. 가방 제목을 바꿀 때 제목에 지역명이 들어있으면 날씨/맛집/관광지를 추천하는 기존 기능(BagEditorScreen)을 이 토글로 감싼다. 기존에는 단순 "프리미엄이면 무조건 보임"이었으나, 이제는 프리미엄 + 이 토글 둘 다 켜야만 동작(기본값 OFF). `UserProfile.regionRecommendEnabled`(lib/types.ts) 신규 필드 + `AuthProvider.updateRegionRecommendEnabled`. `lib/premiumLimits.ts`의 `isRegionRecommendFeatureEnabled(email, profile)`가 isPremiumUser && regionRecommendEnabled 둘 다 판정. `BagEditorScreen.tsx`의 날씨/AI추천 useEffect 2개 + 카드 렌더링 조건이 모두 `premium` 대신 이 값을 보도록 교체됨 |
| **프리미엄 → 무료 전환 시 두 토글 자동 OFF** | 🆕 v77 신규 | 이용권 만료/무효화 등으로 프리미엄이 아닌 상태로 돌아오는 순간, 켜져 있던 `shortUrlEnabled`/`regionRecommendEnabled`가 있으면 자동으로 둘 다 false로 다시 쓰인다. `AuthProvider.tsx`의 `profile` 변경 시마다 재검사하는 자가치유 방식으로 구현(직전 세션 값을 기억해둘 필요 없이, 앱을 닫았다 켜는 사이에 이용권이 만료된 경우도 놓치지 않음) |

# 팩인백 기능 스펙 문서 (v76 기준)

## v76 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **설정 최상단 "짧은 URL 사용하기" 토글 (프리미엄 전용)** | 🆕 v76 신규 | 가방/팩 하위 설정 메뉴가 아니라 설정 화면 최상단(프로필 카드 바로 아래)에 ON/OFF 토글 추가. 아이템/메모/메모팩 URL 자동축약 기능(v74~v75)이 이제 기본값 OFF + 프리미엄 전용으로 바뀌었다. `UserProfile.shortUrlEnabled`(lib/types.ts) 신규 필드 + `AuthProvider.updateShortUrlEnabled`. `lib/shortLinkService.ts`의 `isShortUrlFeatureEnabled(email, profile)`가 isPremiumUser && shortUrlEnabled 둘 다 충족해야만 true - ItemRow/ItemFormModal/BagNotice/PackNoteEditorScreen 네 곳 모두 이 값을 handleShortenablePaste(또는 TipTap handlePaste)의 enabled 파라미터로 넘겨야만 축약이 동작한다. 프리미엄이 아닌 상태에서 토글을 누르면 기존 이용권 코드 입력 다이얼로그(UnlockCodeDialog)가 대신 열린다(AI 기능 섹션과 동일한 패턴) |

# 팩인백 기능 스펙 문서 (v75 기준)

## v75 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **아이템/메모/메모팩 안 링크 탭해서 열기 (웹+앱 공통)** | 🆕 v75 신규 | 아이템 텍스트(ItemRow)와 가방 메모(BagNotice) 안의 http(s) URL을 탐지해 파란 밑줄 링크로 렌더링하고(`components/LinkifiedText.tsx`), 탭하면 `openExternalLink()`(`lib/openExternalLink.ts`)로 연다. 새 탭(웹) / Capacitor 기본 외부 네비게이션 정책(다른 호스트로 가는 링크는 시스템 브라우저로 자동 핸드오프)를 그대로 활용해서 별도 네이티브 플러그인(@capacitor/browser) 없이도 웹/앱 동일하게 동작. 링크를 누르면 부모(아이템 행 탭/메모 편집 진입)의 클릭 동작이 같이 실행되지 않아야 해서, 기존 `<button>`(ItemRow 아이템 내용 표시 / BagNotice 표시)을 `<div role="button">`로 바꿈(`<a>`를 `<button>` 안에 중첩하는 건 유효하지 않은 HTML) |
| **메모팩(에디터팩/TipTap)에도 URL 자동 축약 + 링크 열기 적용** | 🆕 v75 신규 | `@tiptap/extension-link` 신규 설치(package.json, **`npm install` 직접 실행 필요**). `lib/noteEditorExtensions.ts`에 Link 확장 추가(openOnClick: false, autolink/linkOnPaste: true). `PackNoteEditorScreen.tsx`의 `useEditor` `editorProps.handlePaste`가 30자 이상 URL 붙여넣기를 가로채서 원본 URL을 링크 마크와 함께 먼저 삽입한 다음, 백그라운드에서 축약(app/api/shorten-url)해서 그 자리를 짧은 링크로 교체(`lib/noteEditorLinkPaste.ts`의 `replaceLinkTextInEditor`, ProseMirror 문서 내 텍스트 검색/치환). 짧은 URL(30자 미만)은 TipTap의 기본 `linkOnPaste`가 그대로 링크로 만들어줌. 링크 클릭은 에디터 영역 클릭 핸들러가 `<a>` 태그를 감지해서 `openExternalLink()`로 연다. 읽기전용 미리보기(EditorPackCard)는 전체 영역이 `pointer-events: none`이라 링크 클릭이 안 먹히고 항상 편집화면을 연다(기존 동작 그대로). `app/globals.css`의 `.pib-note-editor a` 스타일(강조색 밑줄) 추가 |
| **패키지 설치 필요** | ⚠️ 대기 | `package.json`에 `@tiptap/extension-link` 추가만 해둔 상태라, 실제 설치(`npm install`)는 사용자가 직접 로컬/회사 각 기기에서 진행해야 함 |

# 팩인백 기능 스펙 문서 (v74 기준)

## v74 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **아이템/메모 텍스트에 붙여넣은 긴 URL 자동 축약(짧은 링크)** | 🆕 v74 신규 | 아이템(ItemRow 인라인 편집/ItemFormModal)과 가방 메모(BagNotice) 입력칸에 30자 이상의 http(s) URL 하나만 붙여넣으면 자동으로 `/s/{7자리 코드}` 형태의 자체 짧은 링크로 교체된다. 원본 URL은 붙여넣기 즉시 먼저 들어가고(입력 막힘 없음), 백그라운드에서 축약 완료되면 그 자리를 짧은 링크로 교체(실패하면 원본 URL 그대로 유지). `lib/shortLinkService.ts`(판단/호출 로직), `app/api/shorten-url/route.ts`(생성, Admin SDK), `app/s/[code]/route.ts`(리다이렉트). Firestore `shortLinks/{code}` 컬렉션은 client read/write 전부 차단(Admin SDK만 접근) |
| **firestore.rules 변경분** | ⚠️ 대기 | `shortLinks` 컬렉션 규칙 추가(`allow read, write: if false`). Firebase 콘솔에서 재게시 필요 |

## 인프라 변경: 커스텀 도메인 전환 (2026-07-24)

| 항목 | 내용 |
|---|---|
| **대표 도메인 구매** | `seeuson.com` (Namecheap에서 구매, WhoisGuard 프라이버시 적용) |
| **서비스 서브도메인 연결** | `packinbag.seeuson.com` → Vercel packinbag 프로젝트에 연결 (CNAME 방식, `packinbag.vercel.app`은 계속 유효하게 살려둠) |
| **capacitor.config.ts** | `server.url`을 `https://packinbag.vercel.app` → `https://packinbag.seeuson.com`으로 변경. **다음 Xcode 빌드 시 반영됨** (아직 iOS 빌드 안 함) |
| **Firebase Authorized Domains** | `packinbag.seeuson.com` 추가 완료 |
| **Google OAuth (Web client)** | Authorized JavaScript origins / Redirect URIs에 `https://packinbag.seeuson.com` 추가 완료 |
| **Firebase Auth 이메일 커스텀 도메인** | `seeuson.com` 도메인으로 SPF/DKIM(TXT+CNAME 4개) 인증 완료 및 적용. 발신 주소가 `noreply@packinbag-f1983.firebaseapp.com` → **`noreply@seeuson.com`**으로 변경됨 |
| **이메일 템플릿 언어** | Firebase Authentication → Templates 좌측 하단 "템플릿 언어"를 한국어로 변경 (개별 템플릿 문구를 일일이 번역해서 붙여넣을 필요 없이, 이 설정 하나로 기본 템플릿이 한국어로 전환됨) |
| **참고 파일** | `packinbag_private_config.js` 맨 아래 참고용 배포 주소 메모도 새 도메인으로 갱신 |
| **여러 앱 확장 계획** | `seeuson.com`을 여러 앱의 대표 도메인으로 쓰고, 앱마다 서브도메인(`앱이름.seeuson.com`)으로 구분할 예정. 이메일 발신 도메인은 앱별로 나누지 않고 `seeuson.com` 하나로 통일 |

## v73 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **메모장뷰 팩 헤더 빠른추가 버튼을 ⋯ 메뉴로 이동** | 🆕 v73 변경 | `NotebookPackSection.tsx`에서 빠른추가(체크박스/텍스트) 아이콘을 헤더에서 없애고 팩 메뉴(⋯) 안으로 이동 |
| **다중선택 모드에서 다른 팩의 아이템도 선택 가능** | 🆕 v73 변경 | 팩뷰/메모장뷰의 다중선택 상태를 팩 하나만 담당하던 `{ packId, itemIds }`에서 여러 팩을 동시에 담는 `Record<packId, Set<itemId>>` 구조로 교체. 이제 다른 팩으로 롱프레스해도 그 팩의 아이템도 선택 가능하고, 선택된 여러 팩의 아이템을 한 번에 다른 팩으로 이동/삭제 가능. `BagEditorScreen.tsx`(selection/groupDrag 상태 구조), `PackGrid.tsx`/`NotebookView.tsx`(`selectedItemsByPack` 프롭 교체) |
| **다중선택 모드 중 더블클릭 텍스트 선택 방지** | 🐛 v73 수정 | 선택 모드(disabled) 중에도 더블클릭하면 브라우저 기본 텍스트 선택(하이라이트)이 일어나던 문제 - `e.preventDefault()` 추가. `ItemRow.tsx` |

## v72 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **관리자 사이드바 접기/펼치기 + 화면 하단 여백** | 🆕 v72 신규 | `AdminSidebar.tsx` 상단에 접기/펼치기 토글 버튼 추가(224px ↔ 64px, 접으면 아이콘만+title 툴팁, localStorage에 상태 저장). `AdminGate.tsx`의 공유 스크롤 컨테이너(`<main>`)에 `pb-24` 추가해서 대시보드 등에서 스크롤 끝까지 내렸을 때 마지막 콘텐츠가 화면 하단에 붙어 잘려 보이던 문제 해결(모든 admin 화면이 이 main을 공유하므로 한 곳만 고치면 전체 적용됨). 단, 문의/이용권 관리 화면은 내부적으로 `h-screen`을 따로 쓰고 있어서 이 pb는 적용 안 됨 |
| **대시보드 카드 클릭 → 모달/화면 이동** | 🆕 v72 신규 | 대시보드(`app/admin/page.tsx`)의 통계 카드를 클릭 가능하게 만듦. "총 가입자"/"최근 7일 신규 가입"은 페이징 유저 목록 모달(`components/admin/UserListModal.tsx`, 신규 API `app/api/admin/users-list`)을 띄우고, 모달에서 유저를 누르면 `/admin/users?email=...`로 이동해 자동 검색됨(`AdminUsersPage`에 쿼리 파라미터 자동조회 추가). 이용권 카드(활성/미배포/만료/무효화)는 `/admin/unlock-codes?status=...`로 이동해 해당 상태로 필터링된 채 열림(`UnlockCodeAdminScreen`에 상태 필터 칩 UI 추가). 문의 카드(총 문의/미답변)는 `/admin/inquiries`(`?status=pending`)로 이동(`InquiryAdminScreen`의 기존 미답변 토글을 쿼리 파라미터로 초기화). 클릭 가능한 카드는 우측에 화살표 아이콘으로 표시 |

## v71 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **관리자 대시보드 - 파이차트 + 전일/전주 대비 증감** | 🆕 v71 신규 | 대시보드(`app/admin/page.tsx`)의 각 통계 카드에 recharts 파이차트(가방 상태, 팩 구성, 아이템 완료율, 이용권 코드 상태)와 전일/전주 대비 증감 뱃지(초록 +, 빨강 -)를 추가. 증감 계산을 위해 매일 KST 00:05에 Vercel Cron(`vercel.json`)이 `/api/admin/stats/snapshot`을 호출해서 그 시점 통계를 `adminStatsSnapshots/{YYYY-MM-DD}` 문서로 저장(사실상 전날 마감 스냅샷). `/api/admin/stats`가 오늘 값과 어제/일주일 전 스냅샷을 비교해서 `trend.vsYesterday`/`trend.vsLastWeek`로 내려줌. 스냅샷이 없는 날(cron 첫 실행 전/실패)은 해당 뱃지가 "-"로 표시됨. 통계 집계 로직은 `lib/adminStats.ts`로 분리해서 두 라우트가 공유. **배포 시 Vercel 프로젝트 환경변수에 `CRON_SECRET` 설정 필요**(`.env.local.example` 참고) |

## v70 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방 보관함/팩 보관함 헤더 설정 아이콘 삭제** | 🗑️ v70 정리 | 설정(SettingsScreen)은 이미 하단탭(오른쪽, "설정")으로도 진입 가능해서 헤더 톱니바퀴 아이콘이 중복이었음. HomeScreen/PacksScreen 헤더에서 설정 아이콘 제거(`onOpenSettings` prop 삭제). `components/screens/HomeScreen.tsx`, `components/screens/PacksScreen.tsx`, `components/AppShell.tsx` |
| **가방 보관함 헤더의 팩 보관함(폴더 아이콘) 버튼 삭제** | 🗑️ v70 정리 | 이미 같은 역할을 하는 왼쪽 엣지 스와이프 힌트 버튼(`PackTreeSwipeHint`)이 있어서 중복. 데스크톱/마우스에서도 같은 드래그 제스처(`handleMouseDown/Up`)가 동일하게 동작하므로 버튼 없이도 진입 가능. `onOpenPackTree` prop 삭제. `components/screens/HomeScreen.tsx`, `components/AppShell.tsx` |
| **용어 통일: "팩 트리" → "팩 보관함"** | 🐛 v70 정리 | 설정 > 팩 설정의 "팩 트리 열기 버튼" 명칭/설명과, 엣지 스와이프 힌트 버튼의 aria-label을 "팩 보관함"으로 통일(사용자 노출 문구 기준). `components/screens/PackSettingsScreen.tsx`, `components/PackTreeSwipeHint.tsx` |
| **화면설정 구조 정리: 안 쓰는 "팩 보관함 그리드" 섹션 숨김 + 재배치** | 🗑️ v70 정리 | v68부터 팩 보관함이 그리드(PackTile)에서 트리(리스트)로 바뀌면서 PackTile이 실제로는 안 쓰는 코드가 되어, "팩 보관함 그리드"(`packLibraryColorId` 등) 섹션을 화면에서 숨김. "가방 카드" → "가방 보관함"으로 명칭 변경, "가방 속 팩카드"는 "가방" 그룹에서 "팩" 그룹으로 이동(팩 카드 설정이라는 의미상 더 맞는 카테고리로 재배치). PackTile.tsx 파일 자체와 ThemeProvider의 packLibrary 관련 상태/CSS변수는 보존(appflo 요청, UI만 숨김). `components/screens/ColorSettingsScreen.tsx` |

## v69 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **하단탑 3개 재구성 (가방보관함 / 빠른입력 / 설정)** | 🆕 v69 신규 | 하단탑이 [팩/가방] 2탑+가운데 FAB 구조에서 [가방보관함 / 빠른입력(중앙 + FAB, 변경 없음) / 설정] 3개로 재개편됨. "팩" 탑이 사라지고, 팩 트리(PacksScreen)는 가방보관함(최좌측 탑, index 0)에서 왼쪽에서 오른쪽으로 스와이프하면 풀스크린으로 열리는 화면으로 바뀌었다(BagEditorScreen과 동일한 "위로 쌓는" 패턴, 뒤로가기 헤더 버튼 + 왼쪽 엣지 스와이프백 모두 지원). 설정(SettingsScreen)은 더 이상 풀스크린 오버레이가 아니라 가방보관함과 같은 슬라이더 안에 들어오는 두 번째 탑 페이지가 되었다. "이전 탑 없음"으로 아무 동작도 안 하던 빈 슬롯(가방보관함에서 왼→우 스와이프)을 팩 트리 열기에 재활용해서 기존 탑전환 스와이프와 충돌이 없다. `components/BottomTabBar.tsx`(TabKey "home"|"settings"로 재정의), `components/AppShell.tsx`(showPackTree 상태, tabOrder, handleTouchEnd), `components/screens/PacksScreen.tsx`(onBack/엣지스와이프백 추가), `lib/types.ts`/`contexts/AuthProvider.tsx`(UserProfile.defaultTab: "home"|"packs" → "home"|"settings"), `components/screens/SettingsScreen.tsx`(시작화면 선택지 갱신) |

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 보관함 폴더 기능 신설 (아이폰 메모 스타일)** | 🆕 v68 신규 | 팩 보관함이 그리드(PackTile) 방식에서 폴더를 만들 수 있는 트리 리스트로 전면 개편. 폴더도 그냥 Pack 문서(`type: "folder"`, `items: []`)이고, `parentId`로 트리를 표현해서 아이폰 메모처럼 깊이 제한 없이 폴더 안에 폴더를 계속 만들 수 있다. 각 레벨(최상위/폴더 안) 끝에 "+팩"/"+폴더" 버튼으로 그 자리에 바로 생성. 롱프레스 다중선택으로 폴더/팩 구분 없이 선택해서 삭제(폴더는 하위 항목까지 재귀적으로 휴지통 이동, 휴지통에서의 복구/완전삭제도 동일) 또는 "이동"(다른 폴더로 옮기거나 최상위로) 가능. 1개만 선택하면 "이름 변경" 버튼도 나타난다(폴더는 편집 화면이 없어서 이 경로가 유일한 이름 변경 수단). `lib/types.ts`의 `Pack.type`/`Pack.parentId`, `lib/packsService.ts`의 `collectDescendantPackIds`/`trashLibraryEntryRecursive`/`restoreLibraryEntryRecursive`/`deleteLibraryEntryRecursive` |
| **팩 보관함 무료 개수 제한(3개) 폐지** | 🆕 v68 정책변경 | 폴더 기능 도입과 함께 무료/유료 구분 없이 팩을 무제한으로 저장할 수 있다. `FREE_MAX_LIBRARY_PACKS`, `computeLockedPackIds` 삭제, `app/api/create-library-pack`/`restore-library-pack`/`sync-lock-status`의 개수 검증 로직 제거, `firestore.rules`의 libraryPacks 수정/삭제 규칙에서 `locked` 검사 제거(⚠️ Firebase 콘솔 재게시 필요). **가방 동시 진행 3개 제한(FREE_MAX_ACTIVE_BAGS)은 기존 정책 그대로 유지**(소유 가방만 개수를 세고, 공유가방은 제외된다) |

## v67 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **빠른팩 바 접기/펼치기 기능 신규** | 🆕 v67 신규 | 하단 QuickPackBar를 접으면 오른쪽 끝으로 줄어들어가면서(너비 축소+둥글게+회전) 작은 원형 버블로 변함. 버블을 탭하면 빠른팩 화면이 바로 열리고, 버블 모서리의 작은 펼치기 버튼을 따로 누르면 다시 바 형태로 돌아옴. 접힌/펼쳐진 상태가 계정(`users/{uid}.quickPackCollapsed`)에 저장되어 앱을 껐다 켜도, 팩/가방 어느 화면에서도 동일하게 유지됨 |
| **빠른팩 다중선택 모드 카드 테두리 깨짐 버그 수정** | 🐛 v67 | 선택된 카드 강조 표시가 `outline`으로 그려져 있어서, `border-radius`를 따라가지 않는 브라우저(특히 iOS WKWebView)에서 모서리가 각지게 깨진 것처럼 보이던 문제. `box-shadow`로 교체(PackLibraryEditorScreen 선택 카드, ItemRow 드래그 오버 타겟 둘 다) |
| **빠른팩 선택 모드 첫 줄 카드 위쪽 테두리 잘림 버그 수정** | 🐛 v67 | 아이템 목록 스크롤 컨테이너에 위쪽 padding이 없어서, 선택된 카드의 box-shadow(2px)가 스크롤 영역 맨 위에서 overflow-y-auto에 의해 잘려나가는 문제. 컨테이너에 `pt-1` 추가 |

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방 속 팩 전체접기/펼치기 UI를 아이콘으로 통일** | 🐛 v66 | 가방 편집화면 상단의 "전체 접기"/"기본"/"전체 펼치기" 텍스트 버튼 3개를, 개별 팩 카드가 이미 쓰던 쉐브런(접기/펼치기)·화살표(넓게보기/기본) 아이콘 토글 2개로 교체. 지금 모든 팩이 같은 상태일 때만 아이콘이 "펼침"/"넓음" 형태로 바뀌고, 섞여있으면 기본 아이콘으로 보임 |
| **새 가방 생성 중 로딩 오버레이 추가** | 🐛 v66 | 빈 가방 만들기·AI 메모 가져오기·샘플 템플릿·해시태그 AI 생성 모두 결과를 받은 뒤 Firestore에 실제로 가방을 쓰는 동안(`createBagRemote`) 화면에 아무 반응이 없어서 멈춘 것처럼 보이던 문제. `AppShell.tsx`에 전체화면 스피너+"가방을 만들고 있어요" 오버레이(`CreatingBagOverlay`) 추가 |
| **가방 속 이미지 업로드 중 스피너 표시** | 🐛 v66 | 업로드 중엔 버튼이 비활성화(반투명)만 될 뿐 진행 중이라는 표시가 없었음. 업로드 중엔 아이콘을 로딩 스피너로 교체 |
| **클립보드에서 가져오기 - PDF 파일 첨부 지원** | 🆕 v66 신규 | 텍스트 붙여넣기뿐 아니라 준비물 목록이 담긴 PDF 파일을 직접 첨부해서 AI 분석 가능. 원본 3MB 이하만 허용(Vercel 서버리스 함수 요청 body 한도 4.5MB에 안전하게 맞추기 위함). `app/api/import-note/route.ts`가 `pdfBase64`/`pdfMimeType`을 받아 Gemini `inline_data`로 전달하도록 확장. PDF 첨부 시 텍스트 입력창은 숨겨지고 파일명+용량이 표시됨(텍스트와 동시 전송 불가) |

## v65 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **이용권 코드 - 기간제 지원** | 🆕 v65 신규 | 이용권 코드가 "무제한"만 가능하던 것을 무제한/7일/1개월/1년/직접입력(일수) 중에서 고를 수 있게 변경. 기간은 코드를 생성한 시점이 아니라 **실제로 사용(redeem)한 시점부터** 계산됨. `lib/aiUsageConfig.ts`에 `UnlockDurationType`, `durationTypeToDays()` 추가. 대량 생성 시 한 배치의 코드들은 모두 같은 기간으로 생성됨 |
| **만료 처리** | 🆕 v65 신규 | `app/api/redeem-unlock-code/route.ts`가 리딤 시점에 코드의 `durationDays`로 만료 시각(`expiresAt`)을 계산해서 `unlockCodes` 문서와 `users` 문서(표시용) 양쪽에 기록. AI 할당량 서버 검증(`lib/aiQuotaServer.ts`)이 매 호출마다 `expiresAt`이 지났는지도 함께 확인 - 기간이 끝나면 자동으로 무료 한도로 전환되고, 별도로 무효화하지 않아도 됨. 코드 자체는 삭제되지 않고 이력으로 남음(누가 언제까지 썼는지 계속 조회 가능) |
| **관리 화면 표시 갱신** | 🆕 v65 신규 | 이용권 코드 관리 화면에 기간 선택 UI(무제한/7일/1개월/1년/직접입력) 추가. 코드 목록에 기간 뱃지 표시, 사용자별 현황에는 "사용중/만료됨/무효화됨" 3가지 상태를 구분해서 보여줌(만료는 시간이 지나면 자동으로 계산되는 표시 상태라 별도 버튼 없음, 무효화는 여전히 수동 버튼). `lib/aiUsageService.ts`의 `unlockCodeDisplayStatus()`가 이 판정을 담당 |
| **firestore.rules** | 변경 없음 | v64에서 추가한 마스터 전용 invalidate 규칙 그대로 재사용(같은 필드셋으로 처리) |

## v64 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **이용권 코드 대량 생성** | 🆕 v64 신규 | 이용권 코드 관리 화면에서 코드를 1개씩만 만들던 것을 개수(최대 200개) + 공통 메모(예: "2026 여름 이벤트")로 한번에 생성 가능하게 변경. `lib/aiUsageService.ts`의 `createUnlockCodesBulk(count, note)` (Firestore `writeBatch` 사용). 생성 직후 방금 만든 코드들을 한 화면에서 바로 전체 복사할 수 있음 |
| **코드 1개 = 1인 1회 사용으로 강제** | 🐛 v64 보안 강화 | 기존엔 코드를 아는 사람이면 누구든(여러 명 동시에라도) 자기 계정에 그 코드를 써넣을 수 있었음(클라이언트가 직접 Firestore에 씀). v64부터는 리딤(코드 입력)을 서버(Admin SDK) 라우트 `app/api/redeem-unlock-code/route.ts`에서 트랜잭션으로 처리해서, 이미 다른 사람이 선점한 코드는 "이미 다른 계정에서 사용된 코드예요"로 막힘. `components/UnlockCodeDialog.tsx`는 이제 Firestore를 직접 쓰지 않고 로그인 토큰을 들고 이 API를 호출함 |
| **코드-사용자 매핑 관리(사람별 보기) + 무효화** | 🆕 v64 신규 | 이용권 코드 관리 화면에 "사용자별 사용 현황" 섹션 추가 - 코드를 실제로 사용한 사람(이메일)별로 그룹핑해서, 그 사람이 지금까지 사용한 코드 이력(사용중/무효화됨, 사용일)을 한눈에 볼 수 있음(사람 : 코드 = 1:N, 무효화 후 재발급 가능). 활성 코드에는 "무효화" 버튼이 있어서 누르면 그 코드는 즉시 무제한 자격을 잃음(서버 `lib/aiQuotaServer.ts`가 매 호출마다 코드 상태를 재확인). 아직 아무에게도 안 준 "미배포 코드" 목록은 기존처럼 별도 섹션에서 복사 가능. `lib/aiUsageService.ts`의 `invalidateUnlockCode(code)`, `listUnlockCodes()` 응답에 `status`/`claimedBy`/`invalidatedAt` 필드 추가 |
| **firestore.rules 변경분** | ⚠️ 대기 | `unlockCodes` 규칙에 마스터 전용 `update` 허용 추가(단, `status`/`invalidatedAt` 필드만, `status`가 `'invalidated'`로 바뀌는 경우만 - 무효화 버튼용). 일반 사용자의 코드 사용(claim)은 여전히 클라이언트 write 권한이 전혀 없고 서버(Admin SDK)만 가능. Firebase 콘솔에서 재게시 필요 |
| **필요 환경변수** | 변경 없음 | 기존 `FIREBASE_SERVICE_ACCOUNT_KEY`를 그대로 재사용(새 API 라우트도 같은 Admin SDK 모듈 사용) |

## v61 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **AI 일일 사용 한도 - 서버 강제 방식으로 전환** | 🐛 v61 보안 강화 | v60에서는 무료 10회 제한을 클라이언트가 자기 Firestore 문서를 직접 트랜잭션으로 확인+증가하는 방식이라, devtools로 우회 가능한 소프트 제한이었음. v61부터는 AI API 라우트(import-note/generate-sample/organize-bag) 호출 시 클라이언트가 Firebase 로그인 토큰(`Authorization: Bearer <idToken>`)을 같이 보내고, 서버가 **Firebase Admin SDK**로 그 토큰을 직접 검증한 뒤 서버가 직접 오늘 사용량을 확인+증가시킴. 클라이언트 SDK를 거치지 않기 때문에 devtools로 더 이상 우회 불가. 새 서버 전용 모듈 `lib/firebaseAdmin.ts`(Admin 앱 초기화), `lib/aiQuotaServer.ts`(토큰 검증+할당량 트랜잭션). `lib/aiUsageService.ts`는 이제 표시(사용량 뱃지)/이용권 코드 입력 UI용으로만 남음 |
| **이용권 코드 위조 방어** | 🐛 v61 보안 강화 | 기존엔 `users/{uid}.unlockCode` 필드가 "존재하기만 하면" 무제한으로 판단했는데, 이 필드는 본인 문서라 devtools로 임의 문자열을 직접 써넣을 수 있었음(진짜 코드인지 검증 안 함). v61부터는 서버가 그 값이 실제 `unlockCodes` 컬렉션에 존재하는 코드인지까지 다시 확인하고, 가짜 값이면 무료 한도로 취급 |
| **필요 환경변수 추가** | ⚠️ 배포 전 설정 필요 | `FIREBASE_SERVICE_ACCOUNT_KEY` (Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → JSON 내용을 한 줄로). 이 값이 없으면 AI 기능 3개가 전부 401로 막힘. `.env.local.example`에 안내 추가됨 |

## v60 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **샘플로 시작하기** | 🆕 v60 신규 | 새 가방 만들기 시트에 "샘플로 시작하기" 옵션 추가. 여행/생활/이벤트/업무 4개 카테고리, 16개 정적 큐레이션 템플릿(`lib/sampleBags.ts`)을 API 호출 없이 즉시 채워줌. "업무" 카테고리의 "팀 할일 보드"는 팩=할일/진행중/완료, 아이템=텍스트형 카드로 구성해서 아이템을 다른 팩으로 드래그하는 기존 기능으로 칸반보드처럼도 쓸 수 있음. 그리드 하단에 "해시태그로 AI에게 만들어달라기" 진입점 배치 |
| **해시태그 AI 생성** | 🆕 v60 신규 | 샘플 목록에 원하는 게 없을 때, 해시태그 최대 3개를 입력하면 AI(Gemini 2.5 Flash-Lite)가 어울리는 가방 이름+팩+아이템을 생성. `app/api/generate-sample/route.ts`. 기존 "클립보드에서 가져오기"와 동일한 결과 형식(`ImportedBagResult`) 재사용 |
| **가방 속 AI 정리** | 🆕 v60 신규 | 가방 편집화면에 "AI로 정리" 버튼 추가. 지금 가방에 있는 아이템들을 AI가 훑어보고 더 어울리는 팩(카테고리)으로 재분류. 항목 문구·체크 상태·타입은 절대 바꾸지 않고(index로만 그룹핑해서 원본 Item 객체를 그대로 재사용) 어느 팩에 속할지만 다시 정함. AI 응답에서 index가 누락되면 "미분류" 팩으로 모아서 데이터 손실이 없도록 방어. 빈 아이템 항목이 있으면 버튼이 비활성화됨(채우거나 삭제 후 이용) `app/api/organize-bag/route.ts` |
| **AI 기능 일일 사용 한도** | 🆕 v60 신규 | 무료 회원은 하루 10회(KST 자정 리셋)로 제한 - 메모/샘플 가져오기, 해시태그 생성, 가방 속 AI 정리 3개 기능이 한도를 공유. 마스터 계정과 "이용권 코드"(10자리 랜덤 대문자+숫자)를 입력한 사용자는 무제한. AI 로딩 중 "오늘 N/10회 사용" 표시, 한도 초과 시 명확한 안내 문구로 차단. `lib/aiUsageService.ts`(Firestore 트랜잭션으로 원자적 확인+증가). 설정 > AI 기능에서 현재 사용량 확인 + 이용권 코드 입력 가능. 마스터 계정은 설정 > 이용권 코드 관리(운영자)에서 코드 생성/조회 가능. **나중에 유료회원 도입 시 코드 없이도 무제한으로 풀 수 있게 `isUnlimitedAiUser`에 조건만 추가하면 되는 구조로 설계함** |
| **firestore.rules 변경분** | ⚠️ 대기 | `unlockCodes` 컬렉션 규칙 추가(코드를 아는 사람은 get만, 마스터는 list+create). Firebase 콘솔에서 재게시 필요 |



| 기능 | 상태 | 비고 |
|---|---|---|
| **샘플로 시작하기** | 🆕 v60 신규 | 새 가방 만들기 시트에 "샘플로 시작하기" 옵션 추가. 여행/생활/이벤트/업무 4개 카테고리, 16개 정적 큐레이션 템플릿(`lib/sampleBags.ts`)을 API 호출 없이 즉시 채워줌. "업무" 카테고리의 "팀 할일 보드"는 팩=할일/진행중/완료, 아이템=텍스트형 카드로 구성해서 아이템을 다른 팩으로 드래그하는 기존 기능으로 칸반보드처럼도 쓸 수 있음. 그리드 하단에 "해시태그로 AI에게 만들어달라기" 진입점 배치 |
| **해시태그 AI 생성** | 🆕 v60 신규 | 샘플 목록에 원하는 게 없을 때, 해시태그 최대 3개를 입력하면 AI(Gemini 2.5 Flash-Lite)가 어울리는 가방 이름+팩+아이템을 생성. `app/api/generate-sample/route.ts`. 기존 "클립보드에서 가져오기"와 동일한 결과 형식(`ImportedBagResult`) 재사용 |
| **가방 속 AI 정리** | 🆕 v60 신규 | 가방 편집화면에 "AI로 정리" 버튼 추가. 지금 가방에 있는 아이템들을 AI가 훑어보고 더 어울리는 팩(카테고리)으로 재분류. 항목 문구·체크 상태·타입은 절대 바꾸지 않고(index로만 그룹핑해서 원본 Item 객체를 그대로 재사용) 어느 팩에 속할지만 다시 정함. AI 응답에서 index가 누락되면 "미분류" 팩으로 모아서 데이터 손실이 없도록 방어. 빈 아이템 항목이 있으면 버튼이 비활성화됨(채우거나 삭제 후 이용) `app/api/organize-bag/route.ts` |
| **AI 기능 일일 사용 한도** | 🆕 v60 신규 | 무료 회원은 하루 10회(KST 자정 리셋)로 제한 - 메모/샘플 가져오기, 해시태그 생성, 가방 속 AI 정리 3개 기능이 한도를 공유. 마스터 계정과 "이용권 코드"(10자리 랜덤 대문자+숫자)를 입력한 사용자는 무제한. AI 로딩 중 "오늘 N/10회 사용" 표시, 한도 초과 시 명확한 안내 문구로 차단. `lib/aiUsageService.ts`(Firestore 트랜잭션으로 원자적 확인+증가). 설정 > AI 기능에서 현재 사용량 확인 + 이용권 코드 입력 가능. 마스터 계정은 설정 > 이용권 코드 관리(운영자)에서 코드 생성/조회 가능. **나중에 유료회원 도입 시 코드 없이도 무제한으로 풀 수 있게 `isUnlimitedAiUser`에 조건만 추가하면 되는 구조로 설계함** |
| **firestore.rules 변경분** | ⚠️ 대기 | `unlockCodes` 컬렉션 규칙 추가(코드를 아는 사람은 get만, 마스터는 list+create). Firebase 콘솔에서 재게시 필요 |

**주의(보안 수준)**: AI 일일 한도는 서버(Admin SDK)가 강제하는 게 아니라 클라이언트가 자기 `users/{uid}` 문서를 Firestore 트랜잭션으로 직접 갱신하는 구조라, 다른 모든 기능과 동일한 신뢰 수준의 소프트 제한입니다. 나중에 어뷰징이 실제 문제가 되면 API 라우트에 Firebase Admin 인증을 추가하는 걸 권장해요.

## v59 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **화면설정 아코디언 기본값 변경** | 🐛 v59 | "글자 크기" / "강조 색상" / "기본 투명도" 3개 섹션만 처음 진입 시 펼쳐진 상태로 시작(자주 쓰는 설정이라 매번 펼치는 게 번거롭다는 피드백). "가방 카드" / "가방 속 팩카드" / "팩 라이브러리 타일"은 기존처럼 접힌 상태로 시작 |
| **화면설정 "기본 투명도"~"가방" 사이 여백 확대** | 🐛 v59 | 두 섹션이 붙어 보이던 문제. `mt-4`(16px) → `mt-10`(40px)로 확대 |
| **App Store 배포 가이드 전면 개정 (Xcode 26 기준)** | 🆕 v59 | `APP_STORE_GUIDE.md`를 2026년 7월/Xcode 26 기준으로 새로 작성. 애플의 2026-04-28 Xcode 26 + iOS 26 SDK 필수화, Xcode 26 설치(App Store/.xip 두 경로), 2026년 스크린샷 규격(iPhone 6.9인치 1320×2868, iPad 13인치 2064×2752로 단순화됨) 등 최신 정보로 갱신. **가장 중요한 추가 항목**: 구글 로그인이 Capacitor(WKWebView) 안에서는 구글 정책상 차단된다는 것(`disallowed_useragent`)을 심사 제출 전 반드시 먼저 해결해야 할 선행 작업(0.5번)으로 명시 — 네이티브 구글 로그인 플러그인(`@capgo/capacitor-social-login` 등)으로 교체 필요, 아직 미착수 |

## v58 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 편집 화면 자동 저장** | 🆕 v58 | 아이템 추가/삭제/수정/순서변경, 팩 이름·색상 변경 등 어떤 변경이든 0.5초 후 자동으로 라이브러리에 저장됨. 기존의 상단 "저장" 버튼은 제거하고, 저장되는 순간 헤더에 잠깐 "저장됨" 텍스트가 옅게 표시됨. 화면을 나갈 때 아직 저장 안 된(디바운스 대기 중) 변경이 있으면 즉시 저장, 단 팩 삭제 흐름 중엔 건너뜀(삭제 후 재생성 경합 방지) |
| **아이템 롱프레스 드래그가 스크롤과 충돌해서 자꾸 풀리던 문제 근본 수정** | 🐛 v58 | `ItemRow`가 `touch-action: pan-y`를 쓰고 있어서, 롱프레스 판정 중이든 이미 드래그가 시작된 후든 세로로 손가락이 움직이면 브라우저가 그 터치를 자체 스크롤로 가져가버려 드래그가 강제로 취소(pointercancel)되던 문제. `touch-action: none`으로 바꿔서 이 요소에서 시작된 터치는 브라우저가 절대 가로채지 못하게 하고, 그 대신 세로로 움직일 때 가장 가까운 스크롤 가능한 조상을 찾아 직접 `scrollTop`을 옮겨서 기존과 동일하게 스크롤되도록 수동 구현. 팩 편집 화면(PackLibraryEditorScreen)과 가방 속 팩카드(PackCard) 양쪽의 아이템 드래그(같은 팩 내 순서변경 포함) 모두에 적용됨 |

## v57 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 편집 화면 입력창 포커스 시 헤더가 화면 밖으로 밀리던 문제 재수정** | 🐛 v57 | v52/v53에서 시도한 `visualViewport` 높이 반영만으로는 iOS(WKWebView 포함)가 입력창을 보여주려고 페이지 자체를 스크롤(팬)시키는 동작까지는 막지 못해서 여전히 헤더가 밀려 올라가고 입력창과 키보드 사이에 빈 공간이 생기던 문제. `visualViewport`의 `resize`/`scroll` 이벤트마다 `window.scrollTo(0, 0)`을 반복 호출(rAF + 지연 재호출 포함)해서 브라우저의 자체 스크롤 보정을 계속 취소하도록 보강. 입력창 `onFocus`에도 동일한 취소 로직 추가 |
| **팩 편집 화면 입력창 하단 여백 추가 확대** | 🆕 v57 | `max(22px, safe-area+10px)` → `max(26px, safe-area+14px)` |
| **하단 탭바 세로 여백 소폭 축소** | 🐛 v57 | 위 키보드 문제와는 무관한 별개 이슈(앱 실행 즉시 항상 나타남). v25에서 의도적으로 확대했던 크기가 다소 과했다는 피드백으로 상단 패딩(pt-2.5→pt-2), 좌우 버튼 세로 패딩(19px→15px), 하단 안전영역 패딩(14px→9px) 소폭 축소. 가운데 홈 버튼(FAB) 크기는 변경 없음 |

## v53 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **안전 영역(env(safe-area-inset-*)) 값이 항상 0으로 처리되던 근본 원인 수정** | 🐛 v53 | 뷰포트에 `viewport-fit=cover`가 빠져있어서, 하단 탭바/팩 편집 입력창 등에 이미 넣어뒀던 `env(safe-area-inset-bottom)` 코드가 전부 무시되고 항상 0으로 계산되고 있었음(코드는 맞았지만 전제 조건이 빠져있던 문제). `app/layout.tsx`의 viewport 설정에 `viewportFit: "cover"` 추가로 실제 안전 영역 값이 반영되게 수정 - 팩 편집 화면 입력창 하단 잘림뿐 아니라 하단 탭바 등 기존 안전영역 코드 전부가 함께 정상화됨 |
| **입력창 포커스 시 키보드가 상단 내용까지 밀어올리던 문제 추가 수정** | 🐛 v53 | v52에서 시도한 `html`/`body` 스크롤 잠금만으로는 부족했던 부분을 보강: (1) 뷰포트에 `interactiveWidget: "resizes-content"` 추가로 최신 브라우저가 키보드를 오버레이 대신 레이아웃 축소로 처리하게 함 (2) `visualViewport` API로 실제 보이는 화면 높이를 감지해서 `--app-vh` CSS 변수로 반영하는 JS 보강 장치 추가 - `interactiveWidget`/`dvh`를 완전히 지원하지 않는 구형 iOS 웹뷰(Capacitor 포함)에서도 동작하도록 이중 안전장치 구성 |
| **화면설정 아코디언 간격/터치 영역 개선** | 🐛 v53 | 섹션 제목들이 다닥다닥 붙어있어 누르기 어렵던 문제. 헤더 버튼에 세로 패딩(터치 영역 확대)과 구분선을 추가하고, "화면설정" 타이틀 아래·"가방"/"팩" 그룹 제목 위 여백도 넉넉하게 조정 |

## v52 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **입력창 포커스 시 화면 전체가 밀려서 위 내용이 안 보이던 문제 수정** | 🐛 v52 | 앱 전체가 `h-dvh`(키보드 감지되는 뷰포트 높이)를 쓰고 있었는데도, `html`/`body`에 스크롤 잠금이 없어서 입력창 포커스 시 브라우저(특히 iOS)가 페이지 전체를 스크롤해버리던 문제. `html`/`body`에 `overflow: hidden`을 걸어서, 스크롤은 항상 화면 안의 지정된 영역에서만 일어나고 키보드는 `h-dvh` 축소로만 반영되게 수정(앱 전체 공통 수정 - 다른 입력창 있는 화면들도 함께 개선됨) |
| **팩 편집 화면 입력창 하단 여백 부족(잘림) 수정** | 🐛 v52 | 아이폰 하단 안전 영역(홈 인디케이터)을 고려한 여백이 없어서 입력창이 잘려 보이던 문제. 하단 탭바와 동일한 방식(`env(safe-area-inset-bottom)`)으로 여백 추가 |
| **팩 편집 화면 체크박스/텍스트 모드 선택 UI 개선** | 🐛 v52 | 배지 하나를 탭해서 토글하는 방식이라 지금 뭐가 선택된 상태인지, 탭하면 바뀐다는 것 자체가 직관적이지 않았음. "체크박스"/"텍스트" 두 옵션을 나란히 보여주고, 선택된 쪽은 굵은 글씨+확대+강조색으로, 선택 안 된 쪽은 옅게 표시하도록 변경 |
| **팩 편집 화면(채팅형)에도 아이템 드래그 순서변경 지원** | 🆕 v52 | "가방 속 팩"과 동일하게, 체크박스를 제외한 영역을 롱프레스(그립 아이콘 없음, 복사/선택 팝업 방지)하면 드래그가 시작되고, 원하는 위치에 놓으면 순서가 바뀜. 이 화면은 팩이 하나뿐이라 "다른 팩으로 이동"은 없고 같은 팩 안 순서변경만 지원 |
| **화면설정에 아코디언(접기/펼치기) 적용** | 🆕 v52 | 조절 항목이 많아져(글자 크기/강조 색상/기본 투명도/가방 카드/가방 속 팩카드/팩 라이브러리 타일) 화면이 복잡해 보이던 문제. 각 섹션 제목은 항상 보이고, 탭하면 그 아래 실제 조절 UI(색상 원·슬라이더·미리보기)가 펼쳐지고 다시 탭하면 접힘. 처음 진입 시 전부 접힌 상태로 시작 |
| **엣지 스와이프 뒤로가기를 모든 하위 화면에 확대 적용** | 🆕 v52 | 기존엔 가방 편집 화면에만 있던 "화면 왼쪽 끝에서 오른쪽으로 스와이프하면 뒤로가기" 제스처(`lib/useSwipeBack.ts`)를, 설정의 모든 하위 화면(화면설정, 팩 설정, 프로필 수정, 버전 정보, 오픈소스 라이선스, 공지사항 관리)과 팩 편집 화면까지 전부 확대 적용 |

## v51 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **화면설정 구조 개편: "가방" / "팩" 메뉴로 재편** | 🆕 v51 | 기존 "가방 그리드"/"팩 그리드" 2개 섹션을 "가방" 메뉴(가방 카드 + 가방 속 팩카드 2개 그룹) + "팩" 메뉴(팩 라이브러리 타일)로 재구성. "가방 크기"→"내용 크기", "팩 크기"→"카드 크기"로 명칭 변경(가방 카드/팩 라이브러리 타일은 테두리는 고정이고 내용만 커지는 반면, 가방 속 팩카드는 실제 세로 길이 자체가 커져서 성격이 다름을 반영) |
| **팩 라이브러리 타일 색상/투명도/크기 완전 분리** | 🆕 v51 | 지금까지 "팩 탭" 목록 타일(PackTile)이 "가방 속 팩카드"와 같은 설정값(`--pack-card-scale`/`--pack-card-bg`)을 그냥 같이 쓰고 있어서 따로 조절이 안 됐음. 완전히 독립된 값(`--pack-library-card-scale`/`--pack-library-card-bg`)으로 분리해서, 화면설정 > 팩 메뉴에서 팩 라이브러리 타일만 별도로 커스텀 가능 |
| **팩 편집 화면(PackLibraryEditorScreen) 전면 개편: 채팅형 UI** | 🆕 v51 | 그리드+카드 스타일을 버리고, 하단에 고정된 입력창으로 아이템을 입력해서 추가하는 채팅방 스타일로 전면 재작성. 입력창 위 모드 배지(기본 "체크박스")를 탭하면 "텍스트" 모드로 전환되고, 텍스트 모드일 땐 굵게/취소선/색상 서식 옵션이 나타남. 입력 후 오른쪽 화살표(전송) 버튼을 누르면 목록 맨 아래(입력창 바로 위)에 추가되고 자동 스크롤됨. 이미 추가된 아이템들은 auto-fit 그리드로 반응형 재배치(1개=한 줄, 늘어날수록 여러 열)되며, 기존과 동일하게 오른쪽 스와이프=수정/왼쪽 스와이프=삭제로 조작 가능. 팩 라이브러리 목록 자체(여러 팩이 보이는 타일 그리드)는 변경 없음 |
| **아이템 수정 버튼 색상을 강조 색상과 무관하게 고정** | 🐛 v51 | 수정 버튼이 "강조 색상"을 그대로 썼던 탓에, 강조 색상을 빨간 계열로 설정해두면 삭제 버튼(항상 빨강)과 헷갈릴 수 있었음. 강조 색상 설정과 무관하게 수정 버튼은 항상 고정된 파란색(#2563eb)을 쓰도록 변경 |
| **아이템 스와이프 버튼(수정/삭제) 크기 축소** | 🆕 v51 | 버튼 폭 72px → 60px로 축소, 스와이프 임계값도 비례해서 조정 |
| **팩 안에서 아이템 순서 변경(같은 팩 내 재배치) 지원** | 🆕 v51 | 지금까지는 아이템을 다른 팩으로 옮기는 것만 되고, 같은 팩 안에서 순서만 바꾸는 건 무시되고 있었음(코드에 `fromPackId === toPackId면 return` 처리돼있었음). 드래그 중 어느 아이템 위에 있는지까지 감지해서, 같은 팩 안에서도 원하는 위치로 순서를 바꿀 수 있게 추가. 드롭 대상 아이템에는 강조 색상 테두리로 하이라이트 표시 |
| **아이템 드래그 시작 방법 변경: 그립 아이콘 제거 → 롱프레스** | 🆕 v51 | 왼쪽 그립(≡) 아이콘이 작아서 잘 안 눌리는 문제로, 그립 아이콘을 완전히 제거하고 체크박스를 제외한 영역(텍스트 포함)을 약 0.4초 이상 움직임 없이 누르고 있으면 드래그 모드로 진입하도록 변경. 브라우저의 텍스트 선택/복사 팝업이 뜨지 않도록 함께 방지 처리. 짧게 누르거나 옆으로 움직이면 기존처럼 스와이프(수정/삭제)로 인식됨 |

## v50 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 미리보기 가로로 눌려보이던 문제 수정 (실제 폭은 유지)** | 🐛 v50 | 원인은 폭이 아니라 높이였음 - 아이템 목록 영역에 실제 PackCard가 쓰는 고정 높이 공식(180px/228px*팩크기)을 안 넣고 임의로 짧게 잡아서, 실제 폭 그대로인데도 비율이 가로로 퍼진 것처럼 보였음. 높이 공식을 실제와 동일하게 맞춰서 해결 - 폭은 계속 실제와 동일(모바일 100%, 데스크톱 2열 폭) |
| **가방/팩 그리드 미리보기 가운데 정렬 (실제 폭 유지한 채로)** | 🆕 v50 | 이전엔 "빈 칸으로 나머지 열을 채우는" 방식이라 카드가 항상 왼쪽에 붙어 보였음. 대신 실제 그리드가 계산하는 폭 자체를 calc()로 직접 구해서 카드 하나만 렌더링하고 가운데 정렬 - 실제와 동일한 폭은 그대로 유지됨 |
| **가방/팩 그리드 미리보기의 좌우 2색(흰/회색) 배경 제거** | 🆕 v50 | 인위적인 비교용 배경 대신, 설정 섹션 박스 자체의 배경(옅은 회색, 기본 투명도 적용 대상) 위에 바로 놓이도록 변경. 투명도 조절 시 이 배경에 비쳐 보이는 정도로 충분히 확인 가능. 기본 투명도 섹션 자체의 예시는 기존 좌우 2색 배경 그대로 유지 |

## v49 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방/팩 그리드 미리보기 크기를 실제와 진짜로 동일하게 수정** | 🐛 v49 | v46에서 "패딩·글자 크기 공식"은 맞췄지만 정작 카드 폭/모양(정사각형 여부)은 임의의 작은 고정폭(136px)이라 실제 카드와 비율이 완전히 달라 보였던 문제. 가방 미리보기는 실제 홈 화면과 동일한 grid-cols-2 sm:grid-cols-3 그리드를 그대로 써서 진짜와 같은 폭의 정사각 카드로, 팩 미리보기는 실제 가방 화면(모바일 기준 전체 폭)과 동일한 폭+실제 PackCard 구조(이름·아이템 목록·구분선·개수)로 재구성. 설정 화면 박스 안에 중첩된 패딩만큼은 어쩔 수 없이 실제보다 살짝 좁게 보이지만, 비율/모양/글자·여백 배율은 실제와 동일하게 맞춰짐 |

## v48 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **화면설정 가방/팩 그리드 미리보기를 가운데 정렬** | 🐛 v48 | 좌우 2색 배경으로 투명도를 비교하려고 만든 건데, 미리보기 카드가 왼쪽에 붙어있어서 흰색 쪽에만 걸치고 회색 쪽엔 안 걸쳐 비교가 안 되던 문제. 카드를 가운데로 옮겨서 두 배경에 걸쳐 보이게 수정 |
| **그룹원 프로필(닉네임/아바타) 동기화 방식 전면 변경** | 🐛 v48 | v47에서는 프로필을 "수정할 때" 가입된 모든 가방을 검색해서 한꺼번에 스냅샷을 덮어쓰는 방식이었는데, 이미 예전에 참여해서 한 번도 갱신 안 된 가방은 그 시점 이후로도 계속 예전 정보가 남아있는 근본적인 한계가 있었음(v47 배포 이전에 프로필을 바꾼 사람은 여전히 안 고쳐짐). 방식을 바꿔서, 이미 실시간으로 구독 중인 가방 목록을 기준으로 "내 스냅샷이 최신 프로필과 다른 가방"만 그때그때 가볍게 고쳐쓰도록 변경(`lib/bagsService.ts`의 `updateMemberProfileSnapshot` + `components/AppShell.tsx`의 자동점검 로직). 앱을 열어서 가방 목록이 로딩되는 순간 자동으로 점검되므로, 예전에 바꿔둔 프로필도 소급 적용되고 별도의 추가 조회(쿼리) 비용도 들지 않음 |

## v47 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **화면설정 섹션 박스 배경도 "기본 투명도" 적용 대상에 포함** | 🐛 v47 | 강조 색상/기본 투명도/가방 그리드/팩 그리드 각 섹션을 감싸는 옅은 회색 박스 배경이 `--surface`를 쓰고 있어서 기본 투명도 슬라이더에 반응하지 않던 문제. `--surface-2`로 통일해서 이제 이 박스들도 기본 투명도에 맞춰 투명해짐 |
| **프로필(닉네임/아바타) 수정 후 그룹원·초대코드 화면에 반영 안 되던 문제 수정** | 🐛 v47 | 가방마다 멤버의 닉네임/아바타를 "참여 시점 스냅샷"(`memberProfiles`)으로 따로 저장해두는데, 프로필을 나중에 수정해도 이미 참여해둔 가방들의 스냅샷은 갱신되지 않던 문제. 이제 설정 > 프로필에서 닉네임/아바타를 바꾸면, 내가 속한 모든 가방의 스냅샷도 함께 최신화됨(`lib/bagsService.ts`의 `syncMemberProfileAcrossBags`) |

## v46 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방/팩 그리드 미리보기 크기를 실제 카드와 동일한 값으로 수정** | 🐛 v46 | v45에서 추가한 미리보기가 임의의 px 값을 써서 실제 BagCard/PackCard의 패딩·글자 크기와 달랐던 문제. 이제 정확히 같은 calc() 공식(가방: 12/16px 패딩+13/14px 글자, 팩: 14/20px 패딩+17/18px 글자)을 써서, "가방 크기"/"팩 크기" 슬라이더를 움직였을 때 미리보기가 실제 화면과 동일한 비율로 커지고 작아짐 |
| **투명도 미리보기 배경을 체크무늬 → 좌우 2색 배경으로 변경** | 🐛 v46 | 체크무늬가 산만하다는 피드백으로, 밝은 배경/살짝 어두운 배경이 좌우로 나뉜 단순한 배경으로 교체. 예시 요소가 그 경계를 가로질러 놓여서, 투명도를 낮출수록 좌우로 다르게 비쳐 보이는 게 더 깔끔하게 보임 (기본 투명도, 가방 그리드, 팩 그리드 미리보기 전부 동일하게 적용) |

## v45 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **화면설정 커스텀 항목에 실시간 미리보기 추가** | 🆕 v45 | 강조 색상(예시 버튼/뱃지), 기본 투명도(체크무늬 배경 위 예시 배지), 가방 그리드(미니 가방카드), 팩 그리드(미니 팩카드) 각 섹션 슬라이더/색상 바로 아래에 예시가 표시됨. 실제 CSS 변수를 그대로 참조해서 값을 바꾸면 저장 없이 바로 반영됨 |
| **명칭 변경: "가방 색상" → "가방 그리드", "팩 그리드 색상" → "팩 그리드"** | 🆕 v45 | 화면설정 화면의 섹션 제목만 변경, 기능/저장 필드명은 기존 그대로 |
| **설정 메뉴 그룹 재정리** | 🆕 v45 | "화면설정"+"팩 설정"을 공지사항/자주묻는질문처럼 하나의 박스로 묶고 위에 "설정" 라벨 추가. "공지사항"+"자주 묻는 질문"+"문의하기"도 하나의 박스로 묶고 위에 "고객지원" 라벨 추가 |

## v44 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **화면설정 > 강조 색상 아래에 "기본 투명도" 슬라이더 신규 추가** | 🆕 v44 | 하단 탭바 배경, 팩/가방 정렬(필터) 버튼 배경, 아이템(체크항목·텍스트) 배경, 설정 화면들의 "선택 안 된" 버튼 배경(화면 모드·시작 화면·글자 크기 등)까지 전부 `--surface-2`라는 공통 배경 변수를 쓰도록 통일하고, 이 변수에 투명도(0~100%, 기본 100%)를 한 번에 적용. 낮출수록 페이지 배경이 비쳐 보임(가방/팩 색상 투명도와 동일한 `color-mix()` 방식). 하단 탭바·정렬 버튼·설정 화면 토글 버튼은 기존엔 `--surface`(옅은 배경)를 쓰고 있었는데, 아이템 배경 등과 같은 톤으로 맞추기 위해 `--surface-2`로 통일함(색상 차이는 미세함) |
| **가방/팩 카드 투명도·크기 설정이 다른 기기로 동기화 안 되던 문제 수정** | 🐛 v44 | 계정에는 정상적으로 저장되고 있었지만, Firestore에서 값을 불러올 때 정작 앱 프로필 객체에 담아주는 부분이 빠져있어서 다른 기기에서 로그인해도 이 값들이 항상 기기 로컬 기본값으로만 보이던 문제. 기본 투명도 기능을 추가하며 같은 동기화 로직을 다시 점검하다가 함께 발견 → 수정 |

## v43 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **아이템 항목 편집 방식 변경: 탭 → 왼쪽 스와이프** | 🐛 v43 | 기존엔 아이템(체크항목/텍스트) 텍스트를 탭하면 바로 편집모드로 들어가서, 스크롤/실수 탭에도 편집창이 자꾸 열려 불편했음. 이제 아이템을 **오른쪽으로 스와이프**하면 왼쪽에 파란색 "수정" 버튼이 나오고, 이걸 눌러야 편집모드로 들어감. 텍스트를 그냥 탭하는 것만으로는 더 이상 편집되지 않음(스와이프가 열려있는 상태에서 탭하면 닫히기만 함). 기존처럼 **왼쪽으로 스와이프**하면 오른쪽에 빨간색 "삭제" 버튼이 나오는 동작은 그대로 유지 |
| **삭제/수정 버튼 세로 길이가 옆 항목 줄 수에 맞춰 늘어나던 문제 수정** | 🐛 v43 | 아이템 그리드가 같은 줄(그리드 row)에 1줄짜리 항목과 2줄짜리 항목이 같이 있을 때, 1줄짜리 항목도 그리드가 줄 전체 높이만큼 늘려서 스와이프 버튼(삭제/수정)이 실제 텍스트 높이보다 길게 나오던 문제 수정. 그리드 정렬을 각 항목이 자기 내용 높이만큼만 차지하도록 변경(`align-items: start`) |
| **화면설정 > 팩 그리드 색상/투명도/팩 크기가 팩 라이브러리에는 반영 안 되던 문제 수정** | 🐛 v43 | 지금까지 이 설정들은 "가방 속 팩 카드"에만 적용되고, "팩 라이브러리" 화면(목록 타일 + 팩 편집 화면)은 항상 고정된 배경/크기로 보였음. 팩 라이브러리 목록 타일(PackTile)과 팩 편집 화면의 아이템 그리드 모두 가방 속 팩 카드와 동일한 배경 변수(팩 그리드 색상/투명도)·크기 배율(팩 크기)을 쓰도록 통일 |

## v42 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **하단 탭바 팩/설정 아이콘 확대** | 🆕 v42 | 25px → 30px (가운데 홈 버튼 42px보다는 작게) |
| **설정 > "색상" 화면을 "화면설정"으로 개편** | 🆕 v42 | 메뉴명 "색상 (강조 · 가방 · 팩 그리드)" → "화면설정". 기존에 메인 설정 화면에 있던 "글자 크기"를 이 화면 맨 위로 이동 |
| **가방 색상 / 팩 그리드 색상에 투명도 조절 추가** | 🆕 v42 | 각 색상 섹션 하단에 투명도 슬라이더(0~100%, 기본 100%=완전 불투명) 추가. "기본(점선 원)" 색상을 선택했을 때도 적용되며, 낮출수록 카드 뒤 페이지 배경(라이트=흰색·다크=검정 계열)이 비쳐 보임. `color-mix()`로 구현해서 프리셋/커스텀 색상 모두 동일하게 동작. 강조 색상에는 투명도 슬라이더 없음(요청대로 제외) |
| **가방 크기 / 팩 크기 조절 추가** | 🆕 v42 | 가방 색상 섹션엔 "가방 크기", 팩 그리드 색상 섹션엔 "팩 크기" 슬라이더 각각 추가 (70~130%, 기본 100% = 지금 크기 그대로, v41에서 20% 키운 이후 크기 기준). 카드 안 여백·아이콘·아이템 칸 그리드 크기·글자 크기를 함께 배율 조절. 카드 전체를 zoom으로 확대하는 방식 대신, 팩/아이템 20% 확대 때와 같은 원리(개별 요소 크기를 CSS 변수 배율로 계산)로 구현 - 그리드 레이아웃이 깨질 위험이 없음. 글자 크기는 "설정 > 글자 크기"(작게/보통/크게) 배율과 곱해져서 같이 적용됨 |

## v41 추가 수정 (같은 날, 후속 반영)

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 저장 시 "다른 가방에서 이미 바뀐 팩" 충돌 감지** | 🐛 v41 | 같은 라이브러리 팩(A)을 1번가방·2번가방 양쪽에서 쓰고 있을 때: 2번가방에서 A를 덮어쓴 뒤 1번가방에서 저장 아이콘을 누르면, 예전엔 "1번가방이 직접 수정한 것"과 "남(2번가방)이 먼저 라이브러리를 바꿔놓은 것"을 구분 못 해서 실수로 "덮어쓰기"를 누르면 2번가방의 변경사항이 사라질 위험이 있었음. Pack에 `linkedLibraryUpdatedAt`(마지막 동기화 시점의 라이브러리 updatedAt) 필드를 추가해서, 저장 시점에 라이브러리 쪽 updatedAt이 그보다 최신이면 "다른 가방에서 이미 이 팩이 변경됐어요" 경고를 띄우고 **덮어쓰기 버튼을 숨김** (새롭게 저장만 가능) |
| **저장 아이콘 상태를 "지금 이 순간" 기준으로 다시 계산** | 🐛 v41 | 기존엔 팩을 직접 수정할 때만 저장 아이콘 상태(꽉 찬/테두리)를 다시 계산해서, 다른 가방이 라이브러리를 바꿔도 이 가방을 계속 보고 있으면 아이콘이 예전 상태로 잘못 남아있을 수 있었음. 이제는 화면에 보이는 라이브러리 데이터(`libraryPacks`, 실시간 구독 중)를 기준으로 렌더링할 때마다 매번 다시 계산해서, 라이브러리가 바뀌면 아무것도 안 눌러도 아이콘이 바로 정확한 상태로 보임 |
| **글자 크기 설정이 데스크톱 폭(md: 반응형 텍스트)엔 적용 안 되던 문제 수정** | 🐛 v41 | 아이템 텍스트 등 일부 요소는 `text-[17px] md:text-[18px]`처럼 화면 크기별로 다른 글자 크기를 쓰는데, 글자 크기 설정 오버라이드가 기본(모바일) 크기만 잡고 `md:` 반응형 크기는 놓치고 있었음. 데스크톱 폭 브레이크포인트(48rem)에서도 동일하게 배율이 적용되도록 오버라이드 규칙 추가 |

## v41 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 저장 UX 전면 개편 (북마크 → 저장 아이콘)** | 🆕 v41 | 기존엔 북마크를 한 번 채우면 다시 눌러도 아무 반응이 없어서(비활성화) "저장이 안 되는 건가/삭제가 왜 안 되지" 혼란을 유발했음. 아이콘을 저장(💾) 아이콘으로 바꾸고, 상태별로 다르게 동작하도록 개선: ① **아직 라이브러리에 저장한 적 없는 팩** → "팩을 저장하시겠습니까? 다음에 다시 꺼내 쓸 수 있어요" 확인 다이얼로그 → 확인 시 저장 ② **저장은 했지만 그 이후로 수정된 팩** → "팩을 수정하시겠습니까?" + 취소/새롭게 저장/덮어쓰기 3버튼 다이얼로그. "새롭게 저장"은 라이브러리에 새 팩을 만들고 가방 속 팩을 그 새 팩과 연결(이후 동기화 기준이 새 팩으로 바뀜). "덮어쓰기"는 기존에 연결된 라이브러리 팩 내용 자체를 지금 상태로 갱신 ③ **라이브러리와 완전히 동일한(수정 안 한) 팩** → 다이얼로그 없이 "변경사항이 없어요" 토스트만 표시 |
| **가방 실시간 동기화 점검** | ✅ 확인 (변경 없음) | 가방 제목/메모/디데이/팩·아이템 내용 전부 `bag` state 하나로 관리되며, 마지막 변경 후 0.5초 뒤 자동으로 서버 저장 + 다른 멤버 화면에도 실시간 반영되는 구조가 이미 정상 동작 중임을 코드 재확인 (v33에서 도입, 변경 불필요) |
| **팩/아이템 크기 20% 확대** | 🆕 v41 | 팩 카드 안 아이콘(저장/새로고침/삭제/전체선택/드래그핸들)·이름·개수 텍스트, 아이템 체크박스·텍스트·굵게/취소선/색상 버튼, 아이템 영역 그리드 최소 크기·높이, 카드 여백까지 전반적으로 약 20% 확대. 아이콘/여백은 손대지 않고 글자만 키우는 아래 "글자 크기" 설정과는 별개로, 팩·아이템 자체의 기본 크기를 키운 것 |
| **글자 크기 설정: 화면 확대(zoom) → 텍스트 전용 배율로 변경** | 🐛 v41 | 기존엔 "작게/보통/크게"가 CSS `zoom`으로 화면 전체를 확대·축소해서 아이콘/여백/레이아웃까지 다 같이 커지는 방식이었음. 이제는 오직 글자 크기(font-size)만 변경되고 아이콘/버튼 크기·여백·레이아웃은 그대로 유지됨. 설정 화면의 "작게/보통/크게" 버튼 자체도 각각 실제 배율이 적용된 글씨체로 보여서, 누르기 전에 얼마나 커지고 작아지는지 미리 확인 가능 |

## v40 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방 편집 화면 상단 버튼 터치 영역 확대** | 🐛 v40 | 뒤로가기/그룹원 관리/삭제 아이콘 버튼에 여백(패딩)을 추가해 터치 영역을 넓힘 (아이콘 자체 크기도 20→22px, 19→20px, 18→19px로 소폭 확대). "저장" 버튼도 좌우/상하 여백을 늘려 더 크게. 시각적 위치·레이아웃은 그대로 유지하고 탭 가능한 범위만 넓어짐(음수 마진으로 상쇄) |
| **가방 편집 화면: 왼쪽 끝에서 오른쪽으로 스와이프하면 뒤로가기** | 🆕 v40 신규 | iOS의 엣지 스와이프 뒤로가기와 동일한 느낌. 화면 왼쪽 끝 24px 안에서 시작한 터치만 인식하고, 90px 이상 밀어야 실제로 뒤로가기가 실행됨(살짝 스친 정도로는 반응 안 함). 세로로 크게 움직이면(스크롤 의도로 판단) 자동 취소. Pointer Events 기반이라 iOS/Android/데스크톱 웹 모두 동일하게 동작 (`lib/useSwipeBack.ts`, 재사용 가능한 훅으로 분리해둠 - 다른 화면에도 필요하면 쉽게 추가 가능) |

## v39 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **AI 분석 시 Gemini 503(과부하)/429(요청 몰림) 자동 재시도** | 🆕 v39 | Gemini가 일시적으로 "This model is currently experiencing high demand" (503 UNAVAILABLE)나 429를 반환하는 경우, 서버(API 라우트)에서 0.9초 → 1.8초 대기 후 최대 2번까지 자동 재시도. 그래도 실패하면 "지금 AI 요청이 많이 몰려서 응답을 못 받았어요. 잠시 후 다시 시도해주세요" 같은 원인이 드러나는 안내 문구로 응답 (기존엔 뭉뚱그려 "AI 분석 중 문제가 발생했어요"만 나왔음). 이 오류는 Gemini 쪽 일시적 과부하라 우리 쪽 설정 문제는 아니고, 재시도로 대부분 자연 해결됨 |

## v38 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **초대코드 참여 시 "Missing or insufficient permissions" 오류 수정** | 🐛 v38 긴급수정 | 원인: `joinBagByCode`가 참여(쓰기) 전에 `bags/{bagId}` 문서를 먼저 `getDoc`으로 읽어서 "이미 참여중인지/인원 다 찼는지" 미리 확인하고 있었는데, firestore.rules상 가방 read는 **이미 멤버인 사람만** 가능해서 아직 멤버가 아닌 참여자는 이 사전 조회 단계에서부터 막혔음(서버리스 API를 안 거치고 클라이언트에서 Firestore SDK로 직접 붙는 요청이라 Vercel 로그에도 안 남음). 사전 조회를 없애고 곧바로 `updateDoc(arrayUnion)`으로 참여를 시도하도록 변경 - 인원 초과/가방 삭제 등의 검증은 firestore.rules가 그대로 서버 측에서 담당. firestore.rules 자체는 변경 없음 |

## v37 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **팩 색상 변경 시 팩 리스트 카드 배경도 함께 반영** | 🐛 v37 | 지금까지 팩 색상은 작은 점(dot) 표시에만 쓰였음. 이제 팩 카드(가방 안 PackCard) 및 팩 라이브러리 카드(PackTile) 배경에도 해당 색의 옅은 톤(15% 알파)이 함께 적용됨. 색을 지정하지 않은 팩은 기존처럼 "팩 그리드 색상"(또는 기본 배경) 유지 |
| **"여행 날짜 설정 +" → "디데이 추가 +"로 명칭 변경** | 🆕 v37 | |
| **팩 드래그 앤 드롭으로 순서 변경** | 🆕 v37 신규 | 팩 카드 좌측 상단에 드래그 핸들(::: 아이콘) 추가. 아이템 드래그(팩→팩 이동)와 별개 기능이며, 잡아서 다른 팩 위에 놓으면 그 자리로 순서가 바뀜. 드래그 중인 카드는 반투명 처리, 드롭 대상은 테두리 강조 |
| **새 가방 만들기: "메모에서 가져오기" → "클립보드에서 가져오기"로 개편** | 🆕 v37 | 버튼명 변경 + 설명 문구를 "메모장에서 복사한 내용을 붙여넣으면 AI가 자동으로 분류해줘요"로 변경 + 아이콘을 노트(📝)에서 AI 반짝임(✨) 아이콘으로 교체 |
| **AI 가져오기 색상 - 강조 색상과 연동** | 🆕 v37 | "클립보드에서 가져오기" 버튼의 배경/아이콘/글자색이 설정 > 색상 > 강조 색상 값을 그대로 따라감(별도 커스텀 항목 아님). 강조 색상을 바꾸면 이 버튼 색도 함께 바뀜 |

## v36 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **"가방"/"팩" 목록 화면 제목 확대 + 볼드** | 🆕 v36 | 18px medium → 22px bold |
| **가방 목록: "코드로 참여" 버튼 위치 변경** | 🆕 v36 | 제목 줄에서 분리해서 정렬(SortSelect) 버튼과 같은 줄, 좌우 배치(참여 버튼 왼쪽 / 정렬 오른쪽)로 이동. 가방이 하나도 없어도 항상 노출(정렬 버튼은 가방 있을 때만) |
| **설정 > 색상 화면 신설 (강조/가방/팩 그리드 색상 각각 커스텀)** | 🆕 v36 신규 | 기존 설정 화면에 바로 있던 "강조 색상"을 "색상" 메뉴 하나로 빼고, 들어가면 강조 색상 · 가방 색상 · 팩 그리드 색상 3개를 각각 프리셋 9색 + 커스텀 헥스로 독립 설정. 가방/팩 그리드 색상은 "기본값(점선 원)"을 고르면 원래의 무채색 카드 배경으로 복귀. 계정에 저장되어 기기 간 동기화 |
| ㄴ 가방 색상 적용 범위 | 📌 확정 | 가방 카드(BagCard) 배경 전체 톤 |
| ㄴ 팩 그리드 색상 적용 범위 | 📌 확정 | 가방 안 팩 카드(PackCard) 배경 전체 톤 |

## v35 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **iOS Safari "홈 화면에 추가" 안내 배너** | 🆕 v35 신규 | 로그인 화면 + 메인 화면 하단에 얇은 배너로 노출. iOS + Safari + 미설치 상태일 때만 "공유 버튼 → 홈 화면에 추가" 안내. 카카오톡/인스타그램 등 인앱브라우저에서는 "Safari로 열어주세요" 안내로 문구가 달라짐. 이미 설치됐거나(standalone) Capacitor 네이티브 앱에서는 노출 안 됨. 닫으면 7일간 다시 안 뜸 |

## v34 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **프로필 수정 화면 하단 버튼이 플로팅 백팩 버튼에 가려지던 문제 수정** | 🐛 v34 | "로그아웃"/"회원 탈퇴" 버튼이 하단 탭바의 튀어나온 백팩 버튼(위로 44px 겹침)에 가려 잘려 보이던 문제. 버튼 영역 하단 여백을 늘려서 안 가리게 수정 |
| **로그아웃 / 회원 탈퇴 버튼에 은은한 테두리 스타일 적용** | 🆕 v34 | 텍스트만 덩그러니 있던 걸 옅은 테두리 + 배경의 버튼 형태로 변경해서 탭 가능한 요소로 인지되게 개선 |
| **"비밀번호" 라벨 / "변경하기" 버튼이 양쪽 끝에 붙어 어색하던 부분 수정** | 🐛 v34 | "변경하기"를 플레인 텍스트 링크에서 은은한 테두리 버튼(칩) 형태로 변경 |

## v33 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **가방 편집 화면 실시간 자동저장 + 동기화** | 🆕 v33 신규 | 체크박스뿐 아니라 이름/메모/아이템 추가·삭제·수정/팩 구조 변경 등 가방 안의 모든 변경이 마지막 변경 후 0.5초 뒤 자동으로 서버에 저장됨. 같은 가방을 보고 있는 다른 멤버 화면에도 그 변경이 실시간으로 반영됨. "저장" 버튼은 그대로 남아있고 누르면 대기 중인 자동저장을 즉시 확정. 체크박스를 연속으로 눌러도(광클) 0.5초 디바운스로 묶여서 서버에는 최종 상태 한 번만 저장됨 |
| ~~체크박스만 즉시 저장~~ | ⛔ 대체됨 | 위 자동저장 기능으로 대체(범위 확장) |

**참고 (한계)**: Firestore 문서 하나를 통째로 덮어쓰는 방식이라, 두 사람이 몇 백 ms 사이에 서로 다른 부분(예: 한쪽은 이름 변경, 다른 쪽은 팩 추가)을 동시에 편집하면 나중에 저장된 쪽이 이길 수 있음(완전한 동시편집 병합은 아님). 로컬에 아직 저장 안 보낸 변경이 있는 동안엔 들어오는 원격 변경을 건너뛰어서 내 변경을 잃지 않도록 처리했지만, 여러 명이 동시에 빠르게 편집하는 상황까지 완벽히 막지는 못함.



| 기능 | 상태 | 비고 |
|---|---|---|
| 하단 홈 버튼 확대 | 🆕 v27 | 68px→92px, 흰 테두리+그림자로 FAB처럼 튀어나와 보이게. (v28에서 "홈" 텍스트 라벨은 요청에 따라 제거, 아이콘만 유지) |
| **커스텀 강조 색상 - iOS에서 색상 선택 안 되던 버그 수정** | 🐛 v29 | 원인: 네이티브 `<input type="color">`가 iOS Safari/홈화면 PWA(standalone)에서 다이얼로그 자체가 안 열리는 WebKit 이슈. 웹/iOS PWA/향후 Capacitor 앱(iOS·iPad·Mac·Android) 전부 동일하게 동작하도록 앱 안에서 직접 그리는 커스텀 피커(채도·명도 사각형 + 색상 슬라이더 + 헥스코드 입력)로 완전 교체 |


## v26 변경 요약

| 기능 | 상태 | 비고 |
|---|---|---|
| **모달 위치 버그(설정 탭에서 공지사항/FAQ 등이 안 보이던 문제) 근본 수정** | 🐛 수정 | 탭 전환에 쓰는 CSS transform 때문에 `fixed` 모달 11개가 전부 같은 문제를 안고 있었음. `Portal`로 감싸서 body 최상단에 렌더링하도록 통일 |
| **공지사항 진입 팝업 개편** | 🆕 신규 | 목록+아코디언 방식 → 카드 내용이 바로 보이는 방식으로 변경. 여러 개면 겹쳐진 카드 스택(뒷 카드 살짝 보임)으로 넘겨봄. 카드마다 "다시 보지 않기"/"다음(확인)" 버튼 상시 노출, 점 인디케이터로 위치 표시 |
| 설정 화면 안의 공지사항 목록(아코디언) | ✅ 유지 | 기존 방식 그대로 유지 (요청사항) |
| **팩 설정 화면 신설** | 🆕 신규 | 설정 > 팩 설정. "완료된 항목 맨 아래로 이동" 토글(기본 ON), 계정에 저장돼 기기 간 동기화. 이후 옵션 추가 가능한 구조로 설계 |
| **가방 목록 정렬 (셀렉드롭)** | 🆕 신규 | 생성일자(기본) / 이름 오름차순 / 이름 내림차순 / 최근 업데이트. 계정에 저장(모든 기기 동일). 실시간 재정렬 지원 |
| **팩 라이브러리 정렬 (셀렉드롭)** | 🆕 신규 | 위와 동일한 4가지 기준. Pack에 `createdAt` 필드 추가, 최초 저장 시 자동 채워짐 |

## 참고: 팩 설정 추가 후보 (미구현, appfle 확인 대기)
- 완료된 항목 흐리게 + 취소선 표시
- 팩별 접기/펼치기 상태 기억
- 미완료 개수 배지 표시


## 1. 회원 / 계정

| 기능 | 상태 | 비고 |
|---|---|---|
| 이메일/비밀번호 회원가입 | ✅ 완료 | 가입 시 닉네임 12자, 아바타 선택 필수 |
| 이메일 인증 발송 | ✅ 완료 | 가입 직후 발송, 재발송 가능 |
| **이메일 인증 완료 전 로그인 차단** | 🆕 v25 신규 | 인증 안 된 계정은 로그인 시도 시 즉시 로그아웃 처리 + 안내 문구 + "인증 메일 다시 받기" 버튼 노출 |
| Google 소셜 로그인 | ✅ 완료 | 최초 로그인 시 GoogleProfileSetup에서 닉네임/아바타 설정 |
| **비밀번호 찾기(재설정)** | 🆕 v25 신규 | 로그인 화면 "비밀번호를 잊으셨나요?" → 이메일 입력 → Firebase 재설정 메일 발송 |
| **비밀번호 변경** | 🆕 v25 신규 | 설정 > 프로필 수정 > 비밀번호 변경 (현재 비밀번호 재인증 필요), Google 계정은 메뉴 비노출 |
| **재로그인 시 닉네임 설정화면 플래시 버그** | 🐛 v25 수정 | AuthProvider의 loading 상태 관리 수정 (재로그인 시 profile 로드 전까지 splash 유지) |
| 닉네임/아바타 수정 | ✅ 완료 | 설정 > 프로필 수정 |
| 테마(라이트/다크/시스템), 강조색, 글자 크기, 시작 탭 | ✅ 완료 | 계정에 저장되어 기기 간 동기화 |
| 회원 탈퇴 | ✅ 완료 | 유일 멤버 가방/개인 팩/이미지 삭제, 공유 가방은 탈퇴자만 제외 |

## 2. 가방 (Bag)

| 기능 | 상태 | 비고 |
|---|---|---|
| 가방 생성/수정/삭제 | ✅ 완료 | |
| 최대 10명 초대코드 참여 | ✅ 완료 | |
| 실시간 동기화 (Firestore) | ✅ 완료 | |
| 여행 날짜 등록 / D-Day 표시 | ✅ 완료 | |
| 이미지 첨부 | ✅ 완료 | 업로드 전 클라이언트 압축 |
| 진행률(체크율) 표시 | ✅ 완료 | ProgressRing |
| 멤버 관리 (내보내기, 나가기) | ✅ 완료 | GroupMembersModal |
| AI 메모 가져오기 | ✅ 완료 | Gemini 2.5 Flash-Lite 사용, v66부터 PDF 파일 첨부도 지원 |

## 3. 팩 (Pack)

| 기능 | 상태 | 비고 |
|---|---|---|
| 팩 라이브러리 저장/재사용 | ✅ 완료 | v41: 저장 아이콘 클릭 시 상태별 확인 다이얼로그(최초 저장/수정 시 새로저장·덮어쓰기 선택) |
| 팩 색상 지정 | ✅ 완료 | |
| 팩 가져오기/다른 이름으로 저장 | ✅ 완료 | PackImportModal, SaveAsDialog |
| **팩 보관함 폴더** | 🆕 v68 | 무제한 깊이 폴더 트리, 다중선택 이동/삭제(재귀) |
| **팩 보관함 무료 개수 제한** | ⛔ v68 폐지 | 무료/유료 구분 없이 무제한 저장 |

## 4. 아이템 (Item)

| 기능 | 상태 | 비고 |
|---|---|---|
| 체크박스형 / 텍스트형 항목 | ✅ 완료 | |
| 항목 통계 (itemStats.ts) | ✅ 완료 | |
| 용어 확정: "가방"=체크리스트, "팩"=카테고리 | ✅ 확정 | "아이템"은 명칭 재검토 중 (미확정) |

## 5. 공지사항 / FAQ

| 기능 | 상태 | 비고 |
|---|---|---|
| 공지사항 (마스터 계정 작성, 실시간 구독) | ✅ 완료 | Firestore `announcements` 컬렉션 |
| 공지사항 "다시 보지 않기" | ✅ 완료 | |
| **마스터 계정 환경변수 연동** | ✅ 완료 | lib/masterEmails.ts + firestore.rules 양쪽 반영 (NEXT_PUBLIC_MASTER_EMAILS 환경변수 관리) |
| **샘플 공지사항 1건** | 📝 안내 | 공지사항은 코드가 아닌 실시간 DB 데이터라 제가 직접 넣을 수 없어요. 채팅에 드린 제목/본문 그대로 설정 > 공지사항 관리(운영자)에서 등록해주세요 |
| **FAQ 카테고리화 + 대폭 확충** | 🆕 v25 신규 | 회원/계정, 가방, 팩, 아이템, 알림/공지사항, 데이터/보안, 문의 7개 카테고리, 총 27개 항목 |

## 6. 하단 내비게이션

| 기능 | 상태 | 비고 |
|---|---|---|
| **하단 탭바 전체 사이즈 확대** | 🆕 v25 신규 | 아이콘 20→25px, 텍스트 11→12.5px, 패딩 확대 |
| **하단 탭바 세로 여백 소폭 축소** | 🐛 v57 | v25 확대분이 다소 과했다는 피드백으로 상하 패딩만 소폭 축소 (아이콘 크기는 유지) |
| **가운데 홈 버튼(FAB) 확대** | 🆕 v25 신규 | 56px→68px, 아이콘 26→32px |

## 7. 인프라 / 배포

| 기능 | 상태 | 비고 |
|---|---|---|
| Firebase 프로젝트 마이그레이션 (appfle.dev → appfle.io) | ✅ 완료 | |
| firestore.rules 변경분 (announcements 마스터 이메일 추가) | ⚠️ 대기 | Firebase 콘솔에서 재게시 필요 |
| Vercel 자동배포 (packinbag.vercel.app) | ✅ 완료 | |

## 8. 향후 예정 (변경 없음)

- 푸시 알림 (스토어 출시 후)
- 앱스토어 평점 유도 기능
- iOS/Mac App Store 제출 (Capacitor + Xcode)
- Android 배포
- "아이템" 명칭 변경 검토
- Apple/Kakao/Naver 로그인
- WidgetKit 위젯
