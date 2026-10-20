# 프리미엄 · 한도 · 이용권 · 잠김 — premium.md

기준 코드: v1.6.1 (2026-10-15). 설정의 프리미엄 줄 · AI 줄은 `settings.md`(SET-PREM), 참여 · 인원 한도 흐름은 `share.md`, 각 화면의 읽기 전용 표시는 `bag.md` · `home.md` · `packs.md`, 라우트 목록은 `api.md`, 규칙(`locked` 검사 · storage `isPremium()`)은 `security-rules.md`, 개인 잠금(PIN)은 `settings.md` SET-LOCK에서 다룬다.

> **지금은 FREE_LAUNCH = true(출시 기념 전원 무료, 10/9).** 화면 `isPremiumUser` · 서버 `isPremiumServer`가 둘 다 맨 앞에서 true를 돌려준다 → 아래의 무료 한도 · 잠김 · 프리미엄 시트는 **모두 쉬는 중**이고, AI 하루 3회만 살아 있다. 결제를 붙일 때 `lib/freeLaunch.ts`와 `storage.rules`의 `freeLaunch()`를 함께 false로(docs/packinbag_iap_release_guide.md "B. 결제 도입").

- 한도 · 판정: `lib/premiumLimits.ts`(상수 · `isPremiumUser` · `computeLockedBagIds` · `computeLockedPackIds` · `getViewablePacks`), 서버 `lib/premiumServer.ts` `isPremiumServer` · `verifyRequestUser`, 이용권 판정 `lib/unlockCodeCheck.ts`, AI 표시 `lib/aiUsageService.ts` `isUnlimitedAiUser`
- 잠김 기록: `app/api/sync-lock-status` · `lib/bagLockSync.ts`(+ `transfer-bag-ownership` · `restore-library-pack`이 같이 씀)
- 결제: `lib/purchaseService.ts`(RevenueCat) · `app/api/sync-purchase` · `app/api/revenuecat-webhook`, 이용권 `app/api/redeem-unlock-code`, 관리자 이용권 화면은 admin.md
- 안내 시트: `components/v2/sheets/PremiumSheet.tsx`(AppShell `premiumLimitMessage`가 여는 것 + 설정 + 메모 첨부)

---

## 0. 데이터

| 대상 | 필드 | 쓴 쪽 |
|---|---|---|
| users/{uid} | `premiumPurchase` { purchased · purchasedAt · productId · platform } | 서버만(sync-purchase · 웹훅) |
| users/{uid} | `unlockCode` · `unlockCodeExpiresAt` | 서버만(redeem-unlock-code) |
| users/{uid} | `role: "master"` | 서버만 |
| unlockCodes/{code} | `status`(unused · claimed · invalidated) · `claimedBy` { uid · email · claimedAt } · `durationType` · `durationDays` · `expiresAt` · `note` | 생성 · 무효화는 마스터, 사용 처리는 서버 |
| unlockRedeemUsage/{uid_날짜} | `fails` | 서버만(틀린 코드 횟수) |
| bags/{id} · users/{uid}/libraryPacks/{id} | `locked` | 서버만(sync-lock-status). 화면에서는 "읽기 전용" |
| users/{uid} | `aiUsage` { date(KST) · count } | 서버만 올림 |

### PREM-LIM 한도표 (FREE_LAUNCH를 끈 뒤 기준)

