# 팩인백 인앱결제 · iOS 출시 가이드 (2026-10-09)

위에서부터 순서대로 하면 된다. 체크박스는 직접 표시.
코드 쪽(구매 흐름 · 서버 확인 · 웹훅 · 심사 대응)은 10/9에 끝났다(v1.0.29). 여기 남은 건 전부 대시보드 설정 · Xcode · 테스트 · 제출이다.

## 0. 구조 한눈에

```
[iPhone 앱(Capacitor, server.url = Vercel 사이트)]
   │ 구매 버튼 → RevenueCat SDK → Apple 결제
   │ 끝나면 /api/sync-purchase 호출
   ▼
[Vercel 서버] ── RevenueCat REST API로 "진짜 샀는지" 확인 → Firestore users/{uid}.premiumPurchase = true
   ▲
   └── RevenueCat 웹훅(/api/revenuecat-webhook): 구매 · 환불(CANCELLATION) · 이전(TRANSFER) 반영
```

- RevenueCat의 사용자 id(appUserID) = Firebase uid. 그래서 웹훅의 app_user_id가 곧 users 문서 id다
- 프리미엄 판정은 서버 기준(`isPremiumServer`, AI, storage.rules)이 `premiumPurchase.purchased`를 본다
- iOS 앱에서는 이용권 코드 입력이 보이지 않는다(심사 가이드라인 3.1.1). 웹 · 포터블은 코드 입력만
- 앱이 Vercel 사이트를 불러오므로 **환경변수는 Vercel 값이 기준**이다. 웹을 배포하면 앱도 바로 바뀐다(재심사 없음). 단, Info.plist · 플러그인 · 권한 같은 네이티브 부분은 새 빌드가 필요하다

---

## 1. App Store Connect — 결제 준비

https://appstoreconnect.apple.com

### 1-1. 계약 · 세금 · 은행 (가장 먼저)
- [ ] **비즈니스(Agreements, Tax, and Banking)** → **유료 앱(Paid Applications)** 계약이 **활성**
  - 은행 계좌, 세금 양식(한국은 W-8BEN 등)까지 완료돼야 활성이 된다
  - 이게 활성이 아니면 앱에서 상품이 **아예 안 불러와진다**(프리미엄 시트에 "다시 불러오기"만 뜸)

### 1-2. 인앱 구입 상품 만들기
앱 > **수익화 > 인앱 구입** > + 
- [ ] 유형: **비소모성(Non-Consumable)**
- [ ] 참조 이름: `Premium Lifetime`(내부용)
- [ ] 제품 ID: `com.appfle.packinbag.premium.lifetime` (한 번 정하면 못 바꾼다. 아래 RevenueCat과 똑같이)
- [ ] 가격: 정한 금액
- [ ] 현지화(한국어): 표시 이름 `팩인백 프리미엄`, 설명 `가방·팩 개수 제한 없이, 가족 10명과 함께` 같은 한 줄
- [ ] 심사 정보: 스크린샷(앱의 프리미엄 시트 화면 캡처) + 메모 `설정 > 프리미엄에서 구매·복원`
- [ ] 상태가 **"제출 준비 완료"**가 되면 OK. 첫 상품은 **앱 버전과 함께 제출**해야 한다(5단계)

### 1-3. RevenueCat용 인앱 구입 키
**사용자 및 액세스 > 통합(Integrations) > 인앱 구입(In-App Purchase)** > 키 생성
- [ ] `.p8` 파일 다운로드(**한 번만 받을 수 있다** - 안전한 곳에 보관)
- [ ] **Key ID**, **Issuer ID** 메모
- RevenueCat이 Apple에 구매를 확인할 때 쓴다(1-2단계 다음 RevenueCat 2-2에서 올림)

### 1-4. 샌드박스 테스터
**사용자 및 액세스 > Sandbox > 테스터** > +
- [ ] 실제로 안 쓰는 이메일로 하나 만든다(예: `appfle+sandbox1@gmail.com`). Apple ID로 쓰인 적 없는 주소여야 한다
- 아이폰: **설정 > App Store > 맨 아래 샌드박스 계정**에 이 계정으로 로그인(평소 Apple ID는 그대로)

