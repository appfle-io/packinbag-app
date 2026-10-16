# 로그인 · 가입 · 계정 — auth.md

기준 코드: v1.6.1 (2026-10-15). 인터넷 연결 판단 · 오프라인 모드 · 만들기 대기 · 합치기는 `offline.md`, 설정 > 프로필 · 비밀번호 · 탈퇴 시트 화면은 `settings.md`(SET-PROF · SET-PW · SET-DEL), 프리미엄 판정 · 이용권은 `premium.md`, 서버 라우트(`/api/auth/master-status` · `/api/send-verification-email`)는 `api.md`, 규칙은 `security-rules.md`에서 다룬다.

- 상태 · 함수: `contexts/AuthProvider.tsx`(user · profile · loading · authBusy · isGuest · isOfflineMode · isMaster + 로그인 · 가입 · 연동 · 탈퇴 · 프로필 쓰기)
- 화면: `components/v2/auth/AuthScreenV2.tsx`(로그인 · 가입) · `ProfileSetupV2.tsx`(첫 프로필) · `NicknameAvatarFields.tsx`, 게스트 → 계정 `components/v2/sheets/AccountLinkSheet.tsx`, 인증 안내 줄 `components/EmailVerifyBanner.tsx`
- 오류 문구: `lib/authErrorMessage.ts` `friendlyAuthError`
- 인증 메일: `lib/emailVerification.ts` `sendVerificationEmailWithFallback`(Resend → 실패하면 Firebase 기본 메일)
- 앱 네이티브 로그인: `lib/nativeAuth.ts`(iOS 앱은 팝업 대신 OS 로그인 창 → idToken)
- 탈퇴 데이터 정리: `lib/accountService.ts` `deleteAllUserData`
- 첫 샘플 데이터: `lib/sampleOnboardingData.ts` `seedSampleDataForNewUser`
- 화면 분기: `components/AppShell.tsx` 맨 앞(authBusy → 로그인 / loading → 스플래시 / user 없음 → 로그인 / 닉네임 · 캐릭터 없음 → 첫 프로필 / 그 밖 → 앱)

---

## 0. 데이터

| 대상 | 필드 | 쓰임 |
|---|---|---|
| Firebase Auth | `uid` · `email` · `emailVerified` · `isAnonymous` · `providerData[].providerId`(password · google.com · apple.com) · `metadata.lastSignInTime` | 계정 종류 · 인증 여부 · 재인증 판단 |
| users/{uid} | `email` · `displayName` · `nickname` · `avatarId` · `createdAt` · `role`(서버만) · `premiumPurchase` · `unlockCode` · `unlockCodeExpiresAt`(서버만) | 프로필. 닉네임 · 캐릭터가 둘 다 있어야 앱으로 들어감 |
| users/{uid} 그 밖 | 화면 · 정렬 · 고정 · 폴더 · 알림 · 잠금 등 | AuthProvider가 onSnapshot에서 **필드를 하나씩 골라 담는다** → 새 필드를 만들면 매핑에도 추가해야 화면에 보임 |
| masters/{uid} | 있으면 마스터 | 서버만 씀 |
| deletedAccounts/{uid} | `deletedAt` | 탈퇴 표시(한 번만 생성, 수정 · 삭제 불가) |
| 이 기기 | `pib_offline_mode` · `pib_device_start_page` | 오프라인 모드 표시 · 시작 화면(예전 기능) |

### 한도 · 상수

| ID | 규칙 | 값 | 코드 |
|---|---|---|---|
| AUTH-LIM-01 | 비밀번호 | 6자 이상(입력칸 minLength, Firebase weak-password) | `AuthScreenV2` · `AccountLinkSheet` |
| AUTH-LIM-02 | 닉네임 | 12자 | `NICK_MAX` |
| AUTH-LIM-03 | 프로필 문서 기다림 | 2.5초(그 뒤 캐시 값으로라도 연다) | `AuthProvider` users onSnapshot `safetyTimer` |
| AUTH-LIM-04 | 소셜 탈퇴 재인증 생략 | 마지막 로그인 4분 안 | `reauthenticateForDelete` |
| AUTH-LIM-05 | 스플래시 최소 | 0.9초 | AppShell `splashMinTimeDone` |

