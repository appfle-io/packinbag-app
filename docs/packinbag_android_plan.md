# 팩인백 Android 앱 기획 — 2026-10-21 작성(worker, 코드 분석)

> **상태(10/22)**: `android/` 폴더 없음. **폰 없이 할 수 있는 웹 코드 4개는 끝**(AND-BASE-06 · AND-SRV-03 · Apple 숨김 · AND-WEB-04 일부, 명세 `docs/spec/native-android.md`). 다음은 iOS 1.8 심사 뒤 Capacitor 업그레이드 + `cap add android`. 9절 "정할 것"은 **10/22 사용자 답으로 확정** — 1차는 A단계만, 결제가 보류면 Android 먼저

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
| AND-BASE-06 | 하드웨어 뒤로 가기 | ✅ 10/22 웹 코드 끝(shell.md SHELL-BACK). 실기기 확인만 남음 | `App.addListener('backButton')` 한 곳에서: 열린 시트 닫기 → 화면 뒤로(`useSwipeBack`과 같은 흐름) → 첫 화면이면 앱 종료(또는 "한 번 더 누르면 종료"). **안 하면 뒤로 가기에 앱이 바로 꺼진다** |
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
| AND-SRV-03 | ✅ 10/22 `Capacitor.getPlatform()`으로 바꿈 | `Capacitor.getPlatform()`을 넘긴다. 기기 토큰 하루 800회 제한(API-NAT-01)은 그대로 |
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
| AND-WEB-04 | 안내 문구 전체(10/22 알림 설정 경로는 끝 — `notificationSettingsPath`, 남은 것은 native-android.md 확인 필요 2) | "아이폰 설정 > 팩인백 > 알림" 같은 문구를 플랫폼별로(grep: `아이폰` · `iOS` · `Face ID`). `lib/faqs.ts` · 사용설명서 · 마케팅 자료 |
| AND-WEB-05 | 설정 화면 · 시트의 iOS 전용 줄 | 위젯 꾸미기 · 잠금화면에 띄우기 등은 플러그인 메서드 유무로 숨겨지는지 확인(probe) |
| AND-WEB-06 | `lib/installPromptUtils.ts` | iOS 홈 화면 추가 안내 — Android 앱이 생기면 Android 브라우저에서 앱 설치 안내로 |
| AND-WEB-07 | `app/privacy/page.tsx` | Android(FCM · Play) 내용 추가, Play 데이터 보안 양식과 맞추기 |

---

## 5. 로그인

| ID | 내용 |
|---|---|
| AND-AUTH-01 | `lib/nativeAuth.ts`(`@capgo/capacitor-social-login`)는 Android 지원. Google: Google Cloud 콘솔에 **Android OAuth 클라이언트**(패키지 이름 + SHA-1, 디버그 · 업로드 · Play 앱 서명 키 3개) 등록, `webClientId`는 지금 값 재사용 |
| AND-AUTH-02 | ✅ 10/22 **숨김으로 결정 · 웹 코드 끝**(`isAppleLoginAvailable`). 아래는 예전 검토: Apple 로그인: Android에는 네이티브가 없어 웹 방식(Service ID `com.appfle.packinbag.signin` + 리디렉션 URL). Apple Developer에서 Service ID 리턴 URL 설정 · 실제 동작 테스트 필요. 어려우면 Android에서는 Apple 버튼을 숨김(Play는 Apple 로그인을 요구하지 않음) |
| AND-AUTH-03 | 이메일 로그인 · 인증 메일(Resend)은 그대로 |

## 6. 결제 (결제 도입 때)

- RevenueCat 웹훅 · `app/api/sync-purchase`는 이미 `PLAY_STORE` → `platform: "android"`로 나눔. Play 콘솔에 같은 상품(영구구매 ₩3,900) + RevenueCat에 Play 앱 연결(서비스 계정 키)
- 이용권 판정은 그대로 `lib/unlockCodeCheck.ts` 하나
- Play 유료 판매도 판매자(결제 프로필)가 필요 → 사업자 문제와 같이 확인(지금은 FREE_LAUNCH라 급하지 않음)

