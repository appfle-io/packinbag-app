# 팩인백 리디자인 작업 계획 (2026-09-30 작성 · 10-13 갱신)

기준 문서: packinbag_UIUX_리디자인_방향.md
기준 코드: main v1.0.34 + iOS 1.6 (Build 6, 제출 준비) — 10/5 구 UI(v1) 삭제, 10/6 Firestore 멈춤 복구·아이콘, 10/7 보안 점검·Storage 정리·비용 절감, 10/8 코드 정리·가방 메모 본문 분리, 10/9 전원 무료 출시 결정·보안 점검 2차, 10/10~10/11 iOS 네이티브(알림·위젯·잠금화면·단축어), 10/12 iOS 1.5 출시·개인 잠금·공유 링크 브리지·1.6 네이티브(Face ID·검색·글자색·위젯 열 수)까지 반영
iOS 네이티브 상세: 저장소 `docs/packinbag_ios_native_plan.md`, 출시 진행판: `docs/packinbag_iap_release_guide.md`, 지금 상태 · 남은 일 · 세션 로그: `_secrets/claude/HANDOFF.md`(10/17~, git 밖, 남은작업 문서를 대신함)
**문서 원본은 저장소 `docs/`** 이다. Claude 작업 지침 · 메모리 이관본은 `_secrets/claude/`(CLAUDE.md · project-memory.md, 10/17, master · worker 두 계정 공용)
목업(Claude 아티팩트, master 계정에서만 열림): https://claude.ai/artifact/UdHuUnmG3Ncir2qm9TeH1p · 데이터 사본 `_secrets/claude/mockup/`
  - 10/3 "데스크톱 · 포터블" 줄 / 10/4 떠 있는 탭바·글꼴·아이패드 2단·"로그인 · 계정 · 오프라인" 줄

## 지금 상태 (10/13)
- **iOS 1.5 (Build 5) 10/12 승인 · 출시**(알림 · 위젯 · 잠금화면 실시간 현황 · 단축어)
- **iOS 1.6 (Build 6) 코드 완료**(10/12): 개인 잠금 Face ID · 잠금화면 글자색 · 위젯 열 수(중간 · 크게 1/2열, "외 N개" 줄 삭제) · Siri · Spotlight 검색(가방 · 팩 · 보관함 팩) · 유니버설 링크. 웹 v1.0.34와 한번에 배포 → 기기 확인 → 제출(아래 "다음 할 일" 1)
- 웹 10/12: 개인 잠금(설정 > 잠금, PIN 4/6자리, 나만 잠김) · 공유 링크 앱/기본 브라우저 브리지(`lib/v2/appBridge.ts`) · 잠금화면 띄우기 미리 보기 · 글자색 · 배경 불투명도 0%까지 · AASA(`app/.well-known/apple-app-site-association`)
- **결제 없이 전원 무료 출시**(10/9): 직장인이라 사업자등록 불가 → 유료 앱 계약 불가. `lib/freeLaunch.ts` FREE_LAUNCH = true + storage.rules freeLaunch(). AI만 하루 3회(10/21부터 주 3회, premium.md PREM-LIM-08). 결제 코드는 남겨 둠
- 웹 v1.0.32(10/11): FAQ · 업데이트 노트 · 개인정보처리방침(푸시·기기 토큰), /privacy · /support 스크롤 수정. 포터블 태그 v1.0.32-offline-portable
- **앱은 v2만 있다.** 10/5에 구 UI 소스와 `NEXT_PUBLIC_UI_V2` 플래그를 모두 지웠다(v1.0.20). 웹 운영(Vercel)·iOS 앱(server.url)·포터블 모두 v2
- 0~5단계 + 4단계-19(iOS 1.6)까지 코드 완료. 지금 상태 · 남은 일은 `_secrets/claude/HANDOFF.md`(10/17~)
- **가방 메모 본문은 가방 문서가 아니라 `bags/{bagId}/notes/{packId}`에 있다**(10/8, v1.0.28). 기존 31개 가방 메모 40개 이전 완료
- 앱스토어 스크린샷: 아이폰 10장(6.3″ 칸 1206×2622 - 6.9″ 칸이 없어 줄여 올림, 원본 1320×2868도 보관) · 아이패드 13″ 8장, 새 아이콘(딥그린) 1.5 빌드에 포함. 파일은 `_secrets/iphone 상세페이지`(git 밖)

## 진행 방식
- **프로젝트 경로(10/11~)**: `~/Desktop/packinbag.nosync`(iCloud 동기화 제외, `~/Desktop/packinbag`는 링크). Claude filesystem MCP 허용 경로도 `.nosync`
- **비밀 파일(10/11~)**: 프로젝트 맨 위 `_secrets/`(폴더째 gitignore) + `_secrets/README.md`에 목록. APNs 키 · Apple 로그인 키 · App Store Connect API(RevenueCat) 키 · 앱 내 구입 키 · `.env.local` 사본. `.env.local` 원본은 맨 위 그대로
- **Cloud Functions(10/11~)**: `functions/`(Node 22, asia-northeast3). 배포 `npx firebase-tools deploy --only functions`, 로그 `npx firebase-tools functions:log --only onBagUpdated,flushBagActivity`. APNs 키는 Secret Manager `APNS_KEY_P8`
- 브랜치 없이 main에 커밋(2026-09-30 사용자 결정). 플래그가 없어졌으므로 **main에 올린 것이 곧 운영**이다. 위험한 변경은 Vercel Preview(main이 아닌 브랜치 푸시)로 먼저 확인
- 데이터 소스 2종 유지: 온라인(bagsService/packsService) + 오프라인·포터블(localBagsService)
- **로컬 개발용 Firebase는 분리하지 않는다**(10/8 결정). 로컬 테스트 = 운영 데이터. 큰 데이터 변경·이전 전에는 `node scripts/backup-firestore.mjs`로 전체 백업(`backups/`, gitignore - 절대 커밋 금지)
- 규칙 배포: `npx firebase-tools deploy --only firestore:rules,storage`(맥에 firebase CLI 없음). 규칙과 앱을 함께 바꿀 때는 보통 규칙을 먼저
- 플랫폼 확인 대상: 웹, iOS(Capacitor), Electron 포터블(Win/Mac, 오프라인 포함)
- 로컬 작업 트리는 CRLF(autocrlf), 저장소는 LF(.gitattributes text=auto)
- 커밋·푸시·태그는 사용자가 직접(AGENTS.md). Claude는 filesystem MCP로 읽기·쓰기만(셸·삭제·바이너리 쓰기 불가 → 파일 삭제는 사용자 `git rm`, 이미지 등은 zip으로 전달)
  - `git rm a b`는 경로 하나라도 없으면 전부 멈춘다 → 하나씩 지우거나 있는 것만
  - **zip을 프로젝트에 넣을 때 Finder로 폴더째 붙여넣고 "대치"하면 폴더가 통째로 바뀐다**(10/6 app·public·electron·ios 사라짐 사고 → `git restore --source=HEAD --worktree -- 폴더들` + `npx cap sync ios`로 복구). 항상 `ditto 풀어둔폴더 ~/Desktop/packinbag`로 합친다