| ID | 항목 | 무료 | 프리미엄 | 막는 곳 |
|---|---|---|---|---|
| PREM-LIM-01 | 내가 만든 가방(휴지통 제외) | 3개 | 무제한 | 서버 `create-bag` · `restore-bag`, 넘친 것은 잠김 |
| PREM-LIM-02 | 참여한 남의 가방(휴지통 제외) | 3개 | 무제한 | 서버 `join-bag`, 넘친 것은 이 화면에서만 읽기 전용(PREM-LOCK-03) |
| PREM-LIM-03 | 가방당 인원(그룹장 포함) | 2명 | 10명 | 서버 `join-bag`, 기준은 **그룹장**의 프리미엄 |
| PREM-LIM-04 | 팩 보관함(팩 + 폴더, 빠른팩 · 휴지통 제외) | 10개 | 무제한 | 서버 `create-library-pack` · `import-shared-pack` · `restore-library-pack`, 넘친 것은 잠김 |
| PREM-LIM-05 | 가방 사진 | 내가 올린 것 1장 | 5장(가방 전체 상한, 공통) | 앱(`FREE_MAX_USER_BAG_IMAGES` · `MAX_BAG_IMAGES`) |
| PREM-LIM-06 | 메모 첨부 | 사진 1장(10/14부터) | 사진 · PDF · 파일(파일 10MB) | 앱 + storage.rules(파일은 프리미엄) |
| PREM-LIM-07 | 커스텀 URL(/c/) | 짧은 URL만 | 가능 | 서버 |
| PREM-LIM-08 | AI 하루 | 3회 | 50회 | 서버(`aiQuotaServer`) — FREE_LAUNCH여도 3회 |
| PREM-LIM-09 | AI 추천 팩(`aiRecommendSource` — 날씨 추천 · 가볼 곳) | 안 보임 | 보임 | 화면 `getViewablePacks`(함께 쓰는 무료 멤버가 프리미엄 멤버의 AI 결과를 못 보게) |
| PREM-LIM-10 | 휴지통 보관 | 30일 | 30일 | 같음 |
| PREM-LIM-11 | 가방 하나의 팩(메모 · 미분류 · AI 추천 팩 포함, 10/20) | 5개 | 30개 | 앱(`bagPackLimit`, 팩을 넣는 사람 기준) + 단축어 `native/add-item`(미분류를 새로 만들 때). 예전에는 모두 10개. 이미 더 든 가방은 잠그지 않고 새로 만드는 것만 막음. 규칙(firestore.rules)은 팩 수를 보지 않음(확인 필요 표 참고) |

---

## 1. PREM-JUDGE 프리미엄 판정

| ID | 규칙 |
|---|---|
| PREM-JUDGE-01 | 화면(`isPremiumUser`): FREE_LAUNCH → 오프라인 환경(`isOfflineEnvironment`) → 오프라인 가짜 프로필 → `role: master` → `premiumPurchase.purchased` → 이용권(`isUnlimitedAiUser`) 순서로 하나라도 맞으면 프리미엄 |
| PREM-JUDGE-02 | 이용권(화면): `unlockCode`가 있고, 실시간 상태(`unlockCodes/{code}` 구독)가 무효화 · 만료가 아니고, `unlockCodeExpiresAt`이 없거나 아직 안 지났으면 |
| PREM-JUDGE-03 | 서버(`isPremiumServer`): FREE_LAUNCH → 마스터(인증된 이메일 · masters · role) → `premiumPurchase.purchased` → `unlockCodes/{users.unlockCode}`가 **claimed이고 claimedBy.uid가 본인이고 만료 전**(`isUnlockCodeValidFor`). AI 횟수 · storage.rules `isPremium()`도 같은 기준 — 바꾸면 셋 다 |
| PREM-JUDGE-04 | 서버는 인증 안 된 이메일을 넘기지 않음(마스터 이메일로 가입만 하고 인증 안 한 계정 차단, 10/9) |
| PREM-JUDGE-05 | AppShell `premium` = 오프라인 모드 · 마스터 · `role` · `isPremiumUser`. 이 값이 true ↔ false로 바뀌면 `sync-lock-status` 호출, 프리미엄 → 무료면 잠깐 처리 중 화면 + "무료 회원으로 전환되어 일부 기능이 제한돼요" |

## 2. PREM-LOCK 무료 한도 초과 잠김 (읽기 전용)

