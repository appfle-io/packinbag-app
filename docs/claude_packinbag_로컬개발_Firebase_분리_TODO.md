# 로컬 개발용 Firebase 프로젝트 분리 — 하지 않기로 결정 (2026-10-08)

> **결정(10/8): 분리하지 않는다.** 사용자 결정. 로컬에서 하는 모든 테스트는 곧 운영 데이터라는 전제로 작업한다.
>
> 대신 지키는 것
> - 큰 데이터 변경·이전 전에는 반드시 전체 백업: `node scripts/backup-firestore.mjs` → `backups/firestore-날짜-시각.json`(gitignore, 절대 커밋 금지). 운영 데이터를 읽기만 한다
> - 데이터 이전 스크립트는 기본이 미리 보기, `--apply`를 붙여야 실제로 바뀐다(예: `scripts/migrate-bag-notes.mjs`). 여러 번 실행해도 안전하게 만든다
> - 규칙 배포는 `npx firebase-tools deploy --only firestore:rules,storage`. 새 규칙이 기존 데이터에 걸리지 않는지 먼저 따진다
> - 다시 검토할 때: 테스트 계정·테스트 데이터가 운영에 쌓여 정리가 번거로워지거나, 위험한 대규모 변경(스키마 변경 등)을 자주 하게 될 때
>
> 아래는 예전에 정리해 둔 분리 방법(참고용).

## 배경 (2026-08-25)
이메일 인증 Resend 전환 작업을 하면서 로컬(`npm run dev`)로 실제 운영 계정(오래 쓰던 이메일 계정)에 로그인해 테스트하다가, 브라우저의 Firestore 로컬 캐시가 비어있던 탓에 "처음 가입"으로 오판되어 온보딩 샘플 데이터가 실제 계정에 잘못 심어지는 사고가 있었음 (원인 확인 후 코드에 방어 로직 추가로 수정 완료 - `contexts/AuthProvider.tsx`의 `completeProfile`이 이제 기존 가방이 있으면 샘플을 안 심음).

## 문제의 근본 구조
로컬 개발 서버와 운영 서비스(packinbag.seeuson.com)가 **같은 Firebase 프로젝트(같은 Firestore/Auth)를 그대로 공유**하고 있음. `.firebaserc`에 별도 dev/staging 프로젝트가 없음. 그래서 로컬에서 테스트하다 실수하면 그게 곧바로 실제 운영 데이터에 영향을 줌 - 이번 사고가 그 사례.

## 제안하는 개선
1. Firebase 콘솔에서 별도의 개발/테스트용 프로젝트 신규 생성
2. 로컬 `.env.local`의 `NEXT_PUBLIC_FIREBASE_*` 값들만 그 테스트 프로젝트로 교체
3. `FIREBASE_SERVICE_ACCOUNT_KEY`(Admin SDK)도 테스트 프로젝트의 서비스 계정 키로 교체
4. Vercel 배포(운영)는 지금 쓰는 진짜 프로젝트 그대로 유지 - 운영 환경변수는 안 건드림
5. (선택) 테스트 프로젝트에 firestore.rules·storage.rules·인덱스(firestore.indexes.json)를 운영과 동일하게 배포해 두면 로컬에서도 실제와 같은 규칙으로 테스트 가능
6. 포터블 빌드(`.github/workflows/desktop-portable-release.yml`)는 운영 Firebase 값을 직접 넣고 있으니 그대로 둔다(로컬 .env.local만 바꿈)
7. 관리자 테스트용으로 `NEXT_PUBLIC_MASTER_EMAILS`에 테스트 계정 이메일을 넣는다

이렇게 분리하면 로컬에서 아무리 테스트해도 실제 사용자 데이터에 영향이 안 감. 다시 하기로 하면 위 순서대로 셋업하면 된다.
