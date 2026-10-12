# 팩인백 iOS 네이티브 기능 기획 (1.5) — 2026-10-10

함께 볼 문서: `packinbag_iap_release_guide.md`(A-2a), `packinbag_리디자인_작업계획.md`(로드맵)
앱은 server.url 구조(웹 화면을 불러옴). 네이티브 기능은 Swift(위젯 확장 · App Intents · ActivityKit) + 작은 Capacitor 플러그인으로 앱(웹)과 연결한다.
웹에 올린 코드는 스토어 1.3 앱에도 뜨므로, 웹 쪽 호출은 플러그인이 있을 때만 동작하게 한다.

## 1. 푸시 · 알림
| 종류 | 방식 | 내용 |
|---|---|---|
| 공유 가방 변경 | 서버 푸시(묶음) | 다른 멤버의 추가·체크·"다 쌌어요"를 10분 정도 모아 한 번. 내 변경은 안 보냄 |
| 담당 지정 | 서버 푸시 | "OO님이 아이템 N개를 맡겼어요" |
| 새 멤버 참여 | 서버 푸시 | 가방 그룹장에게만 |
| D-Day | 로컬 알림 | 가방마다 D-N일 · 시간 선택. 내용은 예약 시점에 고정(남은 개수 X) |
| 반복 리마인더 | 로컬 알림 | 가방마다 요일 · 시간 반복("월~금 7:30 출근 가방") |
- 제외: 문의 답변 푸시, 공지·이벤트(광고성 동의 필요)
- 설정 > 알림: 종류별 켜기/끄기. 가방 더보기: 이 가방 알림 끄기 · D-Day · 반복 리마인더 설정
- 알림을 누르면 그 가방이 열림(딥링크)
- 서버: Firebase Cloud Functions(Blaze 요금제 확인 10/10) Firestore 트리거로 변경 감지 → 묶음 → APNs

## 2. 홈 · 잠금화면 위젯 (iOS 17 이상, 앱은 15.6 유지)
- 단위는 **팩 하나**(가방 X)
  - Small: 팩 이름 · 진행(n/m) · 아이템 3개 정도
  - Medium: 아이템 4~6개
  - Large: 아이템 10~12개 + 남은 개수
- 길게 눌러 편집: 가방 → 팩 선택 / 테마(시스템 · 라이트 · 다크) / 글꼴 · 글자 크기(앱과 같은 4종 글꼴)
- **체크박스 아이템만** 표시(글 아이템 제외)
- 위젯에서 바로 체크: 누르면 취소선 + 맨 아래로, 다시 누르면 해제(위젯은 앱 설정과 상관없이 항상 아래로)
- 잠금화면 위젯: D-Day, 남은 개수(원형 · 한 줄)
- 데이터: 앱이 App Group에 저장한 요약 + "팩인백 새로고침" 단축어 · 조용한 푸시로 갱신

## 3. 실시간 현황 (Live Activity, iOS 16.2 이상 · 잠금화면 체크는 17 이상)
- 가방 더보기 > "잠금화면에 띄우기" → 팩 선택. 최대 8시간 표시 + 종료 뒤 최대 4시간 잠금화면에 남음
- 꾸미기(시작할 때 고름, 앱 설정에 기억): 배경 시스템 · 라이트 · 다크 / 글꼴 / 글자 크기(작게 · 보통 · 크게)
  - 길게 눌러 편집은 없음(Live Activity는 위젯 편집 방식이 안 됨)
  - 다이내믹 아일랜드는 항상 검은 바탕(색은 글자·강조색만)
- 잠금화면에서 체크, 다 챙기면 자동 종료. 남은 것 위 몇 개 + "외 N개"(데이터 4KB 제한)
- 다른 멤버 체크 반영은 서버에서 APNs Live Activity 업데이트

## 4. 단축어 (App Intents, iOS 16 이상)
- **빠른팩에 입력**: 실행하면 화면 위에 입력창(시스템 입력 대화상자) → 앱을 열지 않고 빠른팩에 추가
- **팩인백 새로고침**: 서버에서 최신 요약을 받아 App Group 갱신 → 위젯 · 실시간 현황 바로 반영
- 둘을 이어 붙여 쓰는 게 기본 사용법. 새로고침은 단축어 자동화(매일 아침 · 집 도착 등)로도 사용 가능
- 앱 설치만 하면 단축어 앱에 바로 보이도록(App Shortcuts). Siri 문구 예: "팩인백 빠른팩에 입력"
- 끊겼을 때 빠른팩 입력은 App Group에 쌓아 두고 다음 연결 때 올림