| ID | 규칙 |
|---|---|
| PREM-LOCK-01 | 기준: 휴지통 아닌 것 중 **만든 시각 최신 N개만 쓰기 가능**, 나머지 잠김(가방 3 · 보관함 10, 빠른팩은 문서 id `quick-pack`으로 늘 제외) |
| PREM-LOCK-02 | 서버 기록: `sync-lock-status`가 내 가방 · 보관함의 `locked`를 다시 계산해 다른 것만 씀. 규칙이 잠긴 가방 · 팩의 **그룹장(본인) 수정**을 막음(다른 멤버는 그대로). 휴지통 보내기 · 삭제는 잠겨도 됨(자리를 비우는 동작) |
| PREM-LOCK-03 | 화면 계산: `computeLockedBagIds`(내가 만든 것 최신 3개 밖) · `computeLockedPackIds`. **참여 가방은 잠그지 않는다**(10/15): 무료인데 3개를 넘으면 `sync-lock-status`가 만든 시각 오래된 것부터 나가고(`leaveExcessJoinedBags`) 토스트 "무료로는 참여 가방을 3개까지 쓸 수 있어 오래된 N개에서 나왔어요. 다시 들어가려면 초대 코드가 필요해요". 앱을 닫아 둔 사이 무료가 됐으면 어긋남 맞추기(PREM-LOCK-04)가 부른다 |
| PREM-LOCK-04 | 어긋남 맞추기: 화면 계산과 서버 `locked`가 다르면(휴지통에 넣어 자리가 났거나, 앱을 닫아 둔 사이 이용권이 끝났거나) 3초 뒤 `sync-lock-status`를 한 번(같은 차이는 한 번만). 이미 구독 중인 목록만 비교 → 추가 읽기 없음 |
| PREM-LOCK-05 | 그룹장 넘기기 · 휴지통 되살리기 뒤에도 관련 사람의 잠김을 다시 계산 |
| PREM-LOCK-06 | 잠긴 것을 고치려 하면: 가방 "이 가방은 읽기 전용이에요. 프리미엄이면 다시 수정할 수 있어요." / 팩 "이 팩은 읽기 전용이에요. 프리미엄이면 다시 수정할 수 있어요." → 프리미엄 시트. 표시: 팩 목록 눈 아이콘 등(packs.md PACK-SCR-08) |

## 3. PREM-SHEET 프리미엄 시트

| ID | 규칙 |
|---|---|
| PREM-SHEET-01 | 제목 "프리미엄" + 왜 떴는지(서버 · 화면이 넘긴 문구, 닫히는 동안에도 유지) |
| PREM-SHEET-02 | iOS 앱: 인앱결제만(**이용권 코드 입력은 숨김** — App Store 3.1.1). 상품을 불러오는 동안 "불러오는 중", 실패하면 "지금은 구매 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요." + "다시 불러오기". 불러오면 "{가격}에 평생 프리미엄" + "한 번 결제하면 계속 쓸 수 있어요(구독 아님). 같은 Apple ID로 다른 기기에서도 복원할 수 있어요." 이미 프리미엄이면 "프리미엄 이용 중"(꺼짐) |
| PREM-SHEET-03 | iOS 구매 복원 "이미 구매했다면 복원하기"는 상품을 못 불러와도 늘 보임(심사 규정). 결과 없음 "구매 내역을 찾지 못했어요" / 실패 "구매 복원에 실패했어요" |
| PREM-SHEET-04 | 구매 · 복원 뒤 `sync-purchase`가 RevenueCat 서버에 직접 확인해 `premiumPurchase`를 바로 기록(웹훅을 기다리지 않음, 같은 계정 복원은 웹훅이 없어서). 서버 확인이 안 돼도 기기에서 활성이면 적용으로 봄. 결제 대기(Ask to Buy) "결제가 확인되면 프리미엄이 적용돼요" / 실패 "구매를 처리하지 못했어요. 잠시 후 다시 시도해주세요" / 사용자가 취소하면 문구 없음 |
| PREM-SHEET-05 | 웹 · 포터블: "이용권 코드 입력" → 코드 단계("{N}자리 이용권 코드를 입력해 주세요." · 대문자 · "뒤로" · "적용하기") → `redeem-unlock-code` |
| PREM-SHEET-06 | 풀리면 시트를 닫고 부른 쪽 토스트: 설정 "프리미엄이 적용됐어요"(기간제 "…(YYYY년 M월 D일까지)") / 한도 안내에서 "프리미엄이 적용됐어요. 다시 시도해 주세요" |
| PREM-SHEET-07 | 게스트(익명 계정)는 구매 · 코드 입력 대신 "프리미엄은 정식 계정에서 쓸 수 있어요. 지금 만든 가방과 팩은 그대로 두고 계정을 연결해요." + "정식 계정으로 전환하기"(→ 계정 연동 시트, 10/15) |