---

## 2. RevenueCat 설정

https://app.revenuecat.com (예전에 가입했다면 그 계정으로 로그인. 기억 안 나면 Apple 개발자 계정 이메일로 "Forgot password")

### 2-1. 프로젝트
- [ ] 왼쪽 위 프로젝트 목록에 팩인백 프로젝트가 있는지 확인. 없으면 **+ Create new project** → 이름 `팩인백`
- 예전에 만들다 만 게 있으면 그대로 써도 된다. 아래 항목이 전부 맞는지만 확인

### 2-2. 앱(App Store) 연결
**Project settings > Apps** (또는 Apps & providers) > App Store
- [ ] Bundle ID: `com.appfle.packinbag`
- [ ] **In-App Purchase Key**: 1-3의 `.p8` 업로드 + Key ID + Issuer ID
- [ ] 저장 후 상태에 오류가 없는지

### 2-3. 상품 · 권한 · 오퍼링
- [ ] **Products** > + New: 식별자 `com.appfle.packinbag.premium.lifetime` (App Store Connect와 똑같이), 앱 = App Store 앱
- [ ] **Entitlements** > + New: 식별자 **`premium`** (코드 `lib/purchaseConfig.ts`와 반드시 같아야 한다. 다르면 사도 프리미엄이 안 됨) → 위 상품 Attach
- [ ] **Offerings** > + New: 식별자 `default` → **Make current**(현재 오퍼링) → Package 추가: 종류 **Lifetime**, 상품 = 위 상품
  - 앱은 "현재 오퍼링의 첫 번째 패키지"를 구매 버튼에 쓴다(`fetchPremiumOffering`)

### 2-4. API 키 2개
**Project settings > API keys**
- [ ] **Public app-specific key**(App Store, `appl_`로 시작) → `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`
- [ ] **Secret API keys > + New** → 이름 `packinbag-server`, **API 버전 V1** → `sk_...` → `REVENUECAT_SECRET_API_KEY`
  - V2를 고르면 서버 확인(`/api/sync-purchase`)이 401로 실패한다
  - 만든 직후 복사. 비밀값이라 `NEXT_PUBLIC_`을 절대 붙이지 않는다

### 2-5. 웹훅
**Integrations > Webhooks** > + Add
- [ ] URL: `https://packinbag.seeuson.com/api/revenuecat-webhook`
- [ ] Authorization header value: 터미널에서 `openssl rand -hex 24` 로 만든 값 → 이 값이 `REVENUECAT_WEBHOOK_AUTH_HEADER`
- [ ] 환경: Production과 Sandbox 둘 다 보내기(TestFlight · 심사관 구매는 샌드박스다)
- [ ] 저장 후 **Send test event** → RevenueCat 화면에 200 응답이 나오면 정상(401이면 Vercel 값과 다름)

### 2-6. 복원 동작
**Project settings > General > Restore behavior**(또는 Transfer behavior)
- [ ] **Transfer to new App User ID** — 다른 팩인백 계정에서 "복원하기"를 누르면 그 계정으로 옮겨진다(웹훅 TRANSFER로 이전 계정은 해제)

---

## 3. Vercel 환경변수 · 웹 배포

Vercel > 프로젝트 > Settings > Environment Variables (Production · Preview 둘 다)

| 이름 | 값 | 확인 |
|---|---|---|
| `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` | `appl_...` (2-4) | [ ] |
| `REVENUECAT_SECRET_API_KEY` | `sk_...` (2-4, V1) | [ ] |
| `REVENUECAT_WEBHOOK_AUTH_HEADER` | 2-5에서 만든 값 | [ ] |
| `MASTER_EMAILS` | 운영자 이메일(쉼표 구분) | [ ] |