## 5. 공통 기반
- 네이티브(위젯 · 단축어 · Live Activity)는 웹의 Firebase를 쓸 수 없음 → **서버 API + 기기 토큰**
  - 앱 로그인 상태에서 서버가 기기 토큰 발급 → 키체인(App Group 공유)에 저장. 로그아웃 · 탈퇴 · 설정에서 해제 시 무효화
  - API: 요약 받기 / 아이템 체크 · 해제 / 빠른팩 추가. 본인 가방만, 횟수 제한
- Apple Developer: APNs 키(.p8) · App Group `group.com.appfle.packinbag` · 위젯 확장 ID
- Xcode: 서명 자동, Capability(Push · Background Modes · App Groups), Widget Extension 타깃(위젯 + Live Activity 함께)
- Capacitor 플러그인(앱 안 로컬 플러그인): 요약 쓰기 · 위젯 새로고침 · Live Activity 시작/끝 · 로컬 알림 예약
- 앱 개인정보 · 처리방침: 푸시 토큰 · 기기 토큰 항목 추가

## 6. 순서 (10/10 확정)
1. 기반 + 로컬 알림(D-Day · 반복 리마인더) — 🔄 10/10 코드 완료, 기기 확인 중
   - `lib/v2/bagReminders.ts`(계획·예약·누름), `components/v2/bag/sheets/ReminderSheet.tsx`, 더보기 "챙길 때 > 알림", `UserProfile.bagReminders`(AuthProvider 매핑 · `updateBagReminder`), AppShell 예약 · 알림 누르면 가방 열기
   - 여행 외 반복 가방용으로 D-Day 없이도 반복 알림은 됨. D-Day 선택지 D-7·D-3·D-1·당일 + 직접(1~30), 기본 시간 09:00 / 07:30(바꿀 수 있음)
2. 위젯(팩 단위 3크기 · 편집 · 잠금화면) + 단축어 2개
3. 서버 푸시(공유 묶음 · 담당 지정 · 새 멤버)
4. 실시간 현황(꾸미기 · 잠금화면 체크)
5. 위젯 바로 체크 · 다른 멤버 변경 실시간 반영
- 10/10 결정: 2~5를 **한번에** 진행(사용자). 진행 순서는 서버·웹 → 위젯 타깃 → 위젯·단축어·체크 → 실시간 현황 → 서버 푸시(알림 + 위젯·실시간 현황 원격 갱신)

## 7. 구현 현황 (서버 · 웹, 10/10)
- 기기 토큰: `lib/nativeDeviceServer.ts`(SHA-256만 저장 `deviceTokens/{hash}`, 토큰당 하루 800회, 계정당 10개), `POST/DELETE /api/native/device-token`
- `GET /api/native/summary`(가방 요약), `POST /api/native/toggle-item`(체크·해제, 멤버·잠김·packsRev 규칙 동일, 다 챙기면 lastPackedAt), `POST /api/native/quick-add`(빠른팩, 줄마다 1개 · 최대 20)
- 요약 모양: `lib/nativeSummary.ts`(체크리스트 팩의 체크 아이템만, 가방 30 · 팩당 80 · 80자, 메모 본문 없음)
- 웹 다리: `lib/v2/nativeBridge.ts`(로그인 계정 토큰 → 네이티브, 가방 바뀌면 요약 → 네이티브), AppShell에서 호출. 네이티브 플러그인 이름 `PackInBagNative`
- firestore.rules: `deviceTokens` 클라이언트 접근 금지(명시)
- 위젯 글꼴: 앱 글꼴은 woff2라 iOS가 못 씀 → TTF/OTF를 따로 위젯에 넣어야 함(없으면 시스템 글꼴로)