- 빌드 확인: `rm -rf .next && npx tsc --noEmit && npx eslint components/v2 lib app/admin components/admin contexts components/AppShell.tsx && npm run build`(10/11부터 contexts · AppShell도 포함, 기존 set-state-in-effect 오류 정리 완료)
  - 맥에서 `.next/types/* 2.ts` 같은 " 2" 복제 파일이 생기면 `.next`를 지우고 다시 빌드(데스크톱 iCloud 동기화가 원인일 수 있음)
  - zsh에서 grep `--include=*.ts`는 따옴표 필요: `--include="*.ts"`
  - hooks·ThemeProvider는 기본 lint 범위 밖 → 정리 작업 때는 `npx eslint ... hooks components/ThemeProvider.tsx`까지
  - v2 규칙 `pib-v2/no-static-inline-style`: 고정 값은 style 대신 토큰 클래스(10/11 LiveActivitySheet에서 걸림)
  - 안 쓰는 코드 찾기: `npx --yes knip --include exports,types --reporter compact 2>&1 | tee knip.txt`(`knip.json`이 ios·electron·public 제외). `--yes` 없으면 설치 질문에서 멈춘 것처럼 보인다
- 서버 과금 원칙: 추가 Firestore 읽기·쓰기는 꼭 필요한 곳에만. 이미 구독 중인 실시간 데이터(onSnapshot)를 최대한 재사용
- 버전: `npm version`만 올리면 설정 > 버전 정보도 바뀐다(`lib/changelog.ts`가 package.json을 읽음, 10/5). 사용자에게 알릴 내용이 있으면 CHANGELOG 배열 맨 앞에 추가
  - **번호 규칙(10/14부터)**: 앞 두 자리 = 스토어 앱 버전, 끝자리 = 웹 · 포터블만 배포한 횟수. 웹 · 포터블만 바뀌면 1.6.1 → 1.6.2 …, 스토어에 새 빌드를 내면 Xcode 1.7 + 웹 1.7.0을 같이. 1.0.34 다음이 1.6.1(1.0.x 기록은 그대로). 포터블 태그도 같은 번호(`v1.6.1-offline-portable`)

## 코드 주의 사항
- `UserProfile`에 새 필드를 만들면 `contexts/AuthProvider.tsx`의 users 문서 onSnapshot 매핑(필드를 하나씩 골라 담음)에도 반드시 추가. 빠지면 저장은 되는데 화면에 반영되지 않는다(10/3 bagFolderOrder 사고)
- users/{uid} 문서 쓰기는 AuthProvider의 `writeUser(patch, dotted)`로만. 오프라인 모드면 localStorage 로컬 프로필에 저장(점 경로·필드 삭제는 `REMOVE_FIELD`). 오프라인 모드에서는 users 문서를 구독하지 않는다
- 가방 폴더 점 경로 쓰기(삭제·이동·평평하게)는 계정 모드에서 `writeBagFolderPatch` 트랜잭션으로 서버 최신본을 보고 폴더가 있을 때만(10/5)
- 탭 화면 아래 여백은 숫자로 박지 않는다. 떠 있는 탭바(TabBarV2)가 자기 높이를 재서 `--pib-dock`에 적고, `ScreenBody`가 `dock-pad-body`·`dock-scroll-pad`로 더한다. 탭바 바로 위 줄은 `dock-mb` + 그 화면 `ScreenBody dockless`. 포털 토스트는 `--pib-dock-viewport`(`toast-lift`)
- 앱 글꼴 파일 7개(지마켓 산스 3·D2코딩 2·개구 2)는 `app/fonts`에 커밋되어 있다. 빠지면 `npm run build` 실패
- 인터넷 연결 여부는 `lib/v2/connectivity`(useConnectivity · recheckConnectivity)만 쓴다. navigator.onLine·online 이벤트를 따로 보지 않는다(폐쇄망을 못 알아챔). Firestore `enableNetwork`도 여기서만 부른다(10/6 AppShell 중복 제거). 인터넷이 필요한 기능 입구에는 `useOnlineGuard().guard(fn)`
- 새 가방·팩 생성은 서버 API 전용(rules create false). 계정 모드에서 끊겼을 때는 `lib/v2/pendingCreates`(만들기 대기)로 가고, 목록에 "올리기 대기" 배지
- Firestore가 내부 검사 실패(INTERNAL ASSERTION FAILED ca9/b815, 절전 복귀 후)로 멈추면 `lib/v2/firestoreRecovery`가 감지해 "다시 연결하고 있어요" → 자동 새로고침(2분 안 재발이면 버튼만). 전역 error·unhandledrejection + `firebaseErrorCode()`에서 감지. 새 catch에서 Firestore 오류를 다루면 `firebaseErrorCode`나 `reportFirestoreError`를 거친다
- `.pib-v2`·`.pib-v2-overlay`는 층(layer) 밖 CSS라 같은 요소의 Tailwind `bg-*`를 이긴다. 겹 화면 루트에 어두운 바탕이 필요하면 안쪽 `absolute inset-0` 자식에 칠한다(PhotoViewer·BusyOverlay)
- `.pib-v2-legacy`는 10/17에 지웠다. 예전 토큰 이름(`bg-surface` · `text-text-secondary` · `var(--accent)` 등)은 globals.css `:root`에서 v2 토큰의 별칭 → 새 코드는 v2 이름만. `.pib-v2-guest`(게스트 보기)는 아직 씀
- **가방 메모 본문(10/8)**: 순수 함수 `lib/bagNotesCore.ts`, Firestore `lib/bagNotesService.ts`. 열린 가방(`useBagDocument`)만 notes를 구독해 채운다(hydrateBag). 저장이 본문을 떼어 바뀐 것만 notes에 쓴다
  - 가방 문서의 `packs`를 직접 쓰는 새 코드는 반드시 본문을 떼고(`splitBagForSave`/`splitPacksPlain`) `packsRev`를 1 올린다. 안 그러면 규칙(`notesV: 2` 가방)에 막힌다
  - `notesReady` false(본문 도착 전)에는 메모 편집기·메모 휴지통·보관함 저장·자동 동기화를 하지 않는다(빈 본문 덮어쓰기 방지)
  - 가방 완전삭제는 notes를 먼저(`deleteAllBagNotes`), 팩 이동은 notes도 같이. 오프라인 모드·만들기 대기 가방은 본문을 가방 안에 그대로
  - 검색은 가방 문서의 `searchText`(앞 2,000자), Storage 정리는 `attachmentUrls`