## 4. PREM-CODE 이용권 코드

| ID | 규칙 |
|---|---|
| PREM-CODE-01 | 형식: 영문 대문자 · 숫자 `UNLOCK_CODE_LENGTH`자리가 아니면 "코드를 다시 확인해주세요"(400) |
| PREM-CODE-02 | 틀린 코드(없음 · 무효화 · 남이 씀)는 계정마다 KST 하루 10번까지 → 넘으면 "코드를 너무 많이 틀렸어요. 내일 다시 시도해주세요"(429). 맞는 코드는 안 셈 |
| PREM-CODE-03 | 트랜잭션: 없음 "코드를 다시 확인해주세요" / 무효화 "더 이상 사용할 수 없는 코드예요" / 남이 씀 "이미 다른 계정에서 사용된 코드예요" / 내가 이미 쓴 코드 → 만료 시각을 **다시 늘리지 않고** 내 문서에 다시 맞춰 씀 / 처음 → 코드에 claimed · claimedBy · expiresAt(지금 + durationDays, 없으면 무제한) + 내 users에 unlockCode · unlockCodeExpiresAt + 감사 로그 |
| PREM-CODE-04 | 기간은 **쓴 시점부터** 셈(만든 시점 아님) |
| PREM-CODE-05 | 마스터가 무효화하면 화면은 `unlockCodes/{code}` 구독으로 즉시 무료(PREM-JUDGE-02), 서버도 다음 판정부터 무료 |

## 5. PREM-PAY 인앱결제 (iOS, 지금은 판매 안 함)