## 8. 구현 현황 (네이티브, 10/10)
- Xcode: 위젯 타깃 `PackInBagWidgetExtension`(iOS 17, App Groups, 버전 1.5/5, 표시 이름 팩인백, Swift 플래그 `PIB_WIDGET`). `ios/App/Shared/`는 **앱 · 위젯 두 타깃에 같이 들어가는 동기화 폴더**(pbxproj에 직접 등록). 앱 Info.plist `NSSupportsLiveActivities`
- Shared: `PIBShared.swift`(요약 모델 · App Group 저장 · 서버 호출), `PIBActivity.swift`(실시간 현황 데이터 · 시작/갱신/종료), `PIBIntents.swift`(아이템 체크 · 새로고침 · 빠른팩에 입력)
- 위젯 폴더: `PIBStyle.swift`(배경 · 글꼴 · 크기 · 색), `AppIntent.swift`(위젯 편집: 팩 · 배경 · 글꼴 · 글자 크기), `PackInBagWidget.swift`(홈 3크기 + 잠금화면 위젯), `PackInBagWidgetLiveActivity.swift`(잠금화면 · 다이내믹 아일랜드). Control 템플릿은 안 씀(파일 삭제는 git rm)
- 앱: `AppDelegate.swift`에 `MainViewController`(Main.storyboard 최상위) · `PackInBagNativePlugin` · 단축어 `PackInBagShortcuts`
- 웹: 더보기 "챙길 때 > 잠금화면에 띄우기" → `LiveActivitySheet.tsx`(팩 · 배경 · 글꼴 · 글자 크기, 이 기기에 기억)
- 남은 것: 서버 푸시(APNs - 공유 묶음 · 담당 · 새 멤버 알림 + 위젯 조용한 갱신 + 실시간 현황 원격 갱신), 위젯 글꼴 파일
- 10/10 후속 수정: 위젯 체크는 위젯 확장에서 바로(`ToggleItemIntent` AppIntent) + 못 보낸 체크 큐(`PIBStore.pending` · `PIBSync.flush`, 거절되면 되돌림), 잠금화면은 `ToggleItemLiveIntent`. 취소선은 overlay로 직접. 줄 수는 위젯 높이 · 글자 크기로 자동. 실시간 현황 여백 20/18 · 투명도(p100/80/60/40, 위젯 편집에도). 글꼴은 코드로 등록 + 가족 이름으로 찾기(`PIBFonts`), 파일은 `ios/App/PackInBagWidget/Fonts/`

## 9. 다음 채팅에서 이어서 (10/11 기준)

> **10/11 23:04 iOS 1.5 (Build 5) 심사 제출 완료** (제출 ID `406ecb16-1b77-4577-83c2-b91ee3ca7500`, 수동 출시). C 끝. 승인 메일이 오면 1.5 페이지에서 "이 버전 출시", 거절되면 메일 원문으로 대응
> 같이 나간 것: 웹 v1.0.32(FAQ · 업데이트 노트 · 개인정보처리방침 · /privacy · /support 스크롤), Functions, 스크린샷 10장(09 위젯 · 10 잠금화면, 6.3″), 앱 개인정보에 기기 ID 추가, 처리방침 URL seeuson.com

**10/11 끝난 것 · 남은 것(요약)**
- 끝: 버그 4건, B-1~B-6 전부(푸시 토큰 · Cloud Functions · 공유 가방 알림 · 조용한 푸시 · 실시간 현황 원격 갱신 · 누르면 가방 열기), 위젯 · 실시간 현황 ↻ + "N분 전", 30분 자동 새로고침, 단축어 "가방에 추가", 위젯 "가방 전체" · 크게 2열, 배경 투명도 제거
- 기기 확인 완료: 푸시 토큰 저장, 테스트 알림, 활동 묶음 알림, 담당 지정 알림, 단축어(빠른팩 · 새로고침)
- 기기 확인 남음: 버그 4건 수정, 새 멤버 알림, "다 쌌어요", 알림 끄기(종류별 · 가방별), 조용한 푸시로 위젯 갱신, 실시간 현황 원격 갱신(다시 띄워야 토큰 생김), 누르면 가방 열기, ↻ · 시각 표시, 단축어 "가방에 추가", 가방 전체 · 2열, 로그아웃/계정 전환 때 위젯
- 다음: C(1.5 제출 전 마무리) → Archive → TestFlight(Build 5)
- 배포 메모: Functions 배포는 `npx firebase-tools deploy --only functions`(루트에서), 로그는 `npx firebase-tools functions:log --only onBagUpdated,flushBagActivity`. `firebase-functions` v6 업그레이드 경고는 나중에

**10/11 오후 수정(C 들어가기 전)**
- 새로고침 시각: "N분 N초 전" → 오늘이면 "14시 05분에 새로고침", 다른 날이면 "10/9 14시 05분"(`pibSyncedLabel`, 홈 위젯 · 실시간 현황 · 잠금화면 사각)
- 위젯 편집 2단계: "가방"(`BagEntity`, 곧 출발 D-7 이내 · 고정한 가방 · 최근 쓴 가방 묶음 + 검색) → "팩"(`WidgetPackEntity`, 그 가방 팩만, 맨 위 가방 전체). 팩을 비우거나 예전 가방 팩이 남아 있으면 가방 전체. 예전 `PackEntity`는 없앴다 → 이미 놓인 위젯은 다시 골라야 함
  - 가방 묶음 · 검색은 단축어 "가방에 추가"에도 같이 적용(같은 `BagEntity`)
  - 요약(`lib/nativeSummary.ts`)에서 보관함 가방 제외 + `pinned`, 고정 가방이 먼저(30개 안에). 서버 요약은 users 문서를 한 번 더 읽음