- `.env.local`에도 같은 값(로컬에서 테스트할 때)
- `NEXT_PUBLIC_`이 붙은 값은 **빌드할 때 박힌다** → 바꾼 뒤 반드시 다시 배포
- `NEXT_PUBLIC_MASTER_EMAILS`는 마스터 두 계정 관리자 페이지가 열리는 것을 확인한 뒤 삭제

코드 배포:
```
rm -rf .next && npx tsc --noEmit && npx eslint components/v2 lib app/admin components/admin app/api && npm run build
npm version 1.0.29 --no-git-tag-version
git add -A && git commit -m "feat(iap): 구매·복원 서버 확인(sync-purchase), iOS 코드 입력 숨김(3.1.1), 안내 문구·FAQ 정리, Info.plist 카메라·암호화·arm64, 개인정보 매니페스트" && git push origin main
```
- [ ] Vercel 배포 완료 후 2-5 **Send test event**를 한 번 더 → 200

---

## 4. Xcode 빌드 (Mac)

```
git pull && npm install
npm i @capacitor/haptics
npx cap sync ios
npx cap open ios
```
- 햅틱 플러그인은 `lib/haptics.ts`가 이미 준비돼 있다. 네이티브 기능이 많을수록 가이드라인 4.2(웹사이트 감싼 앱) 거절 위험이 줄어든다

Xcode에서 왼쪽 App 프로젝트 > TARGETS **App**:
- [ ] **Signing & Capabilities**: Team 선택, Bundle Identifier `com.appfle.packinbag`
- [ ] **+ Capability → In-App Purchase** 추가 (Sign in with Apple은 이미 있음)
- [ ] **General > Identity**: Version = 스토어에 올라간 버전보다 높게(예: 1.1.0), Build = 이전 +1
- [ ] **General > Supported Destinations**: 아이패드 지원 여부 결정(지원하면 13″ 스크린샷 필수 - 이미 있음)
- [ ] 위쪽 기기 선택을 **Any iOS Device (arm64)**
- [ ] **Product > Archive** → Organizer > **Distribute App > App Store Connect > Upload**
- 10/9에 Info.plist에 넣은 것: 카메라·사진 사용 설명, 수출 규정 면제(업로드 때 암호화 질문 안 나옴), arm64, 기본 언어 ko

업로드 후 10~30분 뒤 App Store Connect > TestFlight에 빌드가 보인다.

---

## 5. TestFlight 결제 테스트 (제출 전 필수)

- [ ] TestFlight > 내부 테스트 그룹에 내 Apple ID 추가 → 아이폰 TestFlight 앱으로 설치
- [ ] 아이폰 샌드박스 계정 로그인(1-4)

| # | 해 볼 것 | 기대 결과 | 확인 |
|---|---|---|---|
| 1 | 무료 계정 > 설정 > 프리미엄 | 가격 버튼 + "이미 구매했다면 복원하기". **이용권 코드 입력은 없음** | [ ] |
| 2 | 구매 | 몇 초 안에 "프리미엄 이용 중", 잠겼던 가방·팩 풀림 | [ ] |
| 3 | 관리자 > 유저 조회 | `premiumPurchase.purchased: true` | [ ] |
| 4 | Vercel 로그 · RevenueCat Customers | 그 uid에 premium 활성, 웹훅 200 | [ ] |
| 5 | 앱 삭제 → 재설치 → 같은 계정 로그인 | 프리미엄 유지 | [ ] |
| 6 | 다른 팩인백 계정 로그인 → 복원하기 | 새 계정이 프리미엄, 이전 계정은 해제(TRANSFER) | [ ] |
| 7 | 구매 시트에서 취소 | 아무 안내 없이 그대로 | [ ] |
| 8 | 비행기 모드로 프리미엄 시트 | "구매 정보를 불러오지 못했어요" + 다시 불러오기 | [ ] |
| 9 | 게스트로 AI 버튼 | "로그인하면 쓸 수 있어요" | [ ] |
| 10 | 사진 첨부 > 사진 찍기 | 카메라 권한 창 → 정상(앱 종료 안 됨) | [ ] |