| ID | 규칙 |
|---|---|
| PREM-PAY-01 | 상품: 평생 프리미엄 하나(비소모성), entitlement `PREMIUM_ENTITLEMENT_ID`. RevenueCat 사용자 id = Firebase uid(로그인할 때 설정) |
| PREM-PAY-02 | 웹훅: Authorization 헤더가 `REVENUECAT_WEBHOOK_AUTH_HEADER`와 같아야(시간 차이 없는 비교). 부여 INITIAL_PURCHASE · NON_RENEWING_PURCHASE · RENEWAL · PRODUCT_CHANGE, 회수 CANCELLATION(환불). TRANSFER는 받는 계정 부여 · 내준 계정 해제(익명 RevenueCat id 건너뜀, 없는 문서는 만들지 않음) |
| PREM-PAY-03 | `sync-purchase`는 **부여만**(해제는 웹훅 CANCELLATION만 — RevenueCat 응답이 이상할 때 산 사람 것을 빼앗지 않게). 비밀 키가 없으면 웹훅만으로 반영 |
| PREM-PAY-04 | 사업자등록이 없어 판매는 미룸(10/9). 그동안 FREE_LAUNCH |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/15 게스트는 계정 연동 먼저(PREM-SHEET-07) | **게스트도 이용권 코드를 쓸 수 있다.** 설정 프리미엄 줄은 게스트를 계정 연동으로 보내지만, 한도 안내 · 메모 첨부에서 뜨는 프리미엄 시트는 게스트에게도 코드 입력을 보여 줌 → 게스트로 코드를 쓰고 게스트 모드를 끝내면 코드(1회용)가 사라짐. 시트에서도 게스트면 계정 연동을 먼저 안내할지 | `PremiumSheet` · `redeem-unlock-code` |
| ~~2~~ ✅ 10/15 잠금 대신 오래된 것부터 자동으로 나가기(PREM-LOCK-03) | **참여한 가방 3개 넘침 잠김은 화면에서만** 한다(`computeLockedBagIds`의 참여 가방 부분). 서버 `locked`도 규칙도 없어서, 같은 계정이라도 다른 화면 · 오래된 앱에서는 고쳐짐. 그리고 참여는 서버가 3개로 막으므로 넘치는 경우는 "프리미엄일 때 많이 참여했다가 무료로 바뀐 때"뿐. 이 잠김이 필요한지(없애기 / 서버에도 두기) | `computeLockedBagIds` |
| ~~3~~ ✅ 10/15 450건씩 나눠 씀 | 잠김 기록은 Firestore 일괄 쓰기 하나(최대 500개)로 함 → 보관함 항목이 500개를 넘게 바뀌면 실패. 지금 규모에선 문제 없음 | `syncLibraryPackLocks` |
| ~~4~~ ✅ 10/15 인증된 이메일만 | `redeem-unlock-code`만 인증 여부를 보지 않은 이메일을 `claimedBy.email`에 남김(다른 라우트는 인증된 이메일만). 관리자 화면에 남이 쓴 것처럼 보일 수 있는 이메일이 찍힐 수 있음(판정은 uid라 권한 문제는 없음) | `redeem-unlock-code` |
| ~~5~~ ✅ 10/15 주석 정리(값은 안 씀, knip으로 삭제 확인) | `MAX_PACK_IMAGES`(메모 첨부 3개, "무료는 첨부 불가") 상수 주석이 10/14 변경(무료 사진 1장)과 안 맞음. 쓰는 곳이 남아 있는지 · 값이 맞는지 | `lib/premiumLimits.ts` |
| ~~6~~ ✅ 10/15 유예 없이 바로 잠금(지금 동작 그대로) | FREE_LAUNCH를 끄는 순간 이미 한도를 넘게 만든 사람은 바로 잠김이 걸린다(화면 계산 → 3초 뒤 서버 기록). 출시 기념 기간에 만든 것을 그대로 두는 유예(예: 끄기 전 사용자는 그 시점 개수까지 허용)가 필요한지 | PREM-LOCK-04 |
| 7 | **가방당 팩 한도(PREM-LIM-11)는 앱 · 단축어만 막는다**(10/20). 규칙 · 서버 자동저장은 팩 수를 보지 않아서, 다른 경로(옛 앱 · 직접 쓰기 · `import-note` 메모로 가방 만들기 · 백업 복원 · 오프라인 옮기기)로는 무료도 5개를 넘을 수 있다. 결제를 붙일 때 서버(create-bag · 규칙)에서도 막을지, 지금처럼 화면 한도로 둘지 | `bagPackLimit` |
| 8 | 함께 쓰는 가방에서 팩 한도는 **넣는 사람** 기준이라, 프리미엄 그룹장이 팩 10개를 만든 가방에 무료 멤버는 새 팩을 못 만든다(기존 팩 편집은 됨). 인원 한도(그룹장 기준)와 맞춰 그룹장 기준으로 바꿀지 | BAG-LIM-01 |

## 테스트 후보 (단위, Firebase 없이)

| 대상 | ID |
|---|---|
| `isPremiumUser`(FREE_LAUNCH 주입 · 마스터 · 구매 · 이용권 만료 · 무효화) — FREE_LAUNCH를 인자로 받게 하면 쉬움 | PREM-JUDGE-01 · 02 |
| `isUnlockCodeValidFor`(claimed 아님 · 남의 uid · 만료 · 만료 없음) — ✅ 10/17 `lib/unlockCodeCheck.test.ts` | PREM-JUDGE-03 |
| `computeLockedBagIds`(내 것 최신 3개 · 참여 최신 3개 · 휴지통 제외 · createdAt 없음은 뒤) · `computeLockedPackIds`(빠른팩 id 제외 · 최신 10개) | PREM-LOCK-01 · 03 |
| `bagLockSync` 계산부(쓸 것만 고르기)를 순수 함수로 빼서 화면 계산과 같은 결과인지 | PREM-LOCK-02 |
| `getViewablePacks` · `bagMemberLimit` · `isTrashExpired` · `daysUntilPurge` | PREM-LIM-09 · 03 · 10 |
| 웹훅 TRANSFER id 거르기(익명 · 경로 문자 · 받는 쪽과 겹침) — 순수 함수로 빼면 쉬움 | PREM-PAY-02 |