---

## 1. AUTH-BOOT 앱을 켤 때

| ID | 규칙 |
|---|---|
| AUTH-BOOT-01 | 주소에 `?offline=true`가 있거나 이 기기에 `pib_offline_mode`가 있으면 곧바로 오프라인 모드(offline.md OFF-MODE) |
| AUTH-BOOT-02 | 로그인 세션이 있으면(onAuthStateChanged) 오프라인 표시를 지우고 **언제나 계정 모드**. 프로필 문서가 올 때까지 로딩 유지(이전 계정의 빈 프로필로 "닉네임 정하기"가 스치지 않게). RevenueCat 초기화 |
| AUTH-BOOT-03 | 프로필 문서: 닉네임이 없고 캐시 · 내 쓰기에서 온 스냅샷이면 서버 답을 기다림(소셜 재로그인 때 ensureUserDoc 스냅샷 때문에 기존 계정이 첫 프로필 화면으로 튀던 문제). 2.5초 안에 서버 답이 없으면 그 값으로 연다 |
| AUTH-BOOT-04 | 세션이 없으면: **앱을 켤 때만** 연결을 확인(1.5초) → 끊김 · 폐쇄망이면 바로 오프라인 모드, 아니면 로그인 화면. 로그아웃 · 탈퇴 뒤에는 늘 로그인 화면(끊겨 있으면 그 화면이 오프라인 시작을 보여 줌) |
| AUTH-BOOT-05 | 마스터 판정: 서버 `/api/auth/master-status` · 토큰 claims(role=master 또는 admin) · `masters/{uid}` 문서 · `users.role == "master"` 중 하나면 마스터. 오프라인 모드에서는 모두 지우고 `isMaster`도 항상 false(10/15, 가짜 프로필의 role: master는 보지 않음) |
| AUTH-BOOT-06 | 화면 분기 순서: authBusy(가입 · 인증 다시 받기처럼 잠깐 로그인했다 바로 나가는 중) → 로그인 화면을 그대로 유지(다시 그려지면서 가입 완료 시트가 사라지지 않게) / loading → 스플래시 / user 없음 → 로그인 화면 / 닉네임 · 캐릭터 없음 → 첫 프로필 / 그 밖 → 앱 |

---

## 2. AUTH-SCR 로그인 화면

- 코드: `AuthScreenV2`. 가운데 한 열(최대 sm), 위 안전영역, 세로로 넘치면 스크롤

### AUTH-NET 연결 상태별 화면

| ID | 상태 | 화면 |
|---|---|---|
| AUTH-NET-01 | 확인 전(unknown) | 로고 + "팩인백" + "연결을 확인하고 있어요"만(폐쇄망에서 폼이 스치는 깜빡임 방지) |
| AUTH-NET-02 | 끊김 · 폐쇄망 | 와이파이 끔 아이콘 + "인터넷에 연결되지 않았어요" / "로그인 없이 이 기기에만 저장하는 오프라인 모드로 바로 시작할 수 있어요." + "오프라인 모드로 시작"(→ OFF-MODE) · "연결 다시 확인"(1.5초 확인, "확인하는 중" → 토스트 "인터넷에 연결됐어요" / "아직 인터넷에 연결되지 않았어요") · 글자 버튼 "온라인 계정으로 로그인"(연결과 상관없이 폼을 보여 줌) |
| AUTH-NET-03 | 연결됨 | 폼(아래). 끊김 ↔ 연결이 바뀌면 화면도 저절로 바뀜 |

### AUTH-FORM 로그인 · 가입 폼

