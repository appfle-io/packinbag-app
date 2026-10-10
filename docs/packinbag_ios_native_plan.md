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
- 4·5가 길어지면 1.6으로 넘길 수 있음