- 가방 알림: 더보기 오른쪽 글이 소식 + D-Day · 반복을 합침("소식 · D-1 · 평일 07:30", 일부만이면 "소식 일부"). 예전에는 알림만 봐서 소식을 받는데도 "꺼짐"
  - 알림 시트: "이 가방 소식 받기"(pushMutedBagIds) 아래 종류별 3개(새 멤버는 그룹장만), `UserProfile.bagPushOff[bagId]`(끈 종류). 설정 > 알림에서 끈 종류는 흐리게. Functions `wantsPush`가 bagPushOff도 봄 → **Functions 재배포 필요**
- 비밀 파일: 프로젝트 맨 위 `_secrets/`(폴더째 gitignore) + `_secrets/README.md`에 목록. `.env.local`은 맨 위 그대로
- 실시간 현황 잘림: iOS가 잠금화면 카드를 최대 160pt로 자름 → 아이템 2열 2줄(최대 4개), "외 N개 · 시각" 한 줄. 홈 위젯은 체크 아이템 없는 팩이면 "체크할 아이템이 없어요"
- 잠금화면에 띄우기: 팩 맨 앞 "전체"(packId `*`, 기본값). `ContentState.itemPacks`(아이템 → 원래 팩)로 체크, 서버 `functions/src/live.ts`도 `*` 처리 → **Functions 재배포**
  - 배경 "직접": 색 8개 + iOS 기본 색 고르기 창(`PackInBagNative.pickColor`, UIColorPickerViewController · 불투명도 포함) + 불투명도 슬라이더(20~100%). `PackActivityAttributes.bgColor/bgAlpha`, 글자색은 배경 밝기로. 투명도는 10/11 오전에 "기기에서 안 비침"으로 뺀 적 있음 → `activityBackgroundTint`에 투명도를 주는 방식으로 다시 확인
- 버그: 실시간 현황을 다 체크한 뒤 해제가 안 됨(가방에는 해제됨). 다 챙기는 순간 `end`(5분 뒤 사라짐)를 불렀는데 끝난 화면은 고칠 수 없었다 → 다 챙겨도 `update`만 하고 `ContentState.doneAt` 기록, 5분 지나면 다음 `updateAll` 때 내림. 서버 `live.ts`도 다 챙겨도 end를 안 보냄(팩이 사라질 때만). 홈 위젯은 요약을 직접 고치는 방식이라 같은 문제 없음
- 단축어 "잠금화면 다시 띄우기"(`RestartLiveIntent`, LiveActivityIntent): iOS 8시간 제한은 띄운 때부터라 갱신으로는 안 늘어남 → 같은 설정으로 내렸다 새로 띄움(`PIBLiveActivity.restart`). 끝난 직후(잠금화면에 남아 있는 동안)도 됨, 없거나 다 챙긴 건 안 띄움. 사용자는 단축어 자동화(특정 시간 · 즉시 실행)로 0 · 8 · 16시. 사용 가이드 · FAQ에 안내 필요(C)

(아래는 10/10에 적은 계획과 그 진행 기록)

**10/11 버그 수정(웹 3 · iOS 1)**
- 팩 마지막 아이템을 체크하면 풀림: 저장 A가 끝날 때 dirty를 무조건 내려, 그 사이 체크한 B가 A의 스냅샷에 덮였다(공유 가방 트랜잭션에서 잘 보임) → `useBagDocument` 변경 번호(`editSeqRef`)로 새 변경이 없을 때만 dirty 해제
- 구글 로그인 때 기존 계정인데 닉네임 화면이 잠깐: 로그아웃 때 캐시를 지워 `ensureUserDoc`의 내 쓰기(닉네임 없음) 스냅샷이 먼저 옴 → users 구독 `includeMetadataChanges`, 닉네임 없는 캐시·대기 쓰기 스냅샷은 서버 답까지 로딩 유지
- 로그아웃하면 오프라인 모드로: 세션 없음 + 연결 확인 실패 → 자동 오프라인은 **앱 시작 때만**(`authResolvedOnceRef`). 로그아웃 뒤엔 항상 로그인 화면
- 아이콘 누르면 스플래시가 확대됐다 줄어듦: `LaunchScreen.storyboard`가 정사각 이미지를 꽉 채워(aspectFill) 로고가 웹(104pt)의 약 2배 → 가운데 404pt 고정(로고 ≈104pt), 흰 바탕. 런치 화면은 iOS가 캐시하니 앱을 지웠다 다시 설치해서 확인
먼저 확인: 사용자가 10/10 마지막 빌드(여백 · 투명도 · 글꼴)를 테스트했는지, 글꼴 zip(프리텐다드 · 개구 · D2코딩) + 지마켓 산스 TTF(Medium · Bold)를 `Fonts/`에 넣었는지, 커밋·푸시했는지