| ID | 요소 | 보이는 조건 | 동작 · 문구 |
|---|---|---|---|
| AUTH-FORM-01 | 위 | 항상 | 로고 56 + "팩인백" + "같이 싸는 짐 체크리스트" |
| AUTH-FORM-02 | 전환 | 항상 | 2칸 "로그인 · 가입하기". 바꾸면 오류 · 인증 안내를 지움(입력값은 남음) |
| AUTH-FORM-03 | 이메일 · 비밀번호 | 항상 | 자리글 "이메일" · "비밀번호 (6자 이상)". 키보드 엔터로 제출 |
| AUTH-FORM-04 | 비밀번호 확인 | 가입 | 다르면 칸이 빨강 + "비밀번호가 서로 달라요", 버튼 꺼짐 |
| AUTH-FORM-05 | 닉네임 · 캐릭터 | 가입 | `NicknameAvatarFields`: "닉네임 · 함께 쓰는 사람에게 보여요"(무작위 닉네임으로 시작, 12자, 새로고침 버튼 "닉네임 추천받기") + "캐릭터" 6열(무작위로 골라져 있음) |
| AUTH-FORM-06 | 오류 줄 | 오류가 있을 때 | 빨간 글(`friendlyAuthError`, § AUTH-ERR) |
| AUTH-FORM-07 | 인증 메일 다시 받기 | 인증 안 된 이메일로 로그인했을 때 | 글자 버튼 → § AUTH-VERIFY-03 |
| AUTH-FORM-08 | 제출 버튼 | 항상 | "로그인" / "가입하기". 처리 중 · 비밀번호 불일치면 꺼짐 |
| AUTH-FORM-09 | 비밀번호를 잊었어요 | 로그인 | → § AUTH-RESET(지금 이메일을 채워서) |
| AUTH-FORM-10 | 또는 | 항상 | 구분선 "또는" |
| AUTH-FORM-11 | Google로 계속하기 · Apple로 계속하기 | 포터블이 아닐 때 | § AUTH-SOCIAL. 포터블은 숨김(앱 안 팝업이 기본 브라우저로 빠지고 127.0.0.1은 승인 도메인이 아님) |
| AUTH-FORM-12 | 로그인 없이 둘러보기 | 항상 | § AUTH-GUEST |

### AUTH-SIGNIN 이메일 로그인

| ID | 규칙 |
|---|---|
| AUTH-SIGNIN-01 | 오프라인 표시를 지우고 로그인 → **이메일 인증이 안 됐으면 바로 로그아웃** + "이메일 인증이 아직 안 됐어요. 메일함을 확인해 주세요." + "인증 메일 다시 받기" |
| AUTH-SIGNIN-02 | 처리 중에는 authBusy(로그인 화면 유지) |

### AUTH-SIGNUP 이메일 가입

| ID | 규칙 |
|---|---|
| AUTH-SIGNUP-01 | 검사: 비밀번호 확인 다름 "비밀번호가 서로 달라요." / 닉네임 빔 "닉네임을 입력해 주세요." |
| AUTH-SIGNUP-02 | 순서(authBusy, 처리 중 화면 "가입하고 인증 메일을 보내고 있어요"): 계정 만들기 → Auth 표시 이름 = 닉네임 → users 문서(email · displayName · nickname · avatarId · createdAt) → 샘플 가방 · 팩 심기(실패해도 계속) → 인증 메일(Resend → Firebase, 둘 다 실패해도 가입은 됨) → **로그아웃**(인증 전에는 로그인 상태로 두지 않음) |
| AUTH-SIGNUP-03 | 결과 시트: 메일 보냄 "인증 메일을 보냈어요" / "{이메일}(으)로 인증 메일을 보냈어요." + "메일함(스팸함 포함)에서 인증을 마친 뒤 로그인해 주세요." · 메일 실패 "가입했어요" / "가입은 됐지만 인증 메일을 보내지 못했어요. 잠시 뒤 로그인 화면에서 다시 받아 주세요." · 버튼 "로그인하러 가기"(닫아도 같음) → 로그인 칸으로, 비밀번호 칸 비움 |

### AUTH-VERIFY 이메일 인증

