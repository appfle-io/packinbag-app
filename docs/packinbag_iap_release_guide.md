# 팩인백 출시 진행판 (2026-10-09 개정)

> **결정(10/9)**: 직장인이라 사업자등록을 낼 수 없어 **결제 없이 무료 앱으로 먼저 출시**한다.
> 한국 거주 개인이 App Store에서 돈을 받으려면(앱 가격·인앱결제 모두) 유료 앱 계약 + 대한민국 세금 양식(사업자등록번호 또는 고유번호)이 필요하다.
> **스위치 하나로 전원 무료**: `lib/freeLaunch.ts` `FREE_LAUNCH = true` + `storage.rules` `freeLaunch()` true. 결제 코드는 지우지 않고 그대로 둔다.
>
> ✅ 끝 / 🔄 진행 중 / ⬜ 아직 / ⏸ 보류

## 지금 전원 무료로 열린 것 (FREE_LAUNCH = true)
| 항목 | 출시 기간 | 결제 붙인 뒤(무료 회원) |
|---|---|---|
| 내가 만든 가방 · 참여 가방 | 무제한 | 각 3개 |
| 가방 공유 인원 | 10명 | 2명 |
| 팩 보관함 | 무제한 | 10개 |
| 가방 사진 | 5장 | 1장 |
| 메모 PDF · 파일 첨부 | 가능 | 불가 |
| 커스텀 URL | 가능 | 불가 |
| AI | **하루 3회**(AI로 정리하기 · AI 클립보드 포함) | 하루 3회(정리·클립보드는 프리미엄 전용) |

- 서버: `lib/premiumServer.ts` isPremiumServer → 항상 true (가방·팩·참여·인원·커스텀 URL·잠금 해제)
- 화면: `lib/premiumLimits.ts` isPremiumUser → 항상 true
- 규칙: `storage.rules` freeLaunch() → 사진·PDF 첨부
- AI: `organize-bag` · `clipboard-organize`의 프리미엄 전용 막기만 풀림. 하루 3회는 그대로(`lib/aiQuotaServer.ts`)
- 설정: "모든 기능 무료 · 출시 기념" / FAQ: `lib/faqs.ts`가 결제 관련 답을 바꿔 보여주고 구매 복원 항목은 숨김

---

# A. 무료 출시 (지금)

| 단계 | 내용 | 상태 |
|---|---|---|
| A-1 | 코드 배포(v1.0.29) + storage 규칙 배포 | ⬜ |
| A-2 | Xcode 빌드 · 업로드 | ⬜ |
| A-3 | TestFlight 확인 | ⬜ |
| A-4 | 심사 제출 | ⬜ |

## A-1. 코드 · 규칙 배포
```
cd ~/Desktop/packinbag
rm -rf .next && npx tsc --noEmit && npx eslint components/v2 lib app/admin components/admin app/api && npm run build
npx firebase-tools deploy --only storage
npm version 1.0.29 --no-git-tag-version
git add -A && git commit -m "feat: 출시 기념 전원 무료(FREE_LAUNCH), 인앱결제 준비 코드(sync-purchase·iOS 코드 숨김), 안내 문구·FAQ, Info.plist" && git push origin main
```
- 규칙(storage)은 앱보다 먼저 배포해도 된다
- 확인(웹): 무료 계정으로 가방 4개째 만들기 됨 / 메모에 PDF 첨부 됨 / 커스텀 URL 만들기 됨 / 설정에 "모든 기능 무료 · 출시 기념"
- 포터블도 바뀌었으면: `git tag v1.0.29-offline-portable && git push origin v1.0.29-offline-portable`

