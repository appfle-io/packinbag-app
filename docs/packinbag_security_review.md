# 팩인백 보안 점검 (2026-10-22 ~)

예전 점검(10/7 · 10/9 · 10/16, `docs/packinbag_settings_spec_v1.md`)은 **우리 코드의 권한 검사**(규칙 · API)만 봤다.
이번은 처음으로 **의존성 · 런타임 · 플랫폼**(남이 만든 코드)까지 본다. 결과에 ID를 붙여 진행 상황을 이 문서에 계속 적는다.

---

## 1. 오늘(10/20~10/22) 터진 이슈와 우리 해당 여부

| 이슈 | 내용 | 우리 | 판단 |
|---|---|---|---|
| **PHP2Shell** CVE-2026-109618 · 109619 (10/21) | PHP 엔진 원격 코드 실행(인증 없이) | PHP 안 씀 | **해당 없음** |
| **Oracle Java** 긴급 경보 CVE-2026-91403 (10/21) | Java 런타임 | 앱에 Java 없음. 회사(Spring) 쪽 일 | 앱은 **해당 없음** |
| **Node.js 보안 릴리스** (10/21, 10건) | Brotli 해제 원격 코드 실행 CVE-2026-111497(높음), TLS 호스트 검사 우회 2건, dns.resolve 잘림. 고친 버전 22.23.4 · 24.22.1 · 26.12.1 | Vercel 서버 · Cloud Functions(Node 22) · 로컬 Node 26.4.0 · Electron 34 | **해당**. 서버 런타임은 Vercel · Google이 올림(배포 다시 하면 반영) — 확인 필요. 로컬 Node는 사용자가 올림 |
| **Next.js 긴급 패치** (10/14) | `use cache` RCE(치명) · 이미지 최적화 SVG RCE(치명, sharp) · Server Actions DoS(높음). 고친 버전 16.4.1(지금 audit은 16.4.2 권장) | **next 16.2.10**, sharp 0.34.5 | **해당**(아래 SEC-DEP-01) |
| React Server Components DoS CVE-2026-23870 (10/9) | RSC 요청 하나로 서버 멈춤 | react 19.2.4 | Next를 올리면 함께 해결(Next가 쓰는 React는 Next에 들어 있음) |
| **Capacitor** CVE-2026-103922 (치명 9.3) | 앱 웹뷰 안 링크 하나로 내부 프록시 경로를 통해 외부 내용이 앱 주소로 열림 → localStorage · 네이티브 플러그인 접근 | **@capacitor/ios 6.2.1** | **해당**. 공유 가방 메모(남이 쓴 링크)가 바로 "링크를 누르게 하는" 통로. 6.2.2로 올리고 **스토어 새 빌드** 필요 |