| ID | 규칙 |
|---|---|
| AUTH-VERIFY-01 | 메일은 Firebase의 진짜 인증 링크를 Resend(브랜드 도메인)로 보내고, 어떤 이유로든 실패하면 Firebase 기본 메일로 다시 보냄(`/api/send-verification-email`, api.md) |
| AUTH-VERIFY-02 | 이메일 계정은 인증 전에는 로그인할 수 없음(AUTH-SIGNIN-01) |
| AUTH-VERIFY-03 | 로그인 화면 "인증 메일 다시 받기": 입력한 이메일 · 비밀번호로 잠깐 로그인 → 인증 안 됐으면 메일 → 로그아웃(authBusy). "보내는 중" → 토스트 "인증 메일을 다시 보냈어요. 스팸함도 확인해 주세요" / 실패는 오류 줄 |
| AUTH-VERIFY-04 | 앱 안 안내 줄(`EmailVerifyBanner`): 계정 모드 + 이메일 계정 + 인증 안 됨일 때만(= 게스트를 이메일로 연동한 직후). "이메일 인증이 아직 안 됐어요" + "다시 받기"(→ "인증 메일을 다시 보냈어요" / "잠시 후 다시 시도해주세요") + 닫기(이번 실행만) |

### AUTH-RESET 비밀번호 재설정 시트

| ID | 규칙 |
|---|---|
| AUTH-RESET-01 | 제목 "비밀번호 재설정" · "가입할 때 쓴 이메일로 재설정 링크를 보내 드려요." + 이메일 칸(로그인 칸 값으로 시작) |
| AUTH-RESET-02 | "재설정 메일 보내기"(빈 칸이면 꺼짐, 보내는 중 "보내는 중") → Firebase 기본 메일 → 토스트 "비밀번호 재설정 메일을 보냈어요. 스팸함도 확인해 주세요" + 닫힘 / 실패 토스트(오류 문구, 없으면 "메일을 보내지 못했어요") |
| AUTH-RESET-03 | 재설정 메일은 Resend를 거치지 않음(Firebase 기본 발신 — 스팸함으로 갈 수 있음) |

### AUTH-SOCIAL Google · Apple 로그인

| ID | 규칙 |
|---|---|
| AUTH-SOCIAL-01 | 웹: 팝업 로그인. Google은 누를 때마다 계정 고르기 화면(`prompt: select_account`), Apple은 email · name 범위 |
| AUTH-SOCIAL-02 | iOS 앱: OS 로그인 창에서 idToken(Apple은 rawNonce까지)만 받아 Firebase에 그 값으로 로그인(WKWebView는 Google 팝업을 막음) |
| AUTH-SOCIAL-03 | 로그인 뒤 users 문서에 email · displayName을 merge(`ensureUserDoc`). **createdAt은 문서가 없을 때만**(읽기 1번, 10/15 — 예전에는 로그인마다 덮어썼다. 못 읽으면 건드리지 않음). 게스트 로그인 · 연동도 같은 함수 → 닉네임이 없으면 첫 프로필(§ AUTH-SETUP) |
| AUTH-SOCIAL-04 | 사용자가 창을 닫으면 아무 문구 없음(`friendlyAuthError`가 빈 문자열) |

### AUTH-GUEST 게스트(로그인 없이 둘러보기)

| ID | 규칙 |
|---|---|
| AUTH-GUEST-01 | 익명 로그인 → users 문서 merge → 첫 프로필(§ AUTH-SETUP). 데이터는 서버(Firestore)에 저장됨(오프라인 모드와 다름) |
| AUTH-GUEST-02 | `isGuest`는 게스트 **또는 오프라인 모드**일 때 true. 게스트만 가리킬 때는 `isGuest && !isOfflineMode` |
| AUTH-GUEST-03 | 게스트에게 없는 것: 잠금(SET-LOCK-10) · 서버 푸시 · 회원 탈퇴 · 로그인 직후 합치기 시트. 프리미엄 줄을 누르면 "회원가입 후 프리미엄을 이용할 수 있어요" + 계정 연동 시트 |
| AUTH-GUEST-04 | 게스트 모드 끝내기: 확인 "게스트 모드를 끝낼까요?" / "회원가입 없이 나가면 지금까지 만든 가방과 팩이 모두 지워질 수 있어요." / "지우고 나가기" → 로그아웃(서버 데이터는 지우지 않음 — 확인 필요 3) |

### AUTH-ERR 오류 문구 (`friendlyAuthError`)