**A. 테스트 결과 반영**
- 위젯: 체크 즉시 반영 · 취소선 · 줄 수 자동 · 배경/투명도/글꼴/글자 크기 · 잠금화면 위젯(원형 · 한 줄 · 사각형)
- 실시간 현황: 여백 · 투명도 · 잠금화면 체크 · 다 챙기면 자동 종료 · 다이내믹 아일랜드
- 단축어: "빠른팩에 입력"(위 입력창 → 빠른팩) + "팩인백 새로고침" 이어 붙이기, Siri
- 로그아웃 → 위젯이 "로그인하면…"로 바뀌는지, 다른 계정 로그인 시 예전 계정 내용이 안 보이는지
- 알려진 한계: 요약은 최근 가방 30개만(그 밖 가방은 실시간 현황 "팩을 찾을 수 없어요" 가능), 홈 위젯 투명도는 iOS가 배경화면을 비추는지 기기에서 확인 필요

**B. 서버 푸시(3단계 · 5단계 남은 부분)**
1. `@capacitor/push-notifications@^6` 설치 + `capacitor.config.ts` includePlugins에 추가, 앱 푸시 토큰을 서버에 저장(기기 토큰 문서에 묶기 또는 `users/{uid}/pushTokens`)
   - ✅ 10/11 코드 완료. **기기 토큰 문서에 묶음**: `deviceTokens/{hash}.apns = { token, env: sandbox|production, alerts, updatedAt }` → 로그아웃·계정 전환 때 같이 사라짐, 같은 푸시 토큰이 다른 문서에 있으면 떼 냄
   - 등록·업로드는 네이티브(`AppDelegate.swift` `PIBPush`): setSession · 앱 시작 때 `registerForRemoteNotifications`(알림 권한 불필요), `POST /api/native/push-token`(Device 인증). 바뀐 게 있을 때만 올림(화면 복귀 시 권한 변화 확인)
   - env는 `#if DEBUG` sandbox / Release production. 플러그인은 B-6 알림 누름을 웹에서 받으려고 지금 넣어 둠(Build 5에 포함되면 이후는 웹 배포만으로), foreground 배너 없음
   - 알림 권한 요청 시점은 B-3(설정 > 알림)에서. 지금은 로컬 알림을 켜며 허용한 사람만 alerts true
2. Firebase Cloud Functions(Blaze) 새로: `functions/` 폴더, APNs .p8(Key ID GT8XUF9U3R · Team 2ZHYLWBV2H)을 Secret Manager에. APNs 직접(HTTP/2) vs FCM 결정
   - ✅ 10/11: **APNs 직접**(토큰이 APNs 원본이라 FCM 불필요). Secret `APNS_KEY_P8` 등록 완료(version 1)
   - `functions/`(Node 22, firebase-functions v6, 리전 asia-northeast3): `src/apns.ts`(JWT ES256 50분 재사용, HTTP/2, env별 호스트, 410·BadDeviceToken 등 = 죽은 토큰), `src/devices.ts`(uid로 deviceTokens 찾기 · 보내기 · 죽은 토큰의 apns 지우기, alert는 alerts true 기기만), `src/index.ts`(`sendTestPush` 호출형 - 5초 뒤 내 기기에 테스트 알림)
   - 웹: 설정 > 정보 > "테스트 알림 보내기"(`lib/v2/pushTest.ts`, iOS 1.5 앱만, 권한 없으면 물어봄). B-3에서 설정 > 알림으로 옮김
   - 루트 tsconfig·knip에서 functions 제외, `.gitignore`에 functions/lib·node_modules·`*.p8`
   - 배포: `cd functions && npm install && cd .. && npx firebase-tools deploy --only functions`(predeploy가 build)
