# 팩인백 Android 앱 기획 — 2026-10-21 작성(worker, 코드 분석)

> **상태(10/21)**: 기획만. 코드 · `android/` 폴더 없음. 로드맵상 결제 도입 다음(프로젝트 메모리 "로드맵"). 시작 전에 아래 9절 "정할 것"을 사용자에게 먼저 묻는다

함께 볼 문서: `docs/spec/native-ios.md`(지금 iOS 네이티브 동작 · ID), `docs/packinbag_ios_native_plan.md`(iOS를 만들 때의 기획 · 진행 기록), `docs/packinbag_iap_release_guide.md`(결제 B단계 — Capacitor 8 업그레이드가 겹침), `docs/spec/api.md` API-NAT(네이티브 서버 라우트)

---

## 0. 한 줄 요약

앱 화면은 `capacitor.config.ts` `server.url = https://packinbag.seeuson.com`(웹을 불러옴)이라 **Android 앱에도 웹 기능은 거의 그대로 뜬다.** 새로 만들 것은 ① Android 플랫폼 준비 ② iOS에서 Swift로만 만든 네이티브 기능(푸시 · 위젯 · 생체 인증 · 링크)의 Android판 ③ 웹 코드의 iOS 전용 문구 · 링크 ④ Play 스토어 출시.

웹 쪽 네이티브 호출은 이미 "플러그인이 있을 때만"(`isNativeBridgeAvailable` · `isServerPushAvailable` · `isLocalNotificationsAvailable`, NAT-AVAIL-01)이라, Android판 플러그인이 없어도 앱이 죽지 않고 그 기능만 안 보인다. → **단계별로 나눠 출시할 수 있다.**

---

## 1. 기반 (먼저 해야 Android 빌드가 됨)