| ID | Firebase 코드 | 문구 |
|---|---|---|
| AUTH-ERR-01 | 한글이 든 메시지 | 그대로(앱이 만든 안내) |
| AUTH-ERR-02 | email-already-in-use | 이미 가입된 이메일이에요. |
| AUTH-ERR-03 | invalid-email | 이메일 형식을 확인해주세요. |
| AUTH-ERR-04 | weak-password | 비밀번호는 6자 이상이어야 해요. |
| AUTH-ERR-05 | missing-password | 비밀번호를 입력해주세요. |
| AUTH-ERR-06 | wrong-password · invalid-credential | 이메일 또는 비밀번호가 맞지 않아요. |
| AUTH-ERR-07 | user-not-found | 가입되지 않은 이메일이에요. |
| AUTH-ERR-08 | user-mismatch | 지금 로그인한 계정과 다른 계정을 골랐어요. 같은 계정으로 다시 확인해주세요. |
| AUTH-ERR-09 | user-disabled | 사용이 중지된 계정이에요. 문의해주세요. |
| AUTH-ERR-10 | too-many-requests | 잠시 후 다시 시도해주세요. 시도 횟수가 너무 많아요. |
| AUTH-ERR-11 | network-request-failed | 인터넷에 연결되지 않았어요. 연결을 확인하거나 오프라인 모드로 써 주세요. |
| AUTH-ERR-12 | requires-recent-login | 보안을 위해 로그아웃 후 다시 로그인한 뒤 시도해주세요. |
| AUTH-ERR-13 | unauthorized-domain | 이 환경에서는 이 로그인 방법을 쓸 수 없어요. 이메일로 로그인하거나 오프라인 모드를 이용해주세요. |
| AUTH-ERR-14 | operation-not-allowed | 지금은 이 로그인 방법을 쓸 수 없어요. 다른 방법으로 로그인해주세요. |
| AUTH-ERR-15 | popup-blocked | 로그인 창이 막혔어요. 팝업을 허용하거나 이메일로 로그인해주세요. |
| AUTH-ERR-16 | popup-closed-by-user · cancelled-popup-request · cancel(led) | ""(알리지 않음) |
| AUTH-ERR-17 | 그 밖 | 문제가 발생했어요. 다시 시도해주세요. |

---

## 3. AUTH-SETUP 첫 프로필 (닉네임 · 캐릭터)

- 진입: 로그인은 됐는데 닉네임 · 캐릭터가 없을 때(Google · Apple · 게스트 첫 로그인). 코드 `ProfileSetupV2`

| ID | 규칙 |
|---|---|
| AUTH-SETUP-01 | "거의 다 왔어요" / "가방에서 보일 닉네임과 캐릭터를 골라 주세요" + `NicknameAvatarFields`(무작위로 시작) |
| AUTH-SETUP-02 | "시작하기"(닉네임 빔 · 저장 중 꺼짐, "저장 중") → `completeProfile` → 토스트 "반가워요! 프로필을 저장했어요" / 실패 "프로필을 저장하지 못했어요. 다시 해 주세요" |
| AUTH-SETUP-03 | 처음이면(닉네임 · 캐릭터 둘 다 없음) 샘플 가방 · 팩을 심는다. **단 이미 가방이 하나라도 있으면 심지 않음**(프로필 필드만 사라진 기존 계정 보호, 8/25 사고) |
| AUTH-SETUP-04 | 아래 글자 버튼: 게스트 "처음 화면으로" / 그 밖 "다른 계정으로 로그인" → 확인 "로그아웃할까요?" / "로그아웃"(빨강) |

---

## 4. AUTH-LINK 게스트 → 정식 계정 (계정 연동 시트)

- 진입: 설정 프로필 줄 · "계정 연동하기"(게스트), 프로필 "정식 계정으로 전환하기", 프리미엄 줄(게스트). 모두 인터넷 필요(`guard`). 코드 `AccountLinkSheet`
- 원칙: 같은 uid에 로그인 수단을 붙이는 것이라 **가방 · 팩이 그대로 남는다**