- **보안 규칙 요점(10/7~10/8)**: inviteCodes·libraryPacks·bags create는 서버만. users의 premiumPurchase·role·unlockCode·unlockCodeExpiresAt은 서버만. `locked`는 가방·팩 모두 서버만(값 비교). 멤버 빼기는 그룹장 또는 본인(나가기)만, 가방 삭제는 그룹장 또는 혼자 남은 멤버만. sharedPacks는 get만(list 금지). 댓글·리액션 규칙은 삭제(데이터는 남음)
- 이용권 판정은 `lib/unlockCodeCheck.ts` 하나(claimedBy.uid 본인 + 무효화·만료 아님). 서버 `isPremiumServer`·AI 횟수·storage.rules `isPremium()`이 같은 기준 - 바꾸면 셋 다
- 자동저장 `saveBagRemote`는 `updateDoc`으로 내용 필드만(멤버·소유자·잠김·휴지통 필드는 쓰지 않음). 팩 자동저장은 `locked`를 빼고 쓴다
- Storage 파일 지우기는 `lib/storageCleanup.ts`(다른 가방·보관함이 쓰는지 확인 후). 공유 가방 메모 첨부는 지우지 않는다
- **개인 잠금(10/12)**: 설정은 `users/{uid}.privateLock`만(가방 문서에는 안 씀 → 멤버에게 영향 없음). PIN은 PBKDF2 해시만. 화면을 가리는 잠금이지 암호화가 아님. 한 번 풀면 앱을 떠날 때까지 풀림. 틀린 횟수 · Face ID 사용 여부는 이 기기만. 무료 한도 `locked`("읽기 전용")와는 다른 기능. 코드 `lib/v2/privateLock.ts` · `components/v2/lock/` · 설정 `LockSettingsScreen`
  - 잠근 가방 · 팩 · 보관함 팩은 네이티브 요약(위젯 · 잠금화면 · 검색)에서 빠진다(`nativeLockFilter` → `setNativeSummaryLocks`)
- **네이티브 요약 모양**은 `lib/nativeSummary.ts` ↔ `ios/App/Shared/PIBShared.swift` ↔ `functions/src/live.ts`(content-state)가 같아야 한다. 보관함 팩 `library`는 앱이 열려 있을 때 웹만 넣고(서버 요약에는 없음), 네이티브는 없으면 예전 목록을 유지(10/12)
- 웹에 올린 코드는 스토어의 예전 iOS 앱에도 뜬다 → 네이티브 기능은 `isNativeBridgeAvailable` · `isServerPushAvailable` · `isLocalNotificationsAvailable`일 때만. 새 플러그인 메서드는 없으면 조용히 건너뛰게(예: `lib/v2/biometric.ts`)
- `packinbag://` 주소(알림 · 위젯 · 검색 · 브리지)와 유니버설 링크는 모두 `lib/v2/bagReminders.onBagNotificationTap` 한 곳에서 받는다: `bag/{id}(?pack=)` · `library/{id}` · `open?to=경로` · https 주소

