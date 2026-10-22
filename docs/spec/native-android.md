# Android 네이티브 — native-android.md

기준 코드: 웹 1.8.x(Android 앱 없음, 2026-10-22). **Android 앱은 아직 없다.** 이 문서는 웹 코드에 이미 들어간 Android 분기와, 앱을 만들 때 채울 규칙을 적는다. 기획 · 순서 · 결정은 `docs/packinbag_android_plan.md`(AND-* ID), iOS 쪽 같은 기능은 `native-ios.md` ID를 가리킨다.

- 판별: `lib/v2/platform.ts` `isAndroidApp()`(`Capacitor.getPlatform() === "android"`). Android 브라우저의 웹은 false(웹과 같음)
- 1차 출시 범위(10/22 결정): A단계만 — 웹 기능 전부 + 뒤로 가기 · 로그인(Google · 이메일) · 로컬 알림 · App Links. 서버 푸시(FCM) · 위젯 · 실시간 현황 · 생체 인증은 다음
- 웹 쪽 네이티브 호출은 iOS와 같이 플러그인이 있을 때만(NAT-AVAIL-01) → Android에 `PackInBagNative`가 없으면 위젯 · 잠금화면 · Face ID 줄은 저절로 숨겨진다

---

## 1. ANDN-WEB 웹 코드에 들어간 Android 분기 (10/22)

| ID | 규칙 | 코드 |
|---|---|---|
| ANDN-WEB-01 | 하드웨어 뒤로 가기 — shell.md SHELL-BACK-01~04 | `lib/v2/androidBack.ts` · `AppShell` · `SlideScreen` · `PageStack` · `lib/useEscapeToClose.ts` |
| ANDN-WEB-02 | Apple 로그인 버튼 숨김(로그인 화면 · 계정 연결 시트). Google · 이메일 · 게스트는 그대로 — auth.md AUTH-FORM-11 · AUTH-LINK-02 | `lib/nativeAuth.ts` `isAppleLoginAvailable` |
| ANDN-WEB-03 | 기기 토큰을 받을 때 `platform: Capacitor.getPlatform()`("ios" · "android"). 서버는 문자열 그대로 저장(20자) — api.md API-NAT-01 | `lib/v2/nativeBridge.ts` `syncNativeSession` |
| ANDN-WEB-04 | 알림 권한 안내 경로: Android "휴대폰 설정 > 애플리케이션 > 팩인백 > 알림"(삼성 기준), 그 밖 "아이폰 설정 > 팩인백 > 알림". 설정 > 알림 · 가방 알림 시트 · 서버 푸시 안내 · 테스트 알림 | `lib/v2/platform.ts` `notificationSettingsPath` |

## 2. 앱을 만들 때 채울 것 (기획 AND-* → 여기로 옮겨 적는다)

- 프로젝트 · 아이콘 · 서명 · edge-to-edge · 키보드(AND-BASE-01~09): 앱 ID `com.appfle.packinbag`, Capacitor 7/8 업그레이드와 같이(iOS도 다음 스토어 버전)
- 로컬 알림(AND-NAT-10): 알림 권한(13+) · 정확한 알람(12+) · 재부팅 뒤 재예약
- App Links(AND-NAT-11): `app/.well-known/assetlinks.json`(앱 ID + 서명 SHA-256 — 업로드 키 · Play 앱 서명 키), 경로는 유니버설 링크와 같게(`/?invite=*` · `/v/*`)
- Google 로그인(AND-AUTH-01): Android OAuth 클라이언트(패키지 이름 + SHA-1 3개)

## 확인 필요

| # | 내용 | 코드 |
|---|---|---|
| 1 | 뒤로 가기: 닫기를 스택에 올리지 않는 화면이 있는지(Esc · swipeBack 둘 다 없는 SlideScreen, 여러 개 선택 모드, 이미지 확대 등) — 실기기에서 하나씩 | SHELL-BACK-04 |
| 2 | 사용자 노출 문구에 남은 iOS 표현: 가방 더보기 "PIN(또는 Face ID)"(생체 인증 D단계 때), FAQ(`lib/faqs.ts` iPhone 앱 · App Store), 개인정보 처리방침(AND-WEB-07), 공유 링크 브리지 "앱스토어"(AND-WEB-02) — 출시 전에 | `MoreSheet` · `lib/faqs.ts` · `app/privacy` · `components/AppBridge.tsx` |
| 3 | Android 브라우저(웹)에서 Apple 로그인 팝업이 되는지 — 지금도 웹이라 바꾸지 않음 | AUTH-SOCIAL |
| 4 | 삼성 외 기기의 알림 설정 메뉴 이름("애플리케이션" · "앱") | ANDN-WEB-04 |

## 테스트 후보 (단위)

| 대상 | ID |
|---|---|
| `closeTopLayer`: escape · 뒤로 전용 칸 섞임, `false`를 돌려주는 칸 건너뛰기, Esc는 뒤로 전용 칸 무시 — jsdom | SHELL-BACK-02 |

## 변경 기록

| 날짜 | 누가 | 무엇을 |
|---|---|---|
| 2026-10-22 | worker | 처음 작성(폰 없이 한 웹 분기 4개) |