## 7. 출시 (Play 콘솔) — 10/22 Google 도움말로 다시 확인

### 7-1. 개발자 계정 만들기(사용자, 지금 해도 됨 — 신원 확인에 며칠 걸림)
1. https://play.google.com/console/signup 에 **appfle.io Google 계정**으로 로그인(이 계정이 소유자. 나중에 기기 인증도 같은 계정으로)
2. 계정 유형 **개인**(조직은 D-U-N-S 번호 · 사업자 필요 → 지금은 불가). 만 18세 이상
3. 개발자 이름(스토어에 공개되는 이름, 예: appfle) · 연락처 이메일 · 전화번호 · 주소 입력, 개발자 배포 계약 동의
4. 등록비 **25달러 1회**(해외 결제되는 신용 · 체크카드. 선불카드 불가)
5. **신원 확인**: 정부 발급 신분증(주민등록증 · 운전면허증 · 여권) 사진. 결제 프로필 이름 · 주소와 같아야 함. 틀리면 등록비 환불 안 됨
6. **Android 기기 인증**(2024년 이후 새 개인 계정): Android 10 이상 실제 폰(루팅 X)에 **Play Console 앱** 설치 → 소유자 계정으로 로그인 → '인증'(약 1분). Play Console 웹 홈의 'Android 휴대기기에 액세스할 수 있는지 확인' 작업 QR로 시작. 도움말상 기기 번호가 가입 번호와 같을 필요 없고, 기기를 보관할 필요도 없음 → **폰이 없으면 가족 · 지인 Android 폰을 잠깐 빌려서**(끝나면 그 폰에서 로그아웃). 이게 안 되면 앱 게시가 막힘
- 참고: 2026-09-30부터 Android 개발자 인증(사이드로딩 앱 포함)이 단계적으로 시작 — Play Console 계정은 위 신원 확인으로 대부분 충족

### 7-2. 앱 만들기 · 앱 설정(Play Console 대시보드 '앱 설정' 작업)
- **답변 초안: `docs/packinbag_play_store_listing.md`**(등록정보 · 앱 액세스 · 콘텐츠 등급 · 데이터 보안, 10/22)
1. 모든 앱 > 앱 만들기: 이름 "팩인백", 기본 언어 한국어, 앱, 무료
2. 앱 콘텐츠: 개인정보처리방침 URL(packinbag.seeuson.com/privacy, AND-WEB-07 먼저), **앱 액세스**(로그인 필요 → 심사용 테스트 계정 안내), 광고 없음, 콘텐츠 등급 설문, 타겟층(만 18세 이상 또는 13세 이상), 데이터 보안 양식, 계정 삭제 방법(앱 안 탈퇴 + 웹 URL)
3. 스토어 등록정보: 앱 아이콘 512×512, 그래픽 이미지 1024×500, 휴대전화 스크린샷 2장 이상, 간단한 설명 80자 · 자세한 설명