| ID | 규칙 |
|---|---|
| AUTH-LINK-01 | 제목 "정식 계정으로 전환" · "지금 만든 가방과 팩을 그대로 두고 계정을 연결해요. 다른 기기에서도 로그인해서 쓸 수 있어요." |
| AUTH-LINK-02 | 방법: "Google로 계속하기" · "Apple로 계속하기"(포터블은 숨김) · "이메일로 가입하기" + 아래 작은 빨간 "게스트 모드 끝내기"(AUTH-GUEST-04와 같은 확인) |
| AUTH-LINK-03 | Google · Apple: 웹은 팝업, iOS 앱은 OS 창 idToken으로 연결 → users merge → 토스트 "Google 계정으로 연결했어요" / "Apple 계정으로 연결했어요" + 닫힘 |
| AUTH-LINK-04 | 이메일 단계: 이메일 · 비밀번호(6자 이상) · 확인 + "이전" · "연결하기"(진행 중 빙글이). 검사: 빈 칸 "이메일과 비밀번호를 입력해 주세요." / 6자 미만 "비밀번호는 6자 이상이어야 해요." / 다름 "비밀번호가 서로 달라요." |
| AUTH-LINK-05 | 이메일 연결 → users에 email 기록 → 인증 메일(AUTH-VERIFY-01) → 보냄: "인증 메일을 보냈어요" 단계("{이메일}(으)로 인증 메일을 보냈어요." / "메일함(스팸함 포함)에서 인증을 마쳐 주세요." + 회색 상자 "인증을 마치기 전에 로그아웃하면 이 이메일로 다시 로그인할 수 없어요. 지금 만든 가방과 팩을 잃지 않으려면 먼저 인증해 주세요."(10/15) + "확인") / 메일 실패: 토스트 "이메일 계정으로 연결했어요. 인증 메일을 보내지 못했으니 화면 위 '다시 받기'를 눌러 주세요"(10/15) + 닫힘. 연결 뒤에는 로그인 상태 그대로(앱 안 안내 줄 AUTH-VERIFY-04) |
| AUTH-LINK-06 | 이미 쓰는 계정: 이메일 "이미 가입된 이메일이에요. 다른 이메일을 써 주세요." / 소셜 "이미 가입된 계정이에요. 다른 계정을 고르거나 로그인해 주세요." 그 밖은 AUTH-ERR. 오류는 시트 안 회색 상자 |
| AUTH-LINK-07 | 진행 중에는 X · 바깥으로 닫히지 않음. 열 때마다 처음 단계 · 빈 칸 |

---

## 5. AUTH-OUT 로그아웃

| ID | 규칙 |
|---|---|
| AUTH-OUT-01 | 계정 · 게스트: Firebase 로그아웃 → 이 기기 Firestore 캐시(IndexedDB) 지우기 시도(다음 계정이 앞 계정 캐시를 잠깐 보지 않게, 실패해도 무시) → 로그인 화면 |
| AUTH-OUT-02 | 오프라인 모드: `exitOfflineMode`(이 기기 데이터는 남김) → 로그인 화면 |
| AUTH-OUT-03 | 화면 쪽 확인 문구는 settings.md SET-ACC-01 ~ 03 |

---

## 6. AUTH-DEL 회원 탈퇴 (안쪽 처리)

- 화면(닉네임 입력 · 비밀번호 칸)은 settings.md SET-DEL

| ID | 규칙 |
|---|---|
| AUTH-DEL-01 | **본인 확인을 먼저**: 이메일 계정은 지금 비밀번호로 재인증(없으면 missing-password). Google · Apple은 마지막 로그인이 4분 안이면 건너뛰고, 아니면 다시 로그인 창(웹 팝업 · iOS OS 창). 여기서 실패하면 아무것도 지워지지 않음 |
| AUTH-DEL-02 | 순서(`deleteAllUserData`): `deletedAccounts/{uid}` 표시 → 내 가방 · 보관함 한 번 읽기 → 나 혼자인 가방: 다른 곳이 안 쓰는 첨부 삭제 + 가방 삭제(초대코드 · 메모 본문 포함) → 함께 쓰는 가방: 내가 그룹장이면 **가장 먼저 들어온 멤버에게 그룹장 넘김**(실패해도 계속, 휴지통 가방은 넘기지 않음) + 나가기 → 보관함 첨부(남는 공유 가방이 쓰는 것 제외) · 보관함 항목 삭제 → users/{uid} 삭제 → Auth 계정 삭제 → 캐시 지우기 |
| AUTH-DEL-03 | 마지막 Auth 삭제가 requires-recent-login으로 막히면 "보안을 위해 다시 로그인한 뒤 탈퇴를 진행해주세요. (데이터는 이미 삭제되었어요)" |
| AUTH-DEL-04 | 오프라인 모드 · 게스트는 탈퇴 없음 |
| AUTH-DEL-05 | 본인 확인 뒤 데이터를 지우다(`deleteAllUserData`) 또는 마지막 계정 삭제가 네트워크 등으로 실패하면 "일부만 지워졌어요. 다시 탈퇴하면 남은 것을 마저 지워요"(탈퇴 시트 안 빨간 글, 10/17). 다시 하면 남은 것만 지워진다. requires-recent-login은 AUTH-DEL-03 문구 그대로 |