## A-2. Xcode (Mac)
```
cd ~/Desktop/packinbag
git pull && npm install
npm i @capacitor/haptics
npx cap sync ios
npx cap open ios
```
- 왼쪽 파란 **App** → **TARGETS > App**
- **Signing & Capabilities**: Automatically manage signing / Team / Bundle `com.appfle.packinbag`. 이번엔 In-App Purchase Capability 필요 없음(넣어도 무방)
- **General**: Version = 스토어 버전보다 높게(예 1.1.0) / Build +1 / Supported Destinations(iPad 여부)
- 맨 위 실행 대상 **Any iOS Device (arm64)** → **Product > Archive** → Organizer **Distribute App > App Store Connect > Upload**
- 10~30분 뒤 App Store Connect(https://appstoreconnect.apple.com) → 앱 → **TestFlight** 탭에 빌드

## A-3. TestFlight 확인
**TestFlight > 내부 테스트 > +** 그룹에 나 추가 · 빌드 추가 → 아이폰 TestFlight 앱으로 설치
- ⬜ 로그인(이메일 · Apple · Google) · 게스트 시작
- ⬜ 가방 4개 이상 만들기, 팩 11개 이상
- ⬜ 설정에 "모든 기능 무료 · 출시 기념", 구매·코드 입력 화면이 어디에도 안 나옴
- ⬜ 사진 첨부 > 사진 찍기 → 카메라 권한 창, 앱 안 꺼짐 / 메모 PDF 첨부
- ⬜ AI 메모로 가방 만들기 3회 후 "내일 다시" 안내 / 게스트는 "로그인하면 쓸 수 있어요"
- ⬜ 햅틱, 화면 켜두기(가방 더보기)

## A-4. 심사 제출
App Store Connect → 앱 → 왼쪽 **iOS 앱 옆 +** → 새 버전(A-2 Version과 같게)
- ⬜ 스크린샷: iPhone 6.9″ 8장 / iPad 13″ 8장(지원 시)
- ⬜ 설명: 가격·프리미엄·"무료 2명" 같은 말 없이 기능 위주. 공유는 "최대 10명"으로 지금 그대로 맞다
- ⬜ 지원 URL · 개인정보 처리방침 URL 열리는지
- ⬜ **빌드** 선택. **인앱 구입은 선택하지 않는다**
- ⬜ **App 심사 정보**: 데모 계정(이메일 인증 완료 · 샘플 가방) / 연락처 / 메모:
  ```
  팩인백은 가족·친구와 함께 쓰는 짐 체크리스트입니다. 인앱 구입은 없으며 모든 기능을 무료로 제공합니다(AI 기능만 하루 3회).
  계정 삭제: 설정 > 프로필 수정 하단 "회원 탈퇴".
  로그인: 이메일, Sign in with Apple, Google을 지원하며 게스트로도 시작할 수 있습니다.
  네이티브 기능: Sign in with Apple, 햅틱 피드백, 화면 켜두기, 카메라·사진 첨부.
  ```
- ⬜ 왼쪽 **앱 개인정보** → 이메일 주소 · 사용자 ID · 사진 또는 비디오 · 기타 사용자 콘텐츠 = 앱 기능 / 사용자에게 연결됨 / 추적 안 함 → **게시** (구입 내역은 지금은 넣지 않음)
- ⬜ 왼쪽 **앱 정보 > 연령 등급** 설문
- ⬜ **심사를 위해 추가 → 제출**
- 거절되면 메일 원문 그대로 붙여주기(4.2 최소 기능 등)

---

# B. 결제 도입 (나중에 — 사업자를 낼 수 있게 되면)

## B-0. 먼저 정할 것
- 판매자 명의: 본인 사업자(겸업 가능해진 뒤) / 다른 사업자에게 앱 이전(App Store Connect "앱 이전")
- 기존 무료 사용자: 출시 기간에 만든 가방·팩이 한도를 넘는 사람이 많을 것 → **그대로 둘지(예: 기존 사용자 영구 무료 = grandfathering)**, 넘는 것만 잠글지(지금 코드는 잠금)
- 가격(예 ₩5,900 한 번 결제), 프리미엄 구성(위 표 오른쪽 열)

## B-1. 사업자 · 세금 (홈택스 https://hometax.go.kr)
- 사업자등록 신청(개인) → 간이과세자 후보, 업종 응용 소프트웨어 개발 및 공급업(722000) 후보 → 사업자등록증명 PDF
- 통신판매업 신고 필요 여부는 세무서(126)에 확인. 세무 판단은 세무사에게

## B-2. App Store Connect — **비즈니스 > 계약**
- 법인 정보 편집(이름·주소·전화·이메일) → 대한민국 규정 준수 → **EU 거래자 자격**(거래자면 연락처 EU 공개 / 아니면 EU 판매 제외)
- **유료 앱 계약** 동의 → 은행 계좌 → 세금 양식: **대한민국 세금 양식**(사업자등록번호 + 증명서 업로드) · **U.S. W-8BEN**
- 상태 **활성화됨** 확인(이게 아니면 앱에서 상품이 안 불러와짐)
- 앱 > **수익화 > 인앱 구입 > +** : 비소모성 / `com.appfle.packinbag.premium.lifetime` / 가격 / 한국어 표시 이름·설명 / 심사 스크린샷(프리미엄 시트)
- **사용자 및 액세스 > 통합 > 인앱 구입** → 키 생성 → `.p8` · Key ID · Issuer ID
- **사용자 및 액세스 > Sandbox > 테스트 계정 +**

## B-3. RevenueCat (https://app.revenuecat.com)
- 프로젝트 → **Project settings > Apps**: App Store 앱, Bundle `com.appfle.packinbag`, `.p8` + Key ID + Issuer ID
- **Product catalog > Products**: 위 제품 ID / **Entitlements**: `premium`(코드 `lib/purchaseConfig.ts`와 같게) → 상품 Attach / **Offerings**: `default` Make current → Lifetime 패키지
- **Project settings > API keys**: `appl_...`(공개) / **Secret API keys + New, V1** `sk_...`
- **Integrations > Webhooks**: URL `https://packinbag.seeuson.com/api/revenuecat-webhook`, Authorization = `openssl rand -hex 24` 값, Production and Sandbox
- **Project settings > General > Restore behavior**: Transfer to new App User ID

## B-4. Vercel 환경변수 (Settings > Environment Variables, Production·Preview)
- `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH_HEADER` → Redeploy → 웹훅 Send test event 200

## B-5. 코드 (스위치 끄기)
- `lib/freeLaunch.ts` → `FREE_LAUNCH = false`
- `storage.rules` `freeLaunch()` → `return false;` → `npx firebase-tools deploy --only storage`
- 기존 사용자 정책(B-0)에 따라: 그대로 두면 sync-lock-status가 한도 넘는 가방·팩을 잠근다. 영구 무료로 할 거면 Claude에게 "출시 기간 가입자 유지" 로직 요청
- 이미 준비된 것(10/9): 구매 → `/api/sync-purchase`로 서버 즉시 확인, 웹훅(구매·환불·TRANSFER), iOS에서 코드 입력 숨김(3.1.1), 상품 못 불러올 때 다시 불러오기, 복원 버튼 항상 표시
- `ios/App/App/PrivacyInfo.xcprivacy`의 구입 내역 항목은 이미 들어 있음

## B-6. Xcode · 테스트 · 제출
- Xcode **+ Capability → In-App Purchase** → 새 빌드
- TestFlight 결제 테스트: 가격 표시 · 구매 후 몇 초 안에 프리미엄 · 관리자 유저 조회 premiumPurchase · RevenueCat Customers · 재설치 유지 · 다른 계정 복원(TRANSFER) · 취소 · 오프라인 시 다시 불러오기
- 심사: 버전에 **인앱 구입 상품 선택**(첫 상품은 같이 제출), 앱 개인정보에 **구입 내역** 추가, 메모에 "비소모성 인앱 구입, 설정 > 프리미엄에서 구매·복원"
- 설명 문구: "무료 2명 · 프리미엄 10명" 등 바뀐 한도 반영

## 참고 파일
- 스위치: `lib/freeLaunch.ts`, `storage.rules` freeLaunch()
- 결제: `lib/purchaseService.ts`, `components/v2/sheets/PremiumSheet.tsx`, `app/api/sync-purchase`, `app/api/revenuecat-webhook`, `lib/purchaseConfig.ts`
- 판정: `lib/premiumServer.ts`, `lib/premiumLimits.ts`, `lib/aiQuotaServer.ts`
- iOS: `ios/App/App/Info.plist`, `PrivacyInfo.xcprivacy`, `capacitor.config.ts`