참고: [Next.js 10/14 보안 공지](https://nextjs.org/blog/nextjs-security-update-october-14-2026) · [Node.js 10/21 (HKCERT)](https://www.hkcert.org/security-bulletin/node-js-multiple-vulnerabilities_20261022) · [Vercel Node.js 공지](https://vercel.com/kb/bulletin/node-js-security-advisory) · [Capacitor GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv) · [PHP2Shell (Rapid7)](https://www.rapid7.com/blog/post/etr-cve-2026-109618-and-cve-2026-109619-critical-unauthenticated-remote-code-execution-in-php/) · [10/21 보안 정리 (DEV)](https://dev.to/iamcanturk/october-21-security-roundup-php2shells-backstory-java-http3-node-railway-and-ovh-55m)

주의: 일부 Next.js 공지는 처음에 `npm audit`에 안 잡혔다고 한다. **audit이 깨끗해도 실제 설치 버전(`npm ls next`)으로 확인**한다.

---

## 2. `npm audit` 결과 (10/22, 운영 의존성만 `--omit=dev`)

루트: 55건(치명 2 · 높음 11 · 보통 42). functions: 보통 8건(firebase-admin 쪽 uuid 등).

| ID | 패키지(지금) | 등급 | 내용 | 고치기 | 우선 |
|---|---|---|---|---|---|
| SEC-DEP-01 | **next 16.2.10** | 치명 | 17건 묶음: 이미지 최적화 RCE · SSRF · 캐시 오염 · Server Actions DoS · next/og ImageResponse RCE 등. 끌려온 sharp 0.34.5 · postcss도 | `next` · `eslint-config-next` 16.4.2 | **P0** |
| SEC-DEP-02 | **@capacitor/ios 6.2.1** | 치명 | 위 CVE-2026-103922 | `@capacitor/*` 6.2.2 → `npx cap sync ios` → Xcode 새 빌드 · 제출 | **P0**(스토어라 시간이 걸림) |
| SEC-DEP-03 | prosemirror-view <1.42.3 | 높음 | **붙여넣기 XSS** — 메모 편집기(TipTap)가 씀. 공유 가방 메모로 남에게 퍼질 수 있음 | `npm audit fix`(마이너) | **P0** |
| SEC-DEP-04 | @tiptap/* 2.x | 보통 | `mergeAttributes` `__proto__` → 실행 가능한 DOM 속성. 고친 버전은 3.32(**메이저 업그레이드**) | 2.x 고친 판 있는지 확인, 없으면 3.x 이전을 따로 계획 | P1 |
| SEC-DEP-05 | @fastify/busboy · fast-xml-parser · brace-expansion · markdown-it · @grpc/grpc-js | 높음 | 대부분 DoS. firebase-admin · Google 라이브러리를 통해 끌려옴 | `npm audit fix`(범위 안) | P1 |
| SEC-DEP-06 | firebase(@firebase/firestore) | 높음 | grpc-js를 통한 표시. audit이 권하는 `firebase@9.14.0`은 **내려가는 것이라 하면 안 됨** | `npm audit fix`로 grpc-js만 올라가는지 보고, 남으면 무시 사유 기록 | P2 |
| SEC-DEP-07 | uuid · gaxios · @google-cloud/storage · firebase-admin | 보통 | uuid 버퍼 검사(우리는 buf를 안 넘김) | `npm audit fix`, functions도 같이 | P2 |
| SEC-DEP-08 | electron 34.5.8 | — | audit엔 없지만 Electron 34는 지원 종료(크로미움 · Node가 낡음) | 지원 버전으로 메이저 업그레이드 계획 | P2 |

`npm audit fix --force`는 쓰지 않는다(메이저가 섞임). 위 순서대로 하나씩 올리고 빌드 확인.

---

## 3. 우리가 쓰는 위험 기능 (Next.js 공지 조건과 대조)

| 기능 | 쓰는지 | 메모 |
|---|---|---|
| Server Actions(`"use server"`) | 안 씀 | Server Actions DoS는 조건상 비해당. 그래도 올린다 |
| `use cache` · Cache Components | 안 씀 | 비해당 |
| 이미지 최적화(`next/image`) | **안 씀**(10/22 확인: 모두 `<img>`, 처음 grep은 주석에 걸림) | `remotePatterns`도 없어 외부 주소 최적화 불가 |
| `next/og` ImageResponse | 씀(`app/icon-192/route.tsx`) | `force-static` · 입력 없음 → 위험 없음(10/22) |
| middleware / proxy | 없음 | 미들웨어 우회 공지 비해당 |
| `dangerouslySetInnerHTML` | `app/layout.tsx` 3곳 | 모두 고정 스크립트(테마 · 글꼴 · SW 등록). 사용자 입력 없음 → OK |

---

## 4. 전체 점검 항목 — 10/22 1회차 결과

ID: SEC-DEP(의존성) · SEC-SECRET(비밀값) · SEC-AUTH(인증 · 권한) · SEC-WEB(웹) · SEC-APP(iOS · 포터블) · SEC-OPS(운영). 👤 = 사용자 콘솔 작업

### A. 의존성 · 플랫폼
- [x] SEC-DEP-01 · 03 · 05: next 16.4.2 · sharp 0.35.5 · prosemirror-view 1.42.7, `npm audit fix` 55 → 39건 — **배포됨 1.7.7**(`9b685f4`)
- [x] SEC-DEP-02 임시 방어: 메모 링크 `_capacitor_` 경로 차단(memo.md MEMO-LINK-12) — 1.7.7
- [ ] SEC-DEP-02 Capacitor 6.2.2 + iOS 1.8 — 순서 3번째
- [x] Dependabot alerts 켬(10/22 👤). 처음 목록은 1.7.7 이전 lock 기준(handlebars · markdown-it 등 이미 고쳐진 것 포함) — 다시 스캔된 뒤 다시 보기
- [x] 👤 Dependabot **Malware alerts** 켬(10/22)
- [x] 👤 서버 런타임: Vercel Node.js Version **24.x**(10/22 사용자 확인) — 큰 버전만 고르고 패치는 Vercel이 올림, 10/21 이후 배포(1.7.7)부터 반영. Cloud Functions(Node 22)는 Google 관리 런타임, 다음 functions 배포 때 다시 확인
- [ ] 👤 로컬 Node 26.4.0 → 26.12.1 이상: Homebrew 설치라 `brew update && brew upgrade node` → `node -v`
- [ ] SEC-DEP-04 TipTap 3.x 이전(메이저) · SEC-DEP-08 Electron 34 → 지원 버전 — 따로 계획

### B. 비밀값 · 키
- [x] SEC-SECRET-01 git 전체 이력 검사(값은 가리고 종류만): README · SETUP의 키 자리는 **빈 예시**, 실제로 들어간 것은 Firebase **웹** API 키뿐(`lib/firebase.ts` 기본값 · CI 워크플로 · `GoogleService-Info.plist`) — 원래 공개되는 값. 서비스 계정 · Gemini · Resend · RevenueCat 비밀 키는 이력에 없음
- [x] SEC-SECRET-02 `NEXT_PUBLIC_*` 이름 확인: Firebase 웹 설정 · 앱 주소 · 짧은 URL · RevenueCat 공개 키 · **Google Maps 키** · 커밋 SHA. 비밀값 없음
- [x] SEC-SECRET-03 GCP 사용자 인증 정보(10/22 사용자 스크린샷): Firebase가 만든 Browser key · iOS key 둘 다 **API 제한(25개)** 걸림, 애플리케이션 제한(HTTP 리퍼러 · iOS 앱)은 없음. **그대로 두기로 판단**: Firebase 웹 키는 원래 공개되는 값이고 데이터는 규칙이 막음. 리퍼러를 걸면 포터블(`127.0.0.1:임의 포트`) · Firebase 로그인 화면(`*.firebaseapp.com`) · 로컬 개발이 깨질 위험이 이득보다 큼. Maps 키는 `app/api/geocode`(서버)에서만 읽어 브라우저로 안 나감(`NEXT_PUBLIC_` 이름은 옛 대체값) → 해당 없음. Gemini 키는 별도 GCP 프로젝트(서버 전용)
- [ ] SEC-SECRET-04 Firebase **App Check** 없음 — 웹 키로 아무나 Auth 가입 · Firestore 요청은 가능(규칙이 막음). 남용이 보이면 도입(Capacitor · 포터블 고려 필요, 보류)
- [ ] 👤 APNs .p8 · 서비스 계정 키 · Resend 키 보관 · 교체 주기(`_secrets/README.md`)

### C. 인증 · 권한
- [x] SEC-AUTH-01 API 라우트 46개 전수(10/22): 모두 인증 함수가 있음(`verifyRequestUser` · `verifyAndCheckAiQuota` · `verifyDeviceRequest` · `requireMasterUser` · CRON_SECRET · RevenueCat 헤더). 공개는 `build-info`(빌드 SHA · 버전만)와 `send-password-reset`(쿨다운 429) 둘뿐, 의도된 것
- [x] SEC-AUTH-02 10/16 이후 규칙 변경(이벤트 · 위젯 사진 · 무료 첨부 `canUpload`) 다시 읽음: 이벤트 쓰기 마스터만 · 공개 글만 읽기, 위젯 사진 본인만 · jpeg 3MB. `users`의 `role` · `premiumPurchase` · `unlockCode`는 클라이언트가 못 씀 → `isMaster()`의 `users.role` 경로 안전
- [x] SEC-AUTH-03 link-meta는 외부 주소를 가져오지 않음(SSRF 없음), geocode는 로그인 필요 + 40자
- [ ] SEC-AUTH-04 네이티브 기기 토큰 만료 · 폐기, 관리자 판정(`MASTER_EMAILS` + 이메일 인증) 다시 읽기 — 다음 회차

### D. 클라이언트 · 웹
- [x] SEC-WEB-01 보안 헤더: 운영은 `frame-ancestors 'self'` + HSTS(Vercel)뿐 → `X-Content-Type-Options: nosniff` · `Referrer-Policy` · `Permissions-Policy`(카메라 · 마이크 · 위치 · 결제 · USB 끔) 추가(`next.config.ts`) — **1.7.8 배포 대기**
- [ ] SEC-WEB-02 CSP 본문(script-src 등): TipTap · Firebase · 인라인 테마 스크립트 때문에 바로 걸면 깨짐 → `Content-Security-Policy-Report-Only`로 먼저 모으기(다음 회차)
- [x] SEC-WEB-03 메모 링크: TipTap 기본 `isAllowedUri`가 `javascript:` 등을 막고, `openExternalLink`는 http(s) · mailto · tel 외에는 https:// 를 붙임. React 19도 `javascript:` href를 막음. `_capacitor_` 차단 추가(1.7.7)
- [x] SEC-WEB-04 `dangerouslySetInnerHTML` 3곳 모두 고정 스크립트. 이벤트 본문 HTML은 `sandbox=""` iframe(스크립트 · 폼 · 링크 안 됨)
- [x] SEC-WEB-05 업로드 형식: HTML · SVG · XML 첨부 금지(10/22 사용자 "막아줘"). 화면 `lib/uploadSafety.ts`(형식 + 확장자, 가방 · 메모 · 오프라인), storage.rules `isBlockedType`(형식) — 1.7.8, **규칙 배포 필요**

### E. 앱(iOS · 포터블)
- [x] SEC-APP-01 iOS: `cleartext: false`, ATS 예외 없음, `server.url` = 운영 주소. Capacitor 앱 주소가 운영 주소라 내부 프록시 경로도 그 주소 위 → 1.7.7 링크 차단이 의미 있음
- [x] SEC-APP-02 포터블 새 창 · 이동 제한: 새 창은 PDF 미리보기(`blob:`)만, 그 밖(file: · data: · javascript:)은 막음, 메인 창은 로컬 앱 주소 밖으로 안 감(바깥 http(s)는 기본 브라우저) — `electron/main.js`, **1.7.8 배포 대기 · 포터블 확인 필요**
- [ ] SEC-APP-03 **Electron `webSecurity: false`**: 9/21 커밋 `254ad96`이 포터블(`127.0.0.1`)에서 운영 API를 부를 때 CORS에 막혀 끈 것. 고치는 법 = 서버 API에 포터블 출처용 CORS 헤더를 주거나, Electron `session.webRequest.onHeadersReceived`로 `packinbag.seeuson.com/api/*` 응답에만 CORS 헤더를 붙인 뒤 `webSecurity`를 켬. 포터블 실기 확인이 필요해 따로(확인 필요 7)
- [ ] SEC-APP-04 Capacitor 6.2.2 · iOS 1.8(SEC-DEP-02와 같이)

### F. 운영 (👤 콘솔)
- [ ] SEC-OPS-01 Firestore 백업 주기 · 복구 연습(`node scripts/backup-firestore.mjs`)
- [ ] SEC-OPS-02 Vercel · Firebase(Google) · GitHub · Apple · Namecheap · Resend 계정 **2단계 인증**
- [ ] SEC-OPS-03 GCP 예산 알림(결제 → 예산 및 알림), Vercel 사용량 알림
- [ ] SEC-OPS-04 GitHub 저장소 Settings → Code security → **Secret scanning · Push protection** 켜기(비공개 저장소에서 쓸 수 있으면)

---

## 5. 진행 방식

순서는 **1 → 3 → 2 → 4**(10/22 사용자): iOS 수정을 한 빌드에 모아 심사를 한 번만 받으려고

1. **웹 P0** — 끝, 1.7.7 배포(`9b685f4`, 포터블 태그 `v1.7.7-offline-portable`)
2. **A~F 점검** — 1회차 끝(위 체크). 바로 고칠 수 있는 것(SEC-WEB-01 · SEC-APP-02)은 고쳐 1.7.8 대기. 👤 표시는 사용자 콘솔 작업. 남은 것(CSP Report-Only · webSecurity · 업로드 형식 · 기기 토큰)은 2회차
3. **Capacitor 6.2.2 + iOS 새 빌드 1.8**(웹 1.8.0) 제출
4. 이후: 월 1회 `npm audit --omit=dev` + Dependabot, 큰 공지(Next · Node · Capacitor · Firebase)가 뜨면 1절에 추가

---

## 확인 필요

1. ~~`next/image` 외부 이미지~~ → 안 씀(10/22)
2. ~~icon-192 ImageResponse 입력~~ → 고정(10/22)
3. Vercel 프로젝트 Node 버전(👤 위 A)
4. ~~Electron `webSecurity: false` 이유~~ → 포터블에서 운영 API CORS(10/22, `254ad96`) → SEC-APP-03
5. Capacitor 이슈가 `server.url` 구조에서도 같은지 — 앱 주소가 운영 주소라 같은 위험으로 봄. 어쨌든 올린다
6. ~~프리미엄 첨부 HTML · SVG~~ → 막음(10/22 사용자)
7. webSecurity 켜기(SEC-APP-03)를 2회차에 할지 — 포터블 실기 확인 필요

## 진행 기록

| 날짜 | 누가 | 한 일 |
|---|---|---|
| 2026-10-22 | worker | 처음 작성: 오늘 이슈 대조, npm audit(루트 · functions), 위험 기능 · API 인증 · Electron 1차 점검. 코드 수정 없음 |
| 2026-10-22 | worker | 순서 1 → 3 → 2 → 4로(사용자). 1번: next · eslint-config-next 16.4.2, `npm audit fix`, `lib/linkSafety.ts` 링크 차단. 남은 audit 39건(높음 4 = firebase 클라이언트 → @grpc/grpc-js 1.9.16, 브라우저는 grpc를 안 써 실제 영향 낮음 · audit이 권하는 firebase 9.14 다운그레이드는 안 함). 사용자 요청으로 worker가 커밋 · 푸시 · 태그(`9b685f4`, v1.7.7) |
| 2026-10-22 | worker | 2번 1회차: A~F 점검(위 결과). 고침: 보안 헤더(`next.config.ts`), 포터블 새 창 · 이동 제한(`electron/main.js`) — 1.7.8 대기 |
| 2026-10-22 | worker | 사용자 답 반영: Malware alerts 켬 · Vercel 24.x · API 키는 그대로 · 첨부 HTML · SVG 막기 구현. 1.7.8 커밋 · 푸시 |