| ID | 영역 | 지금 | 할 일 |
|---|---|---|---|
| AND-BASE-01 | Android 프로젝트 | `android/` 없음, `@capacitor/android` 미설치 | `npm install @capacitor/android`(사용자 확인 후) → `npx cap add android`. 앱 ID `com.appfle.packinbag`(iOS와 같게), 이름 "팩인백". package.json 스크립트에 `cap:sync:android` · `cap:open:android` 추가 |
| AND-BASE-02 | Capacitor 버전 | 6(`@capacitor/core ^6`) | Play는 새 앱 · 업데이트에 최신 target API를 요구 → Capacitor 6(targetSdk 34)으로는 못 냄. **7 또는 8로 올린다.** 결제 B단계도 Capacitor 8 + purchases-capacitor 13.x가 전제라 **같이 올리는 게 좋다.** iOS 빌드 · 플러그인(social-login · push · local-notifications 등) 메이저 버전도 함께 올리고 iOS 회귀 확인 필요. 정확한 요구 API는 시작할 때 Play 정책에서 확인 |
| AND-BASE-03 | `includePlugins` | iOS 기준 목록 | Android도 이 목록을 따른다(`npx cap sync android`). Android 전용 플러그인을 넣으면 여기에도 |
| AND-BASE-04 | 아이콘 · 시작 화면 | iOS만(`cap:assets --ios`) | `npx capacitor-assets generate --android`(적응형 아이콘: 딥그린 #2E5E4E 바탕 + 백팩 로고, 어깨끈 2개 백팩 모양 유지). 시작 화면 0.8초 흰 바탕(NAT-ETC-03과 같게) |
| AND-BASE-05 | 서명 | 없음 | 업로드 키(keystore)를 만들어 `_secrets/`에 보관(목록은 `_secrets/README.md`), Play 앱 서명 사용. keystore 비밀번호는 비밀번호 관리자에 |
| AND-BASE-06 | 하드웨어 뒤로 가기 | `backButton` 처리 코드 없음(10/21 grep) | `App.addListener('backButton')` 한 곳에서: 열린 시트 닫기 → 화면 뒤로(`useSwipeBack`과 같은 흐름) → 첫 화면이면 앱 종료(또는 "한 번 더 누르면 종료"). **안 하면 뒤로 가기에 앱이 바로 꺼진다** |
| AND-BASE-07 | 안전 영역 · edge-to-edge | iOS `env(safe-area-inset-*)` 기준 | Android 15(target 35+)는 edge-to-edge 강제 → 상태바 · 내비게이션 바 밑으로 화면이 들어간다. WebView에서 `env(safe-area-inset)`이 0으로 오는 경우가 있어 플러그인(또는 StatusBar overlay 설정)으로 값을 CSS 변수에 넣는다. `--pib-dock` · `ScreenBody` 계산이 맞는지 확인. 숫자로 박지 않는다 |
| AND-BASE-08 | 키보드 | iOS 기준 | 키보드가 입력창을 가리지 않는지(`adjustResize`), 메모 편집기(TipTap) · 시트 입력창 |
| AND-BASE-09 | 외부 링크 · 다운로드 | `lib/openExternalLink.ts`는 `window.open`, `lib/downloadFile.ts`는 iOS 공유 시트 분기 | Android WebView에서 `window.open` · `<a download>` · Web Share 동작 확인. 안 되면 `@capacitor/browser` · Filesystem + Share |

---

## 2. 네이티브 기능 (iOS Swift → Android Kotlin)

iOS는 `ios/App/App/AppDelegate.swift`의 `PackInBagNativePlugin`("PackInBagNative") + `ios/App/Shared/` + 위젯 확장. Android는 **같은 이름 · 같은 메서드 · 같은 반환 모양**의 Kotlin 플러그인을 만들어 웹 코드(`lib/v2/nativeBridge.ts` · `biometric.ts`)를 그대로 쓴다.

| ID | 영역 | iOS(지금) | Android에서 할 일 | 크기 |
|---|---|---|---|---|
| AND-NAT-01 | 기기 연결(`getSession` · `setSession` · `clearSession`) | App Group에 uid · 기기 토큰 · apiBase(NAT-SESSION) | SharedPreferences(EncryptedSharedPreferences 권장)에 저장. `clearSession`은 서버 토큰 삭제 + 위젯 · 꾸미기 지움 | 중 |
| AND-NAT-02 | 가방 요약(`saveSummary`) | App Group JSON, 위젯 다시 그림(NAT-SUM) | 저장 + 위젯 갱신 브로드캐스트. **요약 모양은 `lib/nativeSummary.ts` ↔ `PIBShared.swift` ↔ `functions/src/live.ts`와 같아야 한다 → Android Kotlin 모델이 네 번째로 추가됨** | 중 |
| AND-NAT-03 | 서버 푸시 | Swift `PIBPush`가 APNs 토큰 등록 → `POST /api/native/push-token`(NAT-PUSH-01) | FCM 토큰 등록 → 같은 API에 `fcm` 종류로. 알림 채널(활동 · 담당 · 멤버 · 테스트) 만들기, Android 13+ 알림 권한(NAT-PUSH-09 흐름 그대로). 알림 누르면 `data.bagId`(NAT-LINK-01) | 큼(서버 3절과 같이) |
| AND-NAT-04 | 조용한 푸시 → 위젯 갱신 | background 푸시 → 서버 요약(NAT-PUSH-06) | FCM data 메시지 → WorkManager로 `GET /api/native/summary` → 위젯 갱신 | 중 |
| AND-NAT-05 | 홈 화면 위젯 | 팩 위젯(작게 · 중간 · 크게, 열 수) · 북마크 위젯 · 잠금화면 위젯(NAT-WID · NAT-BMK) | Jetpack Glance(또는 AppWidget)로 새로 작성: 팩 고르기(위젯 설정 Activity — iOS "길게 눌러 편집" 대신), 아이템 체크(`POST /api/native/toggle-item`, 못 보낸 체크 쌓아 두기), 새로고침 줄 · ↻, 1시간 안전망 · 자정 D-Day, 누르면 `packinbag://bag/{id}`. 글꼴은 TTF/OTF 따로(NAT-WID-11). 잠금화면 위젯은 Android에 없음 | 큼 |
| AND-NAT-06 | 위젯 꾸미기(`saveWidgetStyles`) | `pib.widgetStyles` + 사진 내려받기(NAT-BMK-07 · 08) | 북마크 위젯을 만들 때 같이. `"__probe__"`를 받는 메서드가 있어야 설정 줄이 보인다 | 중 |
| AND-NAT-07 | 잠금화면 실시간 현황(`startLiveActivity` 등) | ActivityKit(NAT-LIVE) | **Android에 같은 기능 없음.** 대안: 진행 중 알림(ongoing notification, 진행 막대 + "체크" 액션 몇 개) 또는 이번엔 뺌 → 9절에서 결정. 빼면 메서드를 안 만들어 시트 줄이 숨겨지게 | 결정 필요 |
| AND-NAT-08 | 생체 인증(`biometricInfo` · `authenticateBiometric`) | Face ID · Touch ID(NAT-ETC-01) | AndroidX BiometricPrompt. 반환 `{available, kind}`의 kind에 "fingerprint" · "face" 등 — 웹 문구("Face ID")가 kind를 보는지 확인 | 작음 |
| AND-NAT-09 | 색 고르기(`pickColor`) | iOS 기본 색 창 | 없으면 웹이 대체 문구를 보임(NAT-LIVE-06). 실시간 현황 대체를 안 하면 불필요 | 작음 |
| AND-NAT-10 | 로컬 알림(D-Day · 반복) | `@capacitor/local-notifications`, 60개(iOS 64 한도, NAT-NOTI) | 같은 플러그인이 Android도 됨. 정확한 시각 알람 권한(`SCHEDULE_EXACT_ALARM`, Android 12+) · 알림 권한(13+) · 재부팅 뒤 재예약 확인. 60개 제한은 그대로 둬도 됨 | 작음 |
| AND-NAT-11 | 링크로 앱 열기 | 유니버설 링크(`app/.well-known/apple-app-site-association`, `/?invite=*` · `/v/*`) + `packinbag://`(NAT-LINK) | App Links: `app/.well-known/assetlinks.json` 라우트(앱 ID + 서명 SHA-256) + AndroidManifest intent-filter(`autoVerify`, 같은 경로만, 짧은 URL 제외) + `packinbag://` 스킴. 받는 웹 코드(`onBagNotificationTap`)는 그대로 | 작음 |
| AND-NAT-12 | 단축어 · Siri · Spotlight | App Intents(NAT-SC) | Android 대응(App Shortcuts · App Actions)은 약함. **후순위 제안**: 할 거면 런처 길게 누르기 "빠른팩에 입력"(동적 바로가기) 정도 | 선택 |
| AND-NAT-13 | 햅틱 · 상태바 · 시작 화면 | 플러그인 | 같은 플러그인이 동작. 확인만 | 작음 |

---

## 3. 서버 (Cloud Functions · API)

| ID | 지금 | 할 일 |
|---|---|---|
| AND-SRV-01 | `functions/src/apns.ts`로만 발송, 비밀 `APNS_KEY_P8` | FCM 발송 추가(Admin SDK `messaging().sendEach`, 별도 키 필요 없음 — 기본 서비스 계정). `sendToDevices`가 기기마다 `apns` / `fcm`을 보고 나눠 보냄. 죽은 토큰(`registration-token-not-registered`)은 `fcm` 지움(NAT-PUSH-01과 같게) |
| AND-SRV-02 | `deviceTokens/{hash}.apns`만 | `fcm: { token, alerts, updatedAt }` 필드 추가. `lib/nativeDeviceServer.ts`(`setPushToken` 등) · `app/api/native/push-token`에 종류 받기. 중복 토큰 정리도 `fcm.token` 기준으로 |
| AND-SRV-03 | `syncNativeSession`이 `platform: "ios"` 고정(`lib/v2/nativeBridge.ts:83`) | `Capacitor.getPlatform()`을 넘긴다. 기기 토큰 하루 800회 제한(API-NAT-01)은 그대로 |
| AND-SRV-04 | 조용한 푸시 · 활동 묶음(Cloud Tasks) | 흐름은 그대로, 받는 기기만 FCM도. **비용: 읽기 · 쓰기 늘지 않게** 지금 조회를 재사용 |
| AND-SRV-05 | 실시간 현황 `apnsLive` · `liveOn` | 실시간 현황 대체를 하면 FCM data로 진행 알림 갱신(`fcmLive`). 안 하면 손대지 않음 |
| AND-SRV-06 | Firebase 프로젝트 | Firebase 콘솔에 Android 앱 추가 → `google-services.json`(android/app, **gitignore 여부 결정** — iOS `GoogleService-Info.plist` 처리와 같게), SHA-1 · SHA-256 지문 등록(구글 로그인 · App Links) |

---

## 4. 웹 코드 (iOS 전용 문구 · 링크)

| ID | 위치 | 할 일 |
|---|---|---|
| AND-WEB-01 | `lib/v2/appBridge.ts` `APP_STORE_URL` · `components/v2/settings/InfoScreens.tsx` · `app/about/page.tsx` | Play 스토어 링크 추가, 기기에 맞는 링크(또는 둘 다) |
| AND-WEB-02 | `lib/v2/appBridge.ts` NAT-BRIDGE-03 | 지금은 Android 앱 안 브라우저(카톡 등)를 기본 브라우저로 보냄 → 앱이 있으면 App Links로 앱이 열리게, 없으면 Play 스토어 |
| AND-WEB-03 | `lib/appUpdate.ts` · `app/api/build-info` | 지금은 App Store 버전만 비교(Apple 조회 API). Android는 Play 버전을 못 받으면 웹만 비교(또는 서버에 Android 최신 버전 상수) |
| AND-WEB-04 | 안내 문구 전체 | "아이폰 설정 > 팩인백 > 알림" 같은 문구를 플랫폼별로(grep: `아이폰` · `iOS` · `Face ID`). `lib/faqs.ts` · 사용설명서 · 마케팅 자료 |
| AND-WEB-05 | 설정 화면 · 시트의 iOS 전용 줄 | 위젯 꾸미기 · 잠금화면에 띄우기 등은 플러그인 메서드 유무로 숨겨지는지 확인(probe) |
| AND-WEB-06 | `lib/installPromptUtils.ts` | iOS 홈 화면 추가 안내 — Android 앱이 생기면 Android 브라우저에서 앱 설치 안내로 |
| AND-WEB-07 | `app/privacy/page.tsx` | Android(FCM · Play) 내용 추가, Play 데이터 보안 양식과 맞추기 |

---

## 5. 로그인

| ID | 내용 |
|---|---|
| AND-AUTH-01 | `lib/nativeAuth.ts`(`@capgo/capacitor-social-login`)는 Android 지원. Google: Google Cloud 콘솔에 **Android OAuth 클라이언트**(패키지 이름 + SHA-1, 디버그 · 업로드 · Play 앱 서명 키 3개) 등록, `webClientId`는 지금 값 재사용 |
| AND-AUTH-02 | Apple 로그인: Android에는 네이티브가 없어 웹 방식(Service ID `com.appfle.packinbag.signin` + 리디렉션 URL). Apple Developer에서 Service ID 리턴 URL 설정 · 실제 동작 테스트 필요. 어려우면 Android에서는 Apple 버튼을 숨김(Play는 Apple 로그인을 요구하지 않음) |
| AND-AUTH-03 | 이메일 로그인 · 인증 메일(Resend)은 그대로 |

## 6. 결제 (결제 도입 때)

- RevenueCat 웹훅 · `app/api/sync-purchase`는 이미 `PLAY_STORE` → `platform: "android"`로 나눔. Play 콘솔에 같은 상품(영구구매 ₩3,900) + RevenueCat에 Play 앱 연결(서비스 계정 키)
- 이용권 판정은 그대로 `lib/unlockCodeCheck.ts` 하나
- Play 유료 판매도 판매자(결제 프로필)가 필요 → 사업자 문제와 같이 확인(지금은 FREE_LAUNCH라 급하지 않음)

## 7. 출시 (Play 콘솔)

1. https://play.google.com/console 개발자 계정 만들기(개인, 등록비 25달러, 신원 확인). 개발자 이메일 appfle.io
2. 앱 만들기: 앱 이름 "팩인백", 기본 언어 한국어, 무료 앱
3. 앱 콘텐츠: 개인정보처리방침 URL(packinbag.seeuson.com), 데이터 보안 양식, 광고 없음, 대상 연령, 계정 삭제 방법(앱 안 탈퇴 + 웹 URL)
4. **비공개 테스트**: 개인 계정은 프로덕션 전에 **테스터 12명 이상이 14일 이상** 참여해야 한다(Play 정책, 시작 때 다시 확인). 가족 · 지인 Google 계정 목록 준비
5. 프로덕션 출시 신청 → 심사
- 버전 번호: 지침 5절(앞 두 자리 = 스토어 앱 버전). Android 첫 버전을 iOS와 같은 번호로 맞출지 9절에서 결정. `versionCode`는 빌드마다 +1
- 이 Mac은 구형이라 Android 에뮬레이터도 과열 위험 → **실기기**(USB 디버깅) · Chrome `chrome://inspect`로 WebView 디버깅

---

## 8. 추천 순서

| 단계 | 내용 | 결과 |
|---|---|---|
| A | AND-BASE 전부 + AND-AUTH + AND-NAT-10(로컬 알림) · 11(링크) · 13 + AND-WEB-01~04 | **웹 기능을 다 쓰는 Android 앱**. 여기서 비공개 테스트 시작 가능(14일을 일찍 시작) |
| B | AND-SRV-01~04 + AND-NAT-01 · 03 · 04 | 공유 가방 서버 푸시 |
| C | AND-NAT-02 · 05 · 06 | 홈 화면 위젯 · 북마크 위젯 |
| D | AND-NAT-08(생체 인증) · 07(실시간 현황 대체) · 12(바로가기) | 나머지 |

- Capacitor 업그레이드(AND-BASE-02)는 iOS에도 영향 → iOS 새 빌드(스토어 버전 +1)와 같이 계획
- 각 단계 코드를 고치면 지침 4절대로 docs 갱신(spec은 `docs/spec/native-android.md`를 새로 만들지, `native-ios.md`를 `native.md`로 합칠지 9절)

## 9. 정할 것 (사용자에게 묻기)

1. 1차 출시 범위: A만 / A+B / C(위젯)까지
2. 잠금화면 실시간 현황 대체: 진행 중 알림으로 만들기 / 이번엔 빼기
3. Capacitor 업그레이드를 결제 도입(B단계)과 같이 할지, Android 먼저 할지
4. Apple 로그인을 Android에서도 둘지(웹 방식) / 숨길지
5. Android 버전 번호를 iOS와 같은 앞 두 자리로 맞출지
6. 기능명세서: `native-android.md` 새로 / `native-ios.md`를 공용으로
7. 로드맵 순서: 지금은 결제 도입 → Android. 결제가 계속 보류면 Android 먼저 할지

## 10. 확인 필요 (코드 · 정책)

- Play 최신 target API 요구 수준과 Capacitor 7 · 8이 맞추는 API(시작 때)
- `@capgo/capacitor-social-login` · `@capacitor/push-notifications` 새 메이저 버전의 Android 설정법(버전 올린 뒤)
- Android WebView에서 `window.open` · 파일 다운로드 · Web Share · Wake Lock(화면 켜두기, bag.md) 동작
- `google-services.json`을 커밋할지(iOS plist 처리 방식 확인)
- 오프라인 · 폐쇄망: iOS와 같이 server.url이라 첫 실행은 인터넷 필요(알려진 한계와 같음)

---

## 변경 기록

| 날짜 | 누가 | 무엇을 |
|---|---|---|
| 2026-10-21 | worker | 처음 작성(코드 분석: capacitor.config · AppDelegate 플러그인 메서드 · nativeBridge · functions apns · appBridge · nativeAuth) |