---

## 7. AUTH-PROF 프로필 쓰기 공통

| ID | 규칙 |
|---|---|
| AUTH-PROF-01 | users 문서 쓰기는 `writeUser(patch, dotted)`로만. 오프라인 모드면 이 기기 로컬 프로필에 저장하고 화면에 바로 반영(점 경로 · 필드 지우기 `REMOVE_FIELD`까지) |
| AUTH-PROF-02 | 서버만 쓰는 필드(role · premiumPurchase · unlockCode · unlockCodeExpiresAt)는 규칙이 막음 |
| AUTH-PROF-03 | 닉네임 · 캐릭터를 바꾸면 공유 가방의 내 `memberProfiles` 스냅샷을 AppShell이 맞춤(SET-PROF-07) |
| AUTH-PROF-04 | 이용권이 끝났는데 짧은 URL · 지역 추천 토글이 켜져 있으면 자동으로 끔(예전 기능 필드) |
| AUTH-PROF-05 | 이용권 실시간: `unlockCodes/{code}`를 따로 구독해 무효화 · 만료를 바로 반영(`unlockCodeLiveStatus`). 만료 시각에 맞춰 한 번 다시 판단(20일 단위로 끊어 예약) — premium.md |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/15 처음 생길 때만 createdAt(AUTH-SOCIAL-03) | **Google · Apple · 게스트 로그인 · 연동 때마다 `users.createdAt`이 지금 시각으로 바뀐다.** `ensureUserDoc`이 `createdAt: serverTimestamp()`를 merge로 쓰므로 가입 시각이 "마지막 소셜 로그인 시각"이 됨. 가입 시각을 쓰는 곳(관리자 대시보드 신규 가입 · 재방문 등)이 틀어짐 | `ensureUserDoc` |
| ~~2~~ ✅ 10/15 서버 라우트 `delete-account-data`가 모두 지움(함께 쓰는 가방은 그대로 넘김) | **탈퇴할 때 남는 데이터**: 내가 만든 짧은 URL · 커스텀 URL(`shortLinks` · `customShortLinks`), 공개 공유 스냅샷(`sharedPacks` — 링크만 있으면 누구나 계속 열림), `users/{uid}/notifications` 하위 문서(부모를 지워도 남음), 함께 쓰던 가방의 내 `presence`, 위젯 기기 토큰(`deviceTokens`), 문의(`inquiries`, 규칙상 삭제 불가)를 `deleteAllUserData`가 지우지 않음. 어디까지 지울지(서버 라우트로 옮겨 Admin SDK로 지우는 방법 포함) | `lib/accountService.ts` |
| ~~3~~ ✅ 10/15 끝낼 때 탈퇴처럼 모두 지움(logout) | **게스트 모드를 끝내면 서버 데이터가 그대로 남는다.** 익명 계정은 다시 로그인할 방법이 없어 가방 · 팩 · users 문서 · Storage 첨부가 주인 없이 쌓임. 문구는 "지워질 수 있어요". 끝낼 때 지울지(탈퇴처럼 `deleteAllUserData` + 계정 삭제) | `AccountLinkSheet` · 설정 SET-ACC-02 |
| ~~4~~ ✅ 10/15 휴지통 속 함께 쓰는 가방은 완전 삭제 | 탈퇴할 때 **휴지통에 넣어 둔 함께 쓰는 가방**은 그룹장을 넘기지 않고 나가기만 함 → 다른 멤버 화면에는 그대로 보이지만 그룹장(탈퇴한 계정)이 없어 휴지통 30일 자동 삭제 · 되살리기 · 멤버 관리가 영영 안 됨. 넘기고 휴지통 표시를 풀지 / 지금처럼 둘지 | `deleteAllUserData` |
| ~~5~~ ✅ 10/17 실패 문구를 "일부만 지워졌어요 …"로(AUTH-DEL-05) | ~~탈퇴 중간에 실패하면 일부만 지워진 채 계정은 남는다~~ | `deleteAccount` |
| ~~6~~ ✅ 10/15 오프라인 모드는 isMaster false(AUTH-BOOT-05) | 오프라인 모드의 가짜 프로필이 `role: "master"`라 `isMaster`가 true. 지금은 쓰는 곳마다 오프라인을 따로 걸러서 문제는 없지만(설정 관리자 줄 등), 새 코드가 `isMaster`만 보면 오프라인 모드에서 관리자 기능이 열릴 수 있음. `isMaster`에서 오프라인을 빼 둘지 | `AuthProvider` `isMaster` |
| ~~7~~ ✅ 10/15 Resend 우선 + Firebase 폴백(`send-password-reset`, 이메일마다 60초 · 하루 5통, 가입 안 한 이메일도 "보냈다"고 답함) | 비밀번호 재설정 메일은 Firebase 기본 발신이라 인증 메일(Resend)과 달리 스팸함으로 갈 수 있음 | `sendPasswordReset` |
| ~~8~~ ✅ 10/15 토스트에 메일 실패 안내(AUTH-LINK-05) | 게스트를 이메일로 연동할 때 인증 메일 발송이 실패하면 토스트가 "이메일 계정으로 연결했어요"뿐이라 메일이 안 간 걸 모름(앱 안 안내 줄로 다시 받을 수는 있음) | `AccountLinkSheet.submitEmail` |
| ~~9~~ ✅ 10/15 연동 완료 화면에 안내(AUTH-LINK-05) | 게스트를 이메일로 연동한 뒤 인증하지 않고 로그아웃하면, 그 이메일로는 인증 전까지 다시 로그인 못 함(AUTH-SIGNIN-01) → 게스트 데이터에 못 들어감. 연동 단계 안내에 넣을지 | AUTH-LINK-05 |
| 10 | AuthProvider에 v2에서 안 쓰는 함수 · 필드가 남아 있음(`updateThemePrefs`의 강조색 · 카드 필드, 시작 화면 `updateStartPage` · `deviceStartPage`, 사이드바 폭, 보기 방식 등). 정리 대상인지(필드 데이터는 보존). **10/15 결정: 정리한다** — 다음 세션에 knip 결과로 쓰는 곳을 확인한 뒤 지운다(ThemeProvider가 쓰는 `updateThemePrefs` · `updateFontScale`은 남김) | `AuthProvider` |

## 테스트 후보 (단위, Firebase 없이)

| 대상 | ID |
|---|---|
| `friendlyAuthError`(코드별 문구 · 한글 그대로 · 취소는 빈 문자열) | AUTH-ERR-01 ~ 17 |
| `applyUserPatch`(점 경로 · REMOVE_FIELD · 배열은 덮어씀) · `toFirestorePatch` — 순수 함수로 빼면 쉬움 | AUTH-PROF-01 |
| 화면 분기(authBusy · loading · user · 닉네임/캐릭터) — 순수 함수 `shellGate`로 빼면 쉬움 | AUTH-BOOT-06 |
| `nextOwner`(가장 먼저 들어온 멤버 · joinedAt 없음은 뒤 · 혼자면 null) | AUTH-DEL-02 |
| 첫 프로필 샘플 심기 판정(닉네임 · 캐릭터 둘 다 없음 + 가방 0개) | AUTH-SETUP-03 |
| 프로필 스냅샷 기다림 판정(닉네임 없음 + 캐시/내 쓰기 → 기다림) | AUTH-BOOT-03 |
