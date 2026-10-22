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
| 이미지 최적화(`next/image`) | **씀**(Avatar · 위젯 미리보기 · 이벤트) | 원격 이미지 허용 목록(`images.remotePatterns`) 없음 → 외부 주소 최적화는 막혀 있을 것. 확인 필요 1 |
| `next/og` ImageResponse | **씀**(`app/icon-192/route.tsx`) | 입력이 고정이면 위험 낮음. 확인 필요 2 |
| middleware / proxy | 없음 | 미들웨어 우회 공지 비해당 |
| `dangerouslySetInnerHTML` | `app/layout.tsx` 3곳 | 모두 고정 스크립트(테마 · 글꼴 · SW 등록). 사용자 입력 없음 → OK |

---

## 4. 전체 점검 항목 (앞으로 순서대로)

### A. 의존성 · 플랫폼 (이번 주)
- [x] SEC-DEP-01 · 03 · 05 올림(10/22, 웹 1.7.7): next 16.4.2 · sharp 0.35.5 · prosemirror-view 1.42.7, `npm audit fix` 55건 → 39건. **배포 대기**
- [x] SEC-DEP-02 임시 방어(10/22): 메모 링크에서 `_capacitor_` 경로 차단(memo.md MEMO-LINK-12)
- [ ] SEC-DEP-02 Capacitor 6.2.2 + iOS 새 빌드(1.8, 웹 1.8.0) — 진행 순서 3번째
- [ ] 서버 런타임: Vercel 프로젝트 Node 버전 · 마지막 배포 시각 확인, Cloud Functions 다시 배포(런타임 패치 반영)
- [ ] 로컬 Node 26.4.0 → 26.12.1 이상(또는 LTS 24.22.1)
- [ ] 의존성 자동 감시: GitHub Dependabot 알림 켜기(저장소 Settings → Code security)

### B. 비밀값 · 키 (이번 주)
- [ ] 저장소 이력에 키가 들어간 적 없는지(gitleaks 같은 도구로 git 이력 검사 — 사용자 승인 후)
- [ ] `NEXT_PUBLIC_*` 환경변수에 비밀값이 없는지(이름만 확인)
- [ ] Firebase 웹 API 키 · Gemini 키에 **HTTP 리퍼러 · API 제한**이 걸렸는지(GCP 콘솔)
- [ ] APNs .p8 · 서비스 계정 키 · Resend 키 보관 위치와 교체 주기(`_secrets/README.md`)

### C. 인증 · 권한 (예전 1~3차 점검의 다시 보기)
- [ ] API 라우트 전수: 인증 함수(`verifyRequestUser` · `verifyAndCheckAiQuota` · `verifyDeviceRequest` · `requireMasterUser`) 누락 여부 — 10/22 1차 grep으로는 누락 못 찾음. `build-info`는 공개(내용 확인)
- [ ] firestore.rules · storage.rules 다시 읽기(10/16 이후 이벤트 · 무료 제한 변경분)
- [ ] 공개 라우트 남용: send-password-reset(쿨다운 있음) · shorten-url · geocode · link-meta(외부를 가져오지 않음 → SSRF 없음 확인)
- [ ] 네이티브 기기 토큰(`nativeDeviceServer`) 만료 · 폐기
- [ ] 관리자(`requireMasterUser`) 판정 기준

### D. 클라이언트 · 웹 (다음 주)
- [ ] 보안 헤더: 지금은 `frame-ancestors 'self'`만. CSP 본문 · `X-Content-Type-Options` · `Referrer-Policy` · `Permissions-Policy` · HSTS 추가 검토(CSP는 TipTap · Firebase 때문에 신중히)
- [ ] 메모(TipTap) 링크: `javascript:` 등 위험한 주소 차단, 공유 가방에서 남이 쓴 링크 열 때(Capacitor 이슈와 연결)
- [ ] 업로드 파일: 형식 · 크기 · SVG 업로드 차단 여부(storage.rules)

### E. 앱(iOS · 포터블)
- [ ] Capacitor 6.2.2(SEC-DEP-02), 장기적으로 7/8(Android 기획과 같이)
- [ ] **Electron `webSecurity: false`**(`electron/main.js:150`) — 동일 출처 정책을 끈 상태. 왜 껐는지 확인 후 켜는 방법 찾기. `setWindowOpenHandler`가 http(s)가 아닌 주소는 `allow`라 새 창을 띄움 → `deny`로
- [ ] Electron 지원 버전으로(SEC-DEP-08)

### F. 운영
- [ ] Firestore 백업 주기 · 복구 연습(`scripts/backup-firestore.mjs`)
- [ ] Vercel · Firebase · Google · GitHub · Apple 계정 2단계 인증
- [ ] 이상 징후 알림(Firebase 예산 알림, Vercel 사용량)

---

## 5. 진행 방식

순서는 **1 → 3 → 2 → 4**(10/22 사용자): iOS 수정을 한 빌드에 모아 심사를 한 번만 받으려고

1. **웹 P0**(10/22 끝, 배포 대기): next 16.4.2 · prosemirror-view 등 + Capacitor 임시 방어 → 웹 1.7.7. 웹이라 iOS 앱도 바로 받는다(server.url)
2. **A~F 점검**: 이 문서 체크박스로 하나씩. 항목마다 결과 · 날짜 · 커밋을 적는다. E(iOS · 포터블)에서 나온 앱 수정은 3번 빌드에 모은다
3. **Capacitor 6.2.2 + iOS 새 빌드 1.8**(웹 1.8.0) 제출
4. 이후: 월 1회 `npm audit --omit=dev`, 큰 공지(Next · Node · Capacitor · Firebase)가 뜨면 1절에 추가. Dependabot 알림은 지금 켜 둔다(사용자, 1분)

---

## 확인 필요

1. `next/image`에 외부 이미지가 들어가는지(Avatar에 구글 프로필 사진 주소 등) — `remotePatterns`가 없으니 `unoptimized`로 쓰는지 코드 확인
2. `app/icon-192/route.tsx` ImageResponse 입력이 고정인지
3. Vercel 프로젝트 Node 버전(Settings → Build and Deployment → Node.js Version)과 패치 적용 시점
4. Electron `webSecurity: false`를 넣은 이유(포터블 오프라인 · 로컬 서버 때문인지)
5. Capacitor 이슈가 `server.url`(원격 주소를 여는) 구조에서도 같은지 — 공지에 언급 없음. 어쨌든 올린다

## 진행 기록

| 날짜 | 누가 | 한 일 |
|---|---|---|
| 2026-10-22 | worker | 처음 작성: 오늘 이슈 대조, npm audit(루트 · functions), 위험 기능 · API 인증 · Electron 1차 점검. 코드 수정 없음 |
| 2026-10-22 | worker | 순서 1 → 3 → 2 → 4로(사용자). 1번: next · eslint-config-next 16.4.2, `npm audit fix`, `lib/linkSafety.ts` 링크 차단. 남은 audit 39건(높음 4 = firebase 클라이언트 → @grpc/grpc-js 1.9.16, 브라우저는 grpc를 안 써 실제 영향 낮음 · audit이 권하는 firebase 9.14 다운그레이드는 안 함) |