### 7-3. 비공개 테스트(12명 · 14일, 2023-11-13 이후 개인 계정 필수)
1. 테스트 및 출시 > 테스트 > **비공개 테스트**(내부 테스트는 집계 안 됨) > 트랙 > 테스터 탭: **이메일 목록** 만들기(테스터들이 Play 스토어에 쓰는 Gmail) + 의견 받을 이메일(appfle.io@gmail.com)
2. 버전 만들기: AAB 업로드(Play 앱 서명), 출시 노트 → 검토 및 출시(첫 검토는 몇 시간~며칠)
3. 승인되면 테스터 탭의 **"웹에서 참여" 링크**를 카톡으로 보냄 → 테스터는 Android 폰에서 링크 열기 → **테스터 되기** → Play 스토어에서 설치
4. 조건: 신청 시점에 **12명 이상이 14일 연속 참여 중**. 중간에 탈퇴한 사람은 빠지고, 다시 들어오면 14일을 새로 채움 → **15~20명** 모으기. 초대만 받고 참여 안 한 사람은 안 셈
5. 테스트 중에도 새 버전을 올려도 됨(14일은 참여 기준이라 이어짐) → **A단계 첫 빌드가 나오자마자 시작**
6. 14일 뒤 대시보드 **프로덕션 신청**: ① 비공개 테스트(모집 난이도, 테스터가 기능을 다 써 봤는지, 받은 의견 요약 · 받은 방법) ② 앱 정보(타겟층, 가치, 첫해 예상 설치 수) ③ 준비 상태(테스트로 바꾼 것, 준비됐다고 본 근거). 섹션마다 '다음' · '적용'을 눌러야 저장. 검토 보통 7일 이내 → 승인되면 프로덕션 출시
- 테스터는 **Android 폰 + Google 계정**이 있어야 함(아이폰 사용자는 안 셈). 실제로 앱을 쓰고 의견을 남기게(신청서에 그 내용을 씀). 유료 테스터 대행은 쓰지 않음(신청서 답이 빈약해지고 정책 위험)
- 테스터 데이터도 운영 Firebase에 들어감(가입 · 가방). 14일 동안 의견 모으기: 카톡방 하나 + 앱 설정 > 의견 보내기

- 버전 번호: 지침 5절(앞 두 자리 = 스토어 앱 버전). Android 첫 버전을 iOS와 같은 번호로 맞출지 9절에서 결정. `versionCode`는 빌드마다 +1
- 이 Mac은 구형이라 Android 에뮬레이터도 과열 위험 → **실기기**(USB 디버깅) · Chrome `chrome://inspect`로 WebView 디버깅
- 개발 환경 용량(10/22 확인, M1 · RAM 8GB · 남은 공간 66GB): Android Studio ≈ 3GB + SDK(platform · build-tools · platform-tools) ≈ 1GB + `~/.gradle` 캐시 2~5GB + `android/` 빌드 산출물 ≈ 1GB → **약 8~12GB**. Studio 없이 JDK 21 + cmdline-tools로만 하면 약 4~6GB. 에뮬레이터(시스템 이미지 + AVD 5~10GB, RAM 2GB+)는 쓰지 않는다

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

## 9. 정할 것 — 10/22 확정(사용자 답)

| # | 질문 | 답 |
|---|---|---|
| 1 | 1차 출시 범위 | **A만**(웹 기능 전부 + 뒤로 가기 · 로그인 · 로컬 알림 · App Links). B(FCM) · C(위젯)는 다음 |
| 2 | 잠금화면 실시간 현황 대체 | **이번엔 빼기**. AND-NAT-07 메서드를 만들지 않아 메뉴가 숨겨지게, AND-SRV-05 손대지 않음 |
| 3 | Capacitor 업그레이드 시점 | **Android 시작 때**(결제 기다리지 않음). iOS도 다음 스토어 버전으로 같이 회귀 확인 · 제출 |
| 4 | Android에서 Apple 로그인 | **숨김**(Google · 이메일만). AND-AUTH-02 하지 않음 |
| 5 | 버전 번호 | **iOS와 같은 앞 두 자리**(지침 5절 그대로). versionCode는 빌드마다 +1 |
| 6 | 기능명세서 | **`docs/spec/native-android.md` 새로**. iOS와 같은 기능은 `native-ios.md` ID를 가리킴 |
| 7 | 로드맵 순서 | **결제가 보류인 동안 Android 먼저** |

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
| 2026-10-22 | worker | 7절에 개발 환경 용량, 9절 정할 것 확정(사용자 답), 폰 없이 한 웹 코드 4개 표시, 7절 Play 계정 · 비공개 테스트 단계별(Google 도움말 확인) |
| 2026-10-21 | worker | 처음 작성(코드 분석: capacitor.config · AppDelegate 플러그인 메서드 · nativeBridge · functions apns · appBridge · nativeAuth) |
