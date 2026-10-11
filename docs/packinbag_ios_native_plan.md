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

## 9. 다음 채팅에서 이어서 (10/10 기준)

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
2. Firebase Cloud Functions(Blaze) 새로: `functions/` 폴더, APNs .p8(Key ID GT8XUF9U3R · Team 2ZHYLWBV2H)을 Secret Manager에. APNs 직접(HTTP/2) vs FCM 결정
3. `bags/{bagId}` onUpdate 트리거 → 다른 멤버에게 10분 묶음 알림(추가 · 체크 · "다 쌌어요"), 담당 지정(assigneeUid 바뀜), 새 멤버(memberIds 늘어남 → 그룹장). 내 변경은 안 보냄, 설정 > 알림 종류별 끄기 · 가방별 끄기
4. 같은 트리거에서 조용한 푸시(content-available) → 앱이 `/api/native/summary` 받아 위젯 갱신
5. 실시간 현황 원격 갱신: `Activity.request(pushType: .token)` → 토큰을 서버에 → 다른 멤버가 체크하면 APNs liveactivity 푸시
6. 알림 눌렀을 때 그 가방 열기(로컬 알림과 같은 방식), 위젯 탭하면 그 가방 열기(`packinbag://` URL 스킴 추가)

**C. 1.5 제출 전 마무리**
- 앱 개인정보(App Store Connect "앱이 수집하는 개인정보")·처리방침 `app/privacy`에 푸시 토큰 · 기기 토큰 추가, 처리방침 URL을 seeuson.com으로
- 심사 메모 "Native features"에 local notifications · push · widgets · Live Activities · Shortcuts 추가, 앱 설명에 "알림 · 위젯 · 잠금화면" 단락
- FAQ(`lib/faqs.ts`) "푸시 알림 준비 중" 답변 · 여행 전용 말투 정리, 설정 > 버전 정보(CHANGELOG) 1.5 항목
- 스크린샷에 위젯 · 잠금화면 한 장 넣을지(선택)
- Archive → TestFlight(Build 5) → 출시가이드 A-3 점검표 → A-4 제출

**D. 나중에**
- AppShell · AuthProvider 기존 eslint 오류(set-state-in-effect) 정리(기본 lint 범위 밖)
- 결제 도입 시 Capacitor 8 + purchases-capacitor 13.x 업그레이드 먼저(출시가이드 B-6)
- 4·5가 길어지면 1.6으로 넘길 수 있음