3. `bags/{bagId}` onUpdate 트리거 → 다른 멤버에게 10분 묶음 알림(추가 · 체크 · "다 쌌어요"), 담당 지정(assigneeUid 바뀜), 새 멤버(memberIds 늘어남 → 그룹장). 내 변경은 안 보냄, 설정 > 알림 종류별 끄기 · 가방별 끄기
   - ✅ 10/11 코드 완료(결정: 10분 묶음, 추가·체크·다 쌌어요 전부, 기본 켜짐 = iOS 허용 창이 옵트인, 광고성 알림 없음)
   - 누가 바꿨는지: 가방 문서 `editedBy`(앱 자동저장 `bagContentPatch` · 공유 트랜잭션 · 위젯 `toggle-item`이 자기 uid). 규칙: 바꿀 때는 본인 uid만
   - `functions/src/bagEvents.ts`: `diffBag`(새 아이템 · 체크됨 · 다 쌌음 · 담당 바뀜 · 새 멤버), `enqueueActivity`(→ `pushQueue/{bagId}` actors별 합계, dueAt = 첫 활동+10분, 다 쌌으면 즉시), `flushDue`(받는 사람별로 자기 활동 빼고 문구, collapse `activity-{bagId}`), `sendImmediate`(담당 · 새 멤버)
   - `index.ts`: `onBagUpdated`(혼자 쓰는 가방은 바로 종료), `flushBagActivity`(2분마다) → 실제 지연 10~12분
   - 설정: `UserProfile.pushPrefs { activity, assign, member }`(없으면 켜짐) · `pushMutedBagIds`, AuthProvider 매핑 + `updatePushPref` · `setBagPushMuted`
   - 화면: 설정 > 알림(권한 상태 · 종류별 토글 · 테스트 알림), 가방 더보기 > 알림 "이 가방 소식 받기", 끄면 토스트. 공유 가방을 처음 열 때 iOS 허용 창 1회(사용 가이드 뜨는 처음은 다음으로), 거절 상태면 토스트 1회(`lib/v2/serverPush.ts`, `pushTest.ts`는 합침)
   - 알리지 않음: 체크 해제 · 삭제 · 이름 바꾸기 · 메모 수정, editedBy 없는 변경(옛 포터블 등)
4. 같은 트리거에서 조용한 푸시(content-available) → 앱이 `/api/native/summary` 받아 위젯 갱신
   - ✅ 10/11: 함께 쓰는 가방 팩이 바뀌면 `pushSilent/{bagId}` 표시 → `flushBagActivity`(2분마다)가 멤버 기기에 background 푸시 1번(`functions/src/live.ts`). 앱 `AppDelegate didReceiveRemoteNotification` → 요약 받기 → 위젯 · 실시간 현황. iOS가 횟수를 줄일 수 있고 강제 종료한 앱에는 안 옴
5. 실시간 현황 원격 갱신: `Activity.request(pushType: .token)` → 토큰을 서버에 → 다른 멤버가 체크하면 APNs liveactivity 푸시
   - ✅ 10/11: 시작 때 `pushType: .token`(안 되면 토큰 없이), `pushTokenUpdates` → `POST /api/native/live-token`(그 가방 멤버만) → `deviceTokens.apnsLive { token, bagId, packId, env }`. 내리면 DELETE
   - `onBagUpdated`: 팩이나 이름이 바뀌면(혼자 쓰는 가방도) `apnsLive.bagId`로 찾아 content-state 보냄(다 챙기면 end + 5분 뒤 내림), `onBagDeleted`는 end. content-state는 `ContentState`와 같은 모양(`syncedAt`은 1970년 초)
   - 잠금화면 체크는 보이는 값을 기준으로(`PIBLiveActivity.toggle`), `updateAll`은 요약이 더 오래되면(syncedAt) 되돌리지 않음
6. 알림 눌렀을 때 그 가방 열기(로컬 알림과 같은 방식), 위젯 탭하면 그 가방 열기(`packinbag://` URL 스킴 추가)
   - ✅ 10/11: `lib/v2/bagReminders.onBagNotificationTap`이 로컬 알림 + 서버 푸시(`pushNotificationActionPerformed` data.bagId) + `appUrlOpen` · `getLaunchUrl`(`packinbag://bag/{id}`)을 한 곳에서 받음(AppShell은 그대로). Info.plist URL 스킴 `packinbag`, 위젯 · 잠금화면 위젯 · 실시간 현황 · 다이내믹 아일랜드에 `widgetURL`