샌드박스 구매는 실제 결제가 안 된다. 같은 샌드박스 계정으로 다시 사려면 설정 > App Store > 샌드박스 계정 > 구매 기록 초기화.

---

## 6. 심사 제출

App Store Connect > 앱 > iOS 앱 > 새 버전(+)
- [ ] **스크린샷**: 아이폰 6.9″ 8장, 아이패드 13″ 8장(지원 시)
- [ ] **설명**: "최대 10명 실시간 공유" → **"무료 2명 · 프리미엄 10명"**(2곳). 프리미엄은 "한 번 결제(구독 아님)"로 표기
- [ ] **지원 URL · 개인정보 처리방침 URL**: 열리는지 확인
- [ ] **빌드**: 4단계에서 올린 빌드 선택
- [ ] **인앱 구입**: 버전 페이지의 "인앱 구입 및 구독" 영역에서 1-2 상품 **선택**(첫 상품은 반드시 같이 제출)
- [ ] **앱 개인정보(App Privacy)**: 이메일 · 사용자 ID · 사진 · 기타 사용자 콘텐츠 · **구매 기록** = 앱 기능, 사용자에게 연결됨, 추적 안 함
- [ ] **연령 등급** 설문
- [ ] **심사 정보 > 로그인 정보**: 이메일 인증까지 끝난 데모 계정(샘플 가방 있는 상태)
- [ ] **심사 메모**(예시):
  ```
  팩인백은 가족·친구와 함께 쓰는 짐 체크리스트입니다.
  프리미엄은 비소모성 인앱 구입(한 번 결제)이며, 설정 > 프리미엄에서 구매와 구매 복원을 할 수 있습니다.
  무료로는 가방 3개·팩 10개·공유 2명까지이고, 한도에 닿으면 프리미엄 안내가 나옵니다.
  계정 삭제: 설정 > 프로필 수정 하단 "회원 탈퇴".
  로그인: 이메일, Sign in with Apple, Google 지원. 게스트로도 시작할 수 있습니다.
  ```
- [ ] **심사에 제출**

자주 나오는 거절과 대응:
| 사유 | 대응 |
|---|---|
| 2.1 상품을 못 찾음 | 1-1 계약 활성 · 상품 "제출 준비 완료" · 버전에 상품 첨부 확인 |
| 3.1.1 외부 결제 · 코드 | iOS에서 코드 입력은 숨겨져 있다. 메타데이터에 코드 · 웹 결제 언급 금지 |
| 4.2 최소 기능(웹사이트 감싼 앱) | 인앱결제 · 네이티브 로그인 · 햅틱 · 화면 켜두기 같은 네이티브 기능을 메모에 적는다 |
| 5.1.1 계정 삭제 | 설정 > 프로필 수정 > 회원 탈퇴 위치를 메모에 |

---

## 7. 출시 후

- [ ] 승인 후 "출시" → 실제 결제 1건은 RevenueCat 대시보드 · 관리자 대시보드에서 확인
- [ ] 환불이 들어오면 웹훅 CANCELLATION → 자동으로 프리미엄 해제(잠금은 앱이 다음에 열릴 때 sync-lock-status)
- [ ] 문제가 생기면: Vercel 로그에서 `[팩인백] RevenueCat`, `구매 서버 확인`, `구매 기록 실패` 검색

## 참고 파일
- 클라이언트 결제: `lib/purchaseService.ts`, 화면 `components/v2/sheets/PremiumSheet.tsx`
- 서버: `app/api/sync-purchase`(구매 직후 확인), `app/api/revenuecat-webhook`(구매 · 환불 · 이전)
- Entitlement 이름: `lib/purchaseConfig.ts`(`premium`)
- iOS 설정: `ios/App/App/Info.plist`, `PrivacyInfo.xcprivacy`, `App.entitlements`, `capacitor.config.ts`
