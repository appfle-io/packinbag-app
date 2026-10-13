# packinbag 이메일 인증 - Resend 전환 + Firebase 폴백 구현 완료 (2026-08-24 · 10-13 갱신)

> 상태(10/13): 코드 완료, 변경 없음. Resend 가입·DNS·API 키 등록과 폴백 QA는 아직 사용자 몫(아래 "남은 작업"). 키가 없으면 지금처럼 Firebase 기본 메일이 나간다(스팸함 가능성만 남음).
> 참고: 메일 템플릿 색이 예전 브랜드 주황(#FF6E2D)이다. 앱은 10/6부터 딥그린(#2E5E4E)이라, Resend를 켤 때 함께 바꿀지 정한다(`lib/resendEmail.ts`).
> 이 문서는 저장소 `docs/`가 원본. 남은 일 목록은 `packinbag_남은작업_2026-10-13.md` 5절

## 배경
- 기존 문제: Firebase Auth 기본 이메일 발송이 스팸함으로 분류됨 (발신 도메인이 google/firebaseapp 계열이라 SPF/DKIM 서명 주체를 바꿀 수 없음)
- 추가 요청: 발송된 메일 디자인이 너무 밋밋함(브랜드감 없음) + Resend에 문제가 생겨도 인증 메일이 무조건 가야 함(폴백)

## 최종 아키텍처 (링크 클릭 방식 유지, 발신 채널만 교체)
6자리 코드 입력 방식(원래 계획)이 아니라, **Firebase의 실제 인증 링크는 그대로 쓰고 발송 채널만 Resend로 교체**하는 방식을 택함.
- 이유: 앱 전체가 Firebase의 `emailVerified` 플래그를 기준으로 동작 중이라, 이 방식은 기존 인증 로직(AuthProvider, 로그인 가드 등)을 전혀 안 건드려도 됨. 코드 입력 방식은 emailVerified를 별도로 동기화하는 다리 코드 + 신규 UI가 필요해서 변경 범위가 훨씬 컸음.
- 스팸 문제의 원인(발신 도메인 SPF/DKIM)은 링크/코드 방식과 무관하므로, 이 방식으로도 스팸함 문제는 동일하게 해결됨.

## 구현 내용
1. `app/api/send-verification-email/route.ts` (신규)
   - 로그인한 사용자의 idToken 검증 후, Firebase Admin SDK `generateEmailVerificationLink()`로 진짜 인증 링크 생성
   - 그 링크를 Resend REST API(`https://api.resend.com/emails`, fetch 직접 호출 - npm 패키지 설치 없음)로 발송
   - **어떤 이유로 실패하든(RESEND_API_KEY 없음, Resend 에러, Admin SDK 초기화 실패 등) 예외를 던지지 않고 항상 200 + `{sent:false}` 응답** → 클라이언트가 이걸 보고 폴백
2. `lib/resendEmail.ts` (신규) - Resend 호출 + 브랜드 컬러(#FF6E2D, 예전 주황 - 지금 앱은 딥그린 #2E5E4E) 적용한 커스텀 HTML 이메일 템플릿
3. `lib/emailVerification.ts` (신규) - 클라이언트 헬퍼 `sendVerificationEmailWithFallback(user)`
   - `/api/send-verification-email` 호출 → 실패 시(응답 sent:false 포함 모든 실패 케이스) 즉시 기존 Firebase `sendEmailVerification(user)`로 자동 폴백
4. `contexts/AuthProvider.tsx` (수정, 10/5 구 UI 삭제 후에도 그대로) - 기존 4곳의 `sendEmailVerification(...)` 호출을 전부 `sendVerificationEmailWithFallback(...)`로 교체 (signUpWithEmail, linkAccountWithEmail, resendVerificationEmail, resendVerificationByCredential)
5. `.env.local.example`에 `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` 안내 추가 (10/6 반영 완료)

## 남은 작업 (사용자가 직접)
1. https://resend.com 가입 → **Domains > Add Domain** → `seeuson.com` → 보여 주는 SPF · DKIM(TXT · MX) 레코드를 도메인 DNS에 등록 → Verified가 될 때까지 기다림(DMARC TXT `_dmarc`도 권장)
2. **API Keys > Create API Key**(Sending access) → 로컬 `~/Desktop/packinbag.nosync/.env.local`에 `RESEND_API_KEY=` → https://vercel.com → packinbag → **Settings > Environment Variables**에 같은 이름으로(Production · Preview) → **Deployments > Redeploy**. `_secrets/README.md` 표에도 적기
- ~~`.env.local.example`에 `RESEND_API_KEY`·`NEXT_PUBLIC_APP_URL` 추가~~ → 10/6 완료(filesystem MCP로 직접 반영)
- 발신 주소는 `lib/resendEmail.ts`의 `VERIFICATION_FROM = "팩인백 <noreply-packinbag@seeuson.com>"`에 고정되어 있음 - 바꾸려면 이 값과 Resend 도메인 등록을 함께 변경
- 배포 후 실제 가입 플로우로 스팸함 안 가는지, 그리고 RESEND_API_KEY를 일부러 잘못된 값으로 바꿔서 폴백이 실제로 Firebase 기본 메일을 보내는지 QA 필요
- (선택) 메일 템플릿 색을 앱과 같은 딥그린(#2E5E4E)으로 - 바꾸기로 하면 Claude에게 요청