7. (10/11 추가 요청) 위젯 · 실시간 현황 새로고침 버튼 + "N분 전"
   - ✅ 자동 새로고침 = 안전망으로 30분마다(`PIB.staleAfter`, 30분 넘게 지난 요약만 서버). 다른 기기에서 고친 혼자 쓰는 가방(조용한 푸시는 공유 가방만) · iOS가 버린 조용한 푸시를 따라잡는 용도. 자정에는 D-Day 다시 그림(예전: 20분 주기 · 15분 기준)
   - 홈 위젯 맨 아래 줄: `Text(.relative) + " 전"`(저절로 올라감) + ↻(`RefreshWidgetIntent`, 위젯 확장에서 서버 요약). 실시간 현황: ↻(`RefreshLiveIntent`, 앱 프로세스). 잠금화면 사각 위젯은 다 챙기면 시각 표시(버튼 없음)
   - 시각 = `PIBStore.summarySavedAt`(서버 · 앱에서 받은 시각, 위젯 체크는 안 바뀜), 실시간 현황은 `ContentState.syncedAt`
   - 다른 멤버 변경은 4·5번 푸시로 바로, 나머지는 30분 안전망 · ↻ (10/11 사용자 확정: 자동 새로고침도 유지)
8. (10/11) 단축어 "가방에 추가": 가방(필수) → 팩(선택, 비우면 미분류) → 내용. `AddToBagIntent` · `BagEntity` · `BagPackEntity`(고른 가방 팩만 - `IntentParameterDependency`, 미분류는 목록에서 빠짐), `POST /api/native/add-item`(미분류 없으면 맨 앞에 새로, 팩 10개 제한, 줄마다 1개 · 최대 20, editedBy). App Shortcuts에 추가
   - 요약(`lib/nativeSummary.ts`): 미분류가 맨 앞 + `inbox: true`, 체크 아이템이 없는 팩도 포함(빈 미분류만 뺀)
9. (10/11) 위젯 "가방 전체": 위젯 편집 팩 목록 맨 위(`bagId|*`). 팩 순서대로(미분류 먼저) 아이템을 잇고(`pibWholeBag`), 체크는 아이템의 원래 팩으로(`itemPacks`). 챙긴 것은 전체에서 아래로
   - 크게(large) 위젯은 아이템 2열(왼쪽→오른쪽, 위→아래 - 앱 가방 화면과 같은 순서). 작게 · 중간은 1열
10. (10/11) 배경 투명도 옵션 **제거**(위젯 편집 · 잠금화면에 띄우기 시트 · `PIBStyle.opacity` · `PackActivityAttributes.opacity`). iOS가 위젯 · 실시간 현황 밑에 자기 바탕을 깔아 기기에서 투명하게 보이지 않았음(사용자 결정). 배경은 테마 색 불투명

**C. 1.5 제출 전 마무리** — ✅ 10/11 완료
- 앱 개인정보(App Store Connect "앱이 수집하는 개인정보")·처리방침 `app/privacy`에 푸시 토큰 · 기기 토큰 추가, 처리방침 URL을 seeuson.com으로
- 심사 메모 "Native features"에 local notifications · push · widgets · Live Activities · Shortcuts 추가, 앱 설명에 "알림 · 위젯 · 잠금화면" 단락
- FAQ(`lib/faqs.ts`) "푸시 알림 준비 중" 답변 · 여행 전용 말투 정리, 설정 > 버전 정보(CHANGELOG) 1.5 항목
- 스크린샷에 위젯 · 잠금화면 한 장 넣을지(선택)
- Archive → TestFlight(Build 5) → 출시가이드 A-3 점검표 → A-4 제출

**D. 나중에**
- ~~AppShell · AuthProvider 기존 eslint 오류(set-state-in-effect) 정리~~ → 10/11 완료. 확인 명령에 `contexts components/AppShell.tsx`도 넣는다
- 결제 도입 시 Capacitor 8 + purchases-capacitor 13.x 업그레이드 먼저(출시가이드 B-6)
- 4·5가 길어지면 1.6으로 넘길 수 있음

## 10. 1.6 네이티브 묶음 (10/12 기획 · 웹쪽은 먼저 완료)
웹에서 만든 것은 이미 배포 가능(1.5 앱에서는 네이티브가 없으면 조용히 건너뜀). 아래는 Xcode 27에서 할 일.