## 완료 단계 요약
| 단계 | 날짜 | 내용 |
|---|---|---|
| 0 준비 | 9/30 | git pull, main 직접 커밋 결정 |
| 1 토큰·기본 컴포넌트 | 9/30 | v2 토큰(글자 6단계·간격·모서리·그림자·모션), Pretendard 셀프 호스팅, v2 ESLint 규칙, components/v2/ui, /dev/ui. 10/2 `.pib-v2-overlay`, 10/3 PageStack·ReorderSheet·가운데 창 Sheet(1024px 이상) |
| 2 가방 로직 훅 | 9/30 | hooks/bag/* 9개. `Bag.lastPackedAt/lastPackedBy/lastCheckedAt`, `Pack.isInbox`, 10/2 moveItems·deleteItems |
| 3 가방 체크 화면 | 9/30 | BagScreenV2, 칩 필터·미분류·하단 입력창·메모 섹션·시트들. 목록 위 드래그 정렬은 "순서 바꾸기" 시트로 대체 |
| 4-1 ~ 4-8 | 9/30~10/2 | 홈·가방 폴더 / 스크롤 압박 완화·용어 / 팩 탭 중첩 폴더 / 화면 틀 / 엑셀 가져오기 제거·설정 v2·토스트·게스트 보기·메모 편집기 / 실시간 동기화·동시 편집 / 프리미엄·폴더·가이드 |
| 4-9 손맛·복원·메모 | 10/3 | 손가락 따라오는 스와이프, 홈 목록 페이징, 빠른팩 하단 고정, 팩에 바로 추가, 화면 켜두기·내 담당, 순서 바꾸기, 다 챙긴 아이템 아래로, 템플릿 공유 심사 소스 제거, 마크다운 붙여넣기 |
| 4-10 구 UI 남은 화면 | 10/3 | 빠른팩 입력·탭바·시작 공지·알림·AI 시트·설정 하위 10개·사진 보기·처리 중·로그인 |
| 4-11 관리자 사이트 | 10/3 | 대시보드 개편(`lib/adminStats.ts`, 스냅샷 kpis), AdminPage 틀, 문의 2단·이용권·공지·활동 로그 |
| 4-12 탭바 독·글꼴 | 10/4 (v1.0.16) | 떠 있는 분리형 탭바(`--pib-dock`), 앱 글꼴 4종 |
| 4-13 로그인·계정 점검 | 10/4 (v1.0.17) | 오프라인 프로필·writeUser 통일, 탈퇴 재인증, 포터블 소셜 로그인 숨김, 오류 문구, PdfViewer, 브라우저 alert 제거 |
| 4-14 연결 흐름 | 10/4 (v1.0.18) | A 연결 판단 → F 상태 줄 → D 미리 막기 → B 시작 → C 만들기 대기 → E 합치기 |
| 5 셸 통합 | 10/3 (v1.0.16) | WideShell: 900 미만 모바일 / 900~1199 [목록 \| 상세] / 1200 이상 [레일 \| 목록 \| 상세], 단축키 N·K·I·P·Esc |

## 4단계-15 · 구 UI 삭제와 마무리 (2026-10-05) — 완료 (v1.0.20 · v1.0.21)
1. [x] **구 UI(v1) 소스 삭제**: 구 화면·모달·카드 약 150개 파일, `lib/v2/flags.ts`와 모든 `UI_V2` 분기, 포터블 워크플로 env의 플래그 줄. Pretendard `preload: true`
   - AppShell: 칸반 가방 만들기·시작 화면 설정·오늘 마감 팝업·구 탭 스와이프·구 오버레이 삭제. `TabKey`는 `lib/v2/shell.ts`, `ImportedBagResult`는 lib/types
   - 메모 편집기 구 화면 삭제, 다른 기기 변경은 항상 문단 단위로 합침
   - 안 쓰는 export 89개는 남아 있음(knip) → 나중에 정리
2. [x] **버전 표기 자동**(v1.0.21): `APP_VERSION`이 package.json을 읽음
3. [x] **연결 흐름 남은 점**: 합치기 시트 문구("이 기기의 가방·팩 옮기기", 무료면 개수 안내), 무료 초과 시 중간에 멈추고 "N개 옮김 · M개는 이 기기에" + 프리미엄 시트(중복 생성 버그 수정), 목록·캐러셀·팩 탭에 "올리기 대기" 배지
4. [x] **셸 통합 남은 점**: 넓은 화면 설정 하위 화면을 상세 칸에(`DetailPaneContext`), 열린 가방·팩 강조(`OpenDetailContext`, aria-current), 손대지 않은 새 가방 정리
5. [x] **가방 폴더 점 경로 쓰기**: `writeBagFolderPatch` 트랜잭션(다른 기기에서 지운 폴더가 되살아나던 문제)

## 4단계-16 · 안정화·출시 준비 (2026-10-06) — 완료 (v1.0.22 · v1.0.23)
1. [x] **Firestore 멈춤 자동 복구**(v1.0.22): 노트북을 덮었다 열면 `INTERNAL ASSERTION FAILED (ca9 → b815)`로 Firestore가 새로고침 전까지 멈추던 문제. `lib/v2/firestoreRecovery.ts` + `components/v2/shell/FirestoreRecoveryOverlay.tsx`, `lib/errorMessage.ts`에서도 감지. AppShell의 online 이벤트 `enableNetwork` 중복 제거. firebase ^12.19.0
2. [x] **README 최신화**: 다운로드 표를 최신 릴리즈 링크로(버전 고정 안 함), v2 기능·무료/프리미엄 표·기술 스택·구조·환경변수·배포 명령. `.env.local.example`에 `RESEND_API_KEY`·`NEXT_PUBLIC_APP_URL`
3. [x] **앱 안 공지 문안**: "팩인백이 새 디자인으로 바뀌었어요"(관리자 사이트 > 공지에 사용자가 등록). 공지 본문은 줄바꿈만 반영, 마크다운 안 됨
4. [x] **앱스토어 스크린샷**: 아이폰 6.9″(1320×2868) 8장 · 아이패드 13″(2064×2752) 8장
   - 찍는 법: 크롬 기기 모드 사용자 기기 **440×956 · DPR 3** / **1032×1376 · DPR 2**, ⋮ → Capture screenshot. 툴바 DPR 칸은 늘 잠겨 보이지만 저장한 값으로 찍힌다. 맥이 구형이라 시뮬레이터 대신 이 방법
   - 꾸미기: Claude가 PIL로(배경 #ECF1EE/다크 #161817, Pretendard 제목·부제, 폰·패드 테두리, 9:41 상태 줄)
   - 순서·문구: ① 매번 싸는 가방, 체크만 다시 ② 외출·여행·장보기, 가방 하나로 정리 ③ 자주 챙기는 건 팩으로 만들어 두고 ④ 가족과 같은 가방을 함께 챙겨요 ⑤ 떠오르면 일단 빠른팩에 적어 두기 ⑥ 체크리스트로 부족한 건 메모로 함께 ⑦ 적어 두기만 하면 AI가 나눠 담아요(다크) ⑧ 내 눈에 편하게 고르는 화면(다크)
   - 가린 것: 이메일 모자이크, 초대 코드는 ABC123으로, "기흥네" 모자이크. "시우"는 그대로 써도 됨(사용자 확인)
5. [x] **앱 아이콘 v2**(v1.0.23): 주황 배경 → 딥그린 #2E5E4E, 가방 모양은 그대로(흰 가방 + 옅은 초록 팩 두 톤). 원본 파일을 색만 바꿔 생성 — app·public 아이콘, favicon, apple-icon(불투명 정사각형으로), backpack-logo, electron png·ico, iOS AppIcon 1024(꽉 찬 정사각형), iOS 스플래시 3장. iOS 아이콘은 새 빌드부터

## 4단계-17 · 보안·비용·구조 (2026-10-07 ~ 10-08) — 완료 (v1.0.24 ~ v1.0.28)
1. [x] **보안 점검 1차**(v1.0.26): 초대코드 위조(inviteCodes create false + join-bag 코드 일치·트랜잭션), create-bag 남의 가방 덮어쓰기(트랜잭션 create), share-pack 남의 공유 페이지 바꿔치기(출처 sourceBagId/sourcePackId), `/v` 초대코드 노출(게스트 필드만 전달), 이용권 위조(claimedBy 검사·unlockCode 쓰기 차단·AI fail-closed), 멤버 강퇴·가방 삭제 권한, 무료 팩 10개 초과 실제 잠금, 공유 팩 목록 조회 차단, 안 쓰는 댓글·리액션·멘션 규칙 삭제
2. [x] **버그**: 혼자 쓰던 가방에 참여한 직후 자동저장이 참여자를 빼던 문제(setDoc → updateDoc), 탈퇴 시 그룹장 위임 없이 나가던 문제, 무료 회원이 가방을 휴지통에 넣어도 잠김이 안 풀리던 문제(화면·서버 잠김 비교), memberProfiles 동기화가 안 돌던 문제, 구매자가 storage.rules에서 프리미엄으로 안 보이던 문제, sw.js "Failed to convert value to 'Response'"
3. [x] **Storage 정리**: 가방·팩 완전삭제·30일 자동삭제·탈퇴·메모에서 지운 첨부(편집기 닫을 때). 다른 곳이 쓰는 파일은 남김, 공유 가방 메모 첨부는 남김. 업로드 cacheControl 1년
4. [x] **비용 절감**: 접속 표시 60초 + 3분 자리 비움 정지, 알림 구독·버전 폴링 한 벌 공유, 관리자 대시보드 Firestore 캐시 1시간, `/v` 60초·`/p` 5분 캐시, 운영 Firestore 로그 error만
5. [x] **코드 정리**(10/8): knip으로 안 쓰는 export·코드 정리, generate-sample 삭제, " 2" iCloud 사본 정리, `docs/packinbag_settings_spec_v1.md` 반영
6. [x] **가방 메모 본문 분리**(10/8, v1.0.28): 위 "코드 주의 사항" 참고. 백업 → 규칙 배포 → 앱 배포 → `node scripts/migrate-bag-notes.mjs`(미리 보기) → `--apply` 순서로 진행. 이전 스크립트는 재실행해도 안전해서 남겨 둠
   - 옛 탭·업데이트 안 한 포터블은 이전된 가방을 저장할 수 없다(새로고침하면 풀림)

## 4단계-18 · iOS 네이티브 1.5 (2026-10-10 ~ 10-11) — 완료 · 심사 제출
상세 · 파일 위치는 저장소 `docs/packinbag_ios_native_plan.md`
1. [x] **로컬 알림**: 가방마다 D-Day(D-7·D-3·D-1·당일·직접) · 요일 반복. `UserProfile.bagReminders`, 가방 더보기 > 알림
2. [x] **서버 푸시**(Cloud Functions + APNs 직접): 함께 쓰는 가방 활동 10분 묶음 · 담당 지정 · 새 멤버(그룹장). 내 변경은 안 보냄(`editedBy`). 설정 > 알림 종류별, 가방별 "이 가방 소식 받기" + 종류별(`pushMutedBagIds` · `bagPushOff`). 더보기 "알림" 줄은 소식 + D-Day · 반복을 합쳐 표시
3. [x] **홈 · 잠금화면 위젯**(iOS 17): 편집은 가방 → 팩 2단계(곧 출발 · 고정 · 최근 묶음 + 검색, 보관함 가방 제외), 팩 비우면 가방 전체. 체크 바로, 챙긴 것 아래로, 크게 2열, "14시 05분에 새로고침" + ↻, 30분 안전망, 빈 팩 안내
4. [x] **잠금화면 실시간 현황**: 팩 또는 전체, 배경 시스템 · 라이트 · 다크 · 직접(색 8개 + iOS 색 고르기 창 + 불투명도), 글꼴 · 글자 크기. 160pt 제한 → 2열 2줄. 다 챙겨도 바로 안 내리고(해제 가능) 5분 뒤. 다른 멤버 체크는 서버가 원격 갱신
5. [x] **단축어 · Siri**: 빠른팩에 입력 · 가방에 추가 · 팩인백 새로고침 · 잠금화면 다시 띄우기(8시간 제한 → 자동화 0·8·16시)
6. [x] **기반**: 기기 토큰(`deviceTokens`, 해시만) · `/api/native/*` · App Group 요약(`lib/nativeSummary.ts`) · 조용한 푸시 · 알림/위젯 누르면 가방 열기(`packinbag://bag/{id}`)
7. [x] **버그(10/11)**: 마지막 아이템 체크가 풀림(`editSeqRef`), 구글 로그인 때 닉네임 화면 깜빡임, 로그아웃 → 오프라인 모드로 빠짐, 스플래시 확대, 실시간 현황 잘림 · 다 챙긴 뒤 해제 안 됨
8. [x] **제출(10/11)**: FAQ "위젯 / 잠금화면" 묶음 · 업데이트 노트 · 개인정보처리방침, 앱 개인정보에 기기 ID, 처리방침 URL seeuson.com, 스크린샷 09 위젯 · 10 잠금화면, 심사 메모 Native features
9. [x] **정리**: AppShell · AuthProvider eslint 오류, `_secrets/` · `.nosync` 이전, git 비밀 파일 점검(문제 없음)
10. [x] **출시(10/12)**: 1.5 승인 → "이 버전 출시"

## 4단계-19 · 개인 잠금 · 링크 · iOS 1.6 (2026-10-12) — 코드 완료 · 기기 확인 전
상세는 저장소 `docs/packinbag_ios_native_plan.md` 10절
1. [x] **개인 잠금**(웹): 가방 · 가방 속 팩 · 보관함 팩을 나만 PIN(4 또는 6자리)으로. 설정 > 잠금(PIN 만들기 · 바꾸기 · Face ID · 지금 잠그기 · 잠금 끄기), 잠글 대상은 가방 더보기 · 팩 길게 누르기 · 팩 탭 길게 누르기. 보관함에서 잠근 팩을 불러온 가방 팩도 같이 잠김
2. [x] **Face ID**(1.6 네이티브): `biometricInfo` · `authenticateBiometric`(생체 인증만, 실패 · "PIN 입력" → PIN 화면), `NSFaceIDUsageDescription`
3. [x] **공유 링크 브리지**(웹): 카톡 등 앱 안 브라우저에서 `/v/…` 링크를 열면 아이폰은 앱(`packinbag://open?to=`, 없으면 앱스토어), 안드로이드는 기본 브라우저로(`lib/v2/appBridge.ts` · `components/AppBridge.tsx`)
4. [x] **유니버설 링크**: AASA(초대 링크 `/?invite=` · `/v/*`만, 짧은 URL은 밖으로 나가는 링크가 있어 제외) + `applinks:packinbag.seeuson.com`. 1.6부터 메시지 · 메모 · 사파리에서 바로 앱
5. [x] **잠금화면 띄우기**: 시트 미리 보기, 글자색(자동 · 흰색 · 검정 · 직접), 배경 불투명도 0%까지. 글자색은 1.6부터 잠금화면에 반영
6. [x] **홈 위젯 열 수**: 중간 · 크게 1열/2열(기본 2열), 작게 1열. 마지막 줄 "외 N개" 삭제(그 줄까지 아이템, 남은 양은 제목 줄 n/m)
7. [x] **Siri · Spotlight 검색**(iOS 18+): 가방 · 가방 속 팩 · 보관함 팩 `IndexedEntity`, 누르면 그 가방 / 그 팩으로 스크롤 / 팩 탭의 보관함 팩. 보관함 팩 목록은 앱이 열려 있을 때만 넘김(A안, 서버 비용 없음). 로그아웃하면 색인 삭제
8. [ ] **배포 · 제출**: 웹 v1.0.34 push → Xcode 1.6/6 → 기기 확인(QA `X-` 절) → Archive → 심사(출시가이드 A-5)

## 미해결 · 조사 중
- **세로 스크롤이 어느 순간 막힘**(10/3, 데스크톱 PWA 좁은 창에서 발견, 모바일도 의심)
  - 의심: PageStack 애니메이션이 끝나지 않아 투명한 층이 남는 경우, 또는 겹 화면이 덜 닫힌 경우
  - 재현 시 막힌 상태 그대로 콘솔에서 `document.elementFromPoint(innerWidth/2, innerHeight/2)`의 조상 체인(position·overflowY·inline transform·visibility·inert)과 body 직속 fixed 요소 목록 확인 → 원인 확정 후 수정
  - 확인할 것: 어느 화면 / 직전 동작 / 탭 이동·새로고침으로 풀리는지 / 휠인지 터치인지
- **Firestore 멈춤**: 자동 복구로 덮었지만 근본 원인(SDK)은 남아 있음. 12.19에서도 자주 나오면 persistentLocalCache 설정 재검토

## 다음 할 일
지금 기준 목록은 `_secrets/claude/HANDOFF.md` "다음 할 일"(10/17부터 여기서는 관리하지 않음).

포터블에 반영되는 변경이 있으면 같은 순서:
```
npm version 1.0.x --no-git-tag-version
rm -rf .next && npx tsc --noEmit && npx eslint components/v2 lib app/admin components/admin && npm run build
git add package.json package-lock.json && git commit -m "chore: v1.0.x" && git push origin main
git tag v1.0.x-offline-portable && git push origin v1.0.x-offline-portable
```
- 태그는 `v*offline*` 또는 `v*portable*`만 워크플로가 반응. main 먼저 푸시 후 태그. Actions 끝나면 Releases에 윈도우 zip, 맥 zip·dmg

## Xcode 단계 할 일
- [x] 새 아이콘 · 스플래시, 햅틱, 푸시 · 위젯 · 실시간 현황 · 단축어(1.5)
- [x] Face ID · 잠금화면 글자색 · 위젯 열 수 · Spotlight · 유니버설 링크(1.6, 코드 완료 · 기기 확인 전)
- [ ] 화면 켜두기가 iOS 앱 웹뷰에서 안 되면 `@capacitor-community/keep-awake`(QA KA-05)
- [ ] (나중) 캘린더 · 미리알림
- 새 Capacitor 플러그인을 넣으면 `capacitor.config.ts` includePlugins에도 추가(RevenueCat은 빌드 오류로 빼 둠)
- Xcode 버전은 App · PackInBagWidgetExtension 두 타깃의 Version · Build를 항상 같이 올린다

## 보류·아이디어
- 가방 아이템 여러 개 선택에서 **다른 가방으로** 옮기기(지금은 같은 가방 안 팩으로만)
- 포터블 Google·Apple 로그인: 기본 브라우저에서 로그인 → 서버가 Firebase 커스텀 토큰 발급 → `packinbag://` 또는 로컬 포트로 앱에 전달 → signInWithCustomToken (10/4 보류)
- iOS 앱 폐쇄망 첫 실행: 앱 화면을 앱 안에 내장해야 함(server.url 구조 변경 + 재심사). 알려진 한계
- 홈 목록의 출발일 표기도 D-Day로 통일할지(가방 화면만 바꿈)
- 캐러셀 자동 넘김 간격(5초) 실사용 후 조정
- 순서 바꾸기 시트: 긴 목록에서 끌 때 자동 스크롤
- 마크다운 붙여넣기: 중첩 목록, 인용
- 팩에 바로 넣은 뒤 스크롤 대상: "다 챙긴 아이템 아래로"가 켜져 있으면 새 아이템 id로 스크롤
- 관리자 대시보드: 활동을 "체크한 사람" 기준으로 정확히 세려면 체크 시 uid를 남겨야 함
- 보관함 메모 본문도 분리할지(지금은 가방 메모만. 보관함은 개인 공간이라 비용이 작아 보류)
- 가방 메모 검색이 앞 2,000자까지만 되는 한계(10/8 결정)
- 목업에 "올리기 대기" 배지·합치기 시트 추가

## 1.7 가방 바로가기 위젯 · 위젯 꾸미기 (2026-10-18) — 코드 완료, 기기 확인 · 제출 전
- iOS 홈 화면 작은 위젯(가방 정보만 · 누르면 그 가방) + 설정 > 위젯 꾸미기(가방 더보기에도). 자세히는 `docs/packinbag_ios_native_plan.md` 11절, 명세 NAT-BMK · SET-WID · RULE-STO-WID, QA BW-
- 코드 주의: `UserProfile.widgetStyles`는 AuthProvider 매핑에 있음. 꾸미기 모양은 `lib/types.ts` WidgetStyle ↔ `PIBShared.swift` PIBWidgetStyle, 문구는 `lib/v2/widgetStyles.ts` ↔ `PIBBookmarkText`, 미리 보기 `WidgetPreview.tsx` ↔ `BookmarkWidgetView`가 같아야 한다(하나를 바꾸면 같이)

## 이후 로드맵 (확정 순서)
v2 출시 + 푸시 · 위젯 · 실시간 현황 · 단축어(iOS 1.5, 10/12 출시) → 개인 잠금 Face ID · Spotlight · 유니버설 링크(1.6) → 결제 도입(사업자 가능해지면) → Android. 캘린더 · 미리알림은 하지 않음(10/17 결정, 지금 기능을 탄탄하게)
- iOS 설계 원칙: 그룹원 활동 푸시는 자동저장마다 보내지 않게, D-Day 알림은 로컬 알림, 위젯은 App Group에 저장한 요약을 읽는 방식. 가방 메모 본문은 notes에 있으니 위젯·푸시는 미리보기(`editorPreviewText`)만

## 회귀 점검표 (각 단계 끝에 실행)
- 가방: 생성, 이름 변경, 체크/해제, 전체 해제, 아이템 추가(미분류·팩에 바로)·수정·삭제·이동(여러 개 포함), 팩 불러오기, 보관·복구, 휴지통, 사진 크게 보기
- 공유: 초대 링크로 참여, 초대 코드 참여(무료 2명·프리미엄 10명), 두 기기 동시 체크 실시간 반영, 접속자 표시, 담당자 지정·내 담당 칩, 멤버 내보내기
- 메모팩: 편집, 동시 편집 병합, 표·체크박스·코드블록, 마크다운 붙여넣기, 사진·PDF 첨부, 보관함 자동 동기화, 충돌 시 새로 저장/덮어쓰기
- 가방 메모 본문(10/8): 새로 만들기·고치기 후 다시 열어도 그대로, 두 계정 동시 편집 둘 다 반영, 메모 휴지통 → 되살리기, 다른 가방으로 옮기기, 보관함 불러오기·저장·자동 동기화, 홈 검색으로 메모 속 글자, `/v` 공유 보기에 메모 표시, 가방을 열자마자 메모를 눌러도 "불러오는 중" 뒤 내용이 보이는지
- 첨부 정리: 혼자 쓰는 가방 메모에서 사진을 지우고 나가면 Storage에서 그 파일만 삭제, 보관함 원본·다른 가방이 쓰는 파일과 공유 가방 메모 첨부는 남는지
- 보안·제한: 남의 이용권 코드를 써넣어도 프리미엄 안 됨, 구매자 PDF 첨부 가능, 무료 팩 11개 이상 오래된 팩 읽기 전용, 무료 가방 4개 중 하나 휴지통 → 잠김 풀림, 재발급한 옛 초대코드 실패, 일반 멤버는 나가기만(내보내기는 그룹장), 공유 팩 링크(`/p`)는 열리는지 (출시 기간에는 FREE_LAUNCH라 무료 제한 항목은 결제 도입 때)
- 개인 잠금: PIN 만들기 · 바꾸기, 가방 · 가방 속 팩 · 보관함 팩 잠그기, 다른 앱에 갔다 오면 다시 잠김, 함께 쓰는 멤버에게는 안 잠김, 잠근 것은 위젯 · 검색에 안 보임, Face ID(iOS 1.6)
- 링크: 짧은 URL, 커스텀 URL, 표시 이름·주소 수정(설정 > 내가 만든 URL)
- 폴더: 팩 폴더 생성·이동·삭제·순서, 가방 폴더 지정·이름 겹침·칩 순서, 다른 기기에서 지운 폴더가 되살아나지 않는지
- 홈: 캐러셀·고정·정렬(직접 정한 순서 포함)·목록 페이징, 보관함, "올리기 대기" 배지
- 제스처: 탭 넘기기, 폴더·보관함 밀어서 뒤로, 가방·메모·설정 하위 화면 밀어서 닫기, 세로 스크롤과 충돌 없음
- 설정: 화면 모드·글자 크기·글꼴·다 챙긴 아이템 아래로, 화면 켜두기(가방 더보기), 프로필·비밀번호·탈퇴, 휴지통, 문의, 공지·FAQ, 오프라인 가져오기, 백업, 버전 정보가 package.json과 같은지
- 로그인: 이메일 로그인·가입(인증 메일·다시 받기)·비밀번호 재설정, Google·Apple(포터블은 숨김), 게스트 → 계정 전환, 첫 프로필 설정, 오프라인 시작, 확인 중 로고만
- 계정: 비밀번호 바꾸기, 탈퇴(이메일: 틀린 비밀번호면 아무것도 안 지워짐 / 소셜: 재로그인 창), 오프라인 모드 프로필(배지·종료만)
- 연결 흐름: ① 로그인 상태로 와이파이 끄기 → 상태 줄, AI·첨부 누르면 안내 ② 끊긴 채 새 가방·팩 → 바로 열림·"올리기 대기", 다시 연결 → "N개를 계정에 올렸어요"·다른 기기에서 보임 ③ 와이파이는 두고 인터넷만 막기(폐쇄망 흉내) → 30초 안에 상태 줄 ④ 세션 없이 폐쇄망 실행(웹·포터블) → 바로 오프라인 모드 ⑤ 오프라인 모드에서 연결 → "로그인" 줄 → 새로고침 없이 계정 → 옮기기 시트 ⑥ 무료 3개 꽉 찬 상태에서 끊긴 채 새 가방 → 프리미엄 안내 ⑦ 옮기기 중 무료 초과 → "N개 옮김 · M개 남김", 다시 해도 중복 없음
- 절전 복귀: 노트북 덮고 몇 시간 뒤 열기 → 정상이거나 "다시 연결하고 있어요" 후 자동 새로고침, 그 뒤 저장·실시간 반영 정상. 콘솔에서 `window.dispatchEvent(new ErrorEvent("error",{error:new Error("FIRESTORE (test) INTERNAL ASSERTION FAILED: test")}))`로 흉내(2분 안 두 번이면 버튼 화면)
- AI: 메모로 가방 만들기, AI로 가져오기, 빠진 것 확인(한 번만 분석), 날씨 추천, 하루 횟수 초과 안내
- 넓은 화면: 900 미만 / 900~1199(2단+탭바) / 1200 이상(레일), 상세 전환, 설정 하위가 상세 칸에, 열린 가방 강조, 빈 새 가방 정리, 가운데 창 시트, 단축키 N·K·I·P·Esc
- 탭바(독): 세 탭 맨 아래 마지막 줄이 탭바 위에서 끝나는지, 글자 크기 크게, iPhone 홈 인디케이터, 팩 탭 빠른팩 줄, 검색 입력 중 숨김, 토스트 위치, 다크·투명도 줄이기
- 글꼴: 4종 각각 가방·메모 편집기·탭바·시트 넘침/잘림, 굵은 글씨, 기기 간 반영, 첫 화면 깜빡임, 포터블 오프라인, 메모 코드블록 D2코딩
- 아이콘: PWA 설치 아이콘·브라우저 탭·로그인 로고·빈 상세 칸 로고·포터블 앱 아이콘이 딥그린인지(설치된 PWA는 지웠다 다시 설치해야 바뀔 수 있음)
- 제한: 무료 가방 3개·팩 10개 초과 잠금, 공유 인원, 프리미엄 해제
- 환경: 웹, iOS 실기기, Electron 포터블 오프라인 로그인·로컬 저장·온라인 전환
- iOS 네이티브: 위젯 체크 · ↻, 잠금화면 체크, 알림 · 위젯 · 검색 결과를 누르면 그 가방, 단축어 4개, 로그아웃 때 위젯 · 검색에서 사라짐
- 관리자: 대시보드 숫자·추이, 유저 조회, 문의 답변(알림 도착), 이용권 만들기·무효화, 공지 작성·예약, 활동 로그

## 다른 PC(맥·회사 윈도우)에서 이어가기
- git pull 후 npm install
- .env.local은 git에 없음: 안전한 경로로 옮겨서 사용(`NEXT_PUBLIC_UI_V2`는 더 필요 없음)
- 새 채팅은 같은 "팩인백" 프로젝트에서 시작하고, `_secrets/claude/CLAUDE.md` → `HANDOFF.md` → `project-memory.md`를 먼저 읽게 한다(filesystem MCP). iOS는 저장소 `docs/packinbag_ios_native_plan.md`
- 문서 원본은 저장소 `docs/`. Claude 프로젝트 파일에 사본을 올리지 않는다(10/17부터 폴더를 직접 읽음)
- 다른 맥에서는 `_secrets/`가 없다(git 밖) → 비밀번호 관리자에서 키 · `.env.local`을 되살린다
- 새 채팅 첫 대화: Claude가 git pull 상태를 먼저 묻고, 전체 목업 링크를 먼저 보여준다(프로젝트 메모리에 저장됨)
- 상세 변경 이력은 docs/packinbag_settings_spec_v1.md 맨 위 표, 검증 항목은 docs/qa_checklist.md