> **10/12 진행**: 1~5 코드 완료(기기 확인 전). 웹 v1.0.34 + iOS 1.6(Build 6)으로 한번에 배포
> - 4(A안 확정): 보관함 팩은 앱이 열려 있을 때 웹이 요약 `library`로 넘김(`buildNativeLibrary`, 휴지통 · 빠른팩 · 올리기 대기 · 폴더 · 개인 잠금 제외, 최근 100개, 메모 본문 없음). 서버 요약에는 없고 네이티브 `PIBStore.save`가 없으면 예전 목록 유지
>   - 엔티티: `BagEntity` · `BagPackEntity`(부제 가방 이름) · `LibraryPackEntity` → `IndexedEntity`(iOS 18+). App Schema는 맞는 도메인이 없어 안 씀
>   - 색인: AppDelegate `PIBSpotlight.reindex()`(saveSummary · 조용한 푸시 뒤, id·이름이 바뀌면 바로 / 부제만 바뀌면 30분에 한 번), 로그아웃 때 `clear()`
>   - 열기: `OpenBagIntent` · `OpenBagPackIntent` · `OpenLibraryPackIntent` → `PIBOpen`(브리지 준비 전이면 미뤘다가) → Capacitor appUrlOpen → 웹 `onBagNotificationTap(cb(bagId, packId), onLibrary)` → AppShell(가방 + `bagFocus.packId` / 팩 탭 + 보관함 팩)
> - 5: 엔타이틀먼트 · AASA · 웹 처리가 이미 있어 기기 확인만
> - 1: `PackInBagNativePlugin.biometricInfo` · `authenticateBiometric`(생체 인증만, 대체 버튼 "PIN 입력" → ok:false), Info.plist `NSFaceIDUsageDescription`
> - 2: `PackActivityAttributes.textTone/textColor`(옵셔널, auto는 nil로 저장), `PIBLiveActivity.start/restart`가 넘김, `PackLockScreenView.toned`(흰색 72% · 검정 #17171A 62% · 직접 72% - 웹 미리 보기와 같은 값). 강조색 · 진행 막대 · 다이내믹 아일랜드는 그대로
> - 3: `PIBColumns`(PIBStyle.swift) + `ConfigurationAppIntent.columns`(기본 2열). 작게 1열 고정. 이미 놓인 중간 위젯도 2열로 바뀜. 잠금화면 위젯 편집에도 "열 수"가 보이지만 쓰지 않음(같은 인텐트)
1. **Face ID(개인 잠금)**: `PackInBagNativePlugin`에 `biometricInfo()` → `{ available, type: faceId|touchId|opticId|none }`(LAContext.canEvaluatePolicy `.deviceOwnerAuthenticationWithBiometrics`), `authenticateBiometric({ reason })` → `{ ok }`(evaluatePolicy, 취소·실패는 ok:false). Info.plist `NSFaceIDUsageDescription`("잠근 가방·팩을 열 때 Face ID를 써요"). 웹: `lib/v2/biometric.ts`
2. **잠금화면 글자색**: `startLiveActivity` 옵션 `textTone`(auto|white|black|custom) · `textColor`("#RRGGBB") → `PackActivityAttributes`에 추가(옛 활동 디코딩 위해 옵셔널). `PackLockScreenView`에서 auto가 아니면 `c.ink`를 그 색, `c.sub`를 같은 색 72%로. `RestartLiveIntent`도 새 값 그대로 넘기기. 다이내믹 아일랜드는 그대로(다크). 웹 미리 보기 기준: `LiveActivitySheet.tsx` LockScreenPreview
3. **위젯 열 수**: `ConfigurationAppIntent`에 "열 수"(1열 · 2열, 기본 2열) 추가, 중간(systemMedium)에서도 2열 가능. `PackWidgetView.packView`의 `columns = family == .systemLarge ? 2 : 1` → 작게는 1열 고정, 중간 · 크게는 설정값
4. **iOS 27 Siri 검색**: `BagEntity` · 팩 · 보관함 팩을 `IndexedEntity`(+ App Schema)로, 열기는 `packinbag://bag/{id}?pack=` · `packinbag://library/{id}`(웹 라우팅 추가 필요). 색인은 App Group 요약을 기준으로, 개인 잠금으로 잠근 것은 요약에서 이미 빠짐(`lib/nativeSummary.ts`). 보관함 팩은 요약에 없으니 요약에 `library` 목록 추가 필요
5. **유니버설 링크**: Associated Domains `applinks:packinbag.seeuson.com` + `public/.well-known/apple-app-site-association`(appID `2ZHYLWBV2H.번들ID`, `/v/*` `/s/*` `/c/*`). 앱에서 https 주소를 `appUrlOpen`으로 받아 같은 경로로 이동(`onBagNotificationTap` fromUrl에 추가). 카톡 안 브라우저는 여전히 브리지(`lib/v2/appBridge.ts`, `packinbag://open?to=`)
