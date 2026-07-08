# 팩인백 배포/연동 가이드 (상세판)

지금 앱을 실제로 켜서 아이폰/아이패드에서 쓰려면, 아래 순서를 **하나도 건너뛰지 말고** 그대로 따라하시면 돼요. 전부 브라우저에서 하는 클릭 작업이고, 총 30~40분 정도 걸려요.

체크리스트로 만들어뒀으니, 하나씩 끝낼 때마다 표시하면서 진행하세요.

- [ ] 1. Firebase 프로젝트 만들기
- [ ] 2. 웹 앱 등록해서 설정 키(config) 받기
- [ ] 3. 로그인 기능 켜기
- [ ] 4. 데이터베이스(Firestore) 켜기
- [ ] 5. 이미지 저장소(Storage) 켜기
- [ ] 6. 보안 규칙 붙여넣기
- [ ] 7. 내 컴퓨터에 `.env.local` 파일 만들기
- [ ] 8. GitHub에 코드 올리기
- [ ] 9. Vercel로 배포하기
- [ ] 10. 아이폰/아이패드에 설치하기
- [ ] 11. 가방 공유 테스트
- [ ] 12. 콘솔 로그 보는 법 (문제 생겼을 때)

---

## 0. 전체 그림 (왜 이렇게 많은 단계가 필요한지)

```
사용자 아이폰/아이패드/PC (브라우저 or 홈화면에 설치된 PWA)
        │
        ▼
   Vercel  ← 우리 웹앱(Next.js) 코드가 실제로 돌아가는 곳
        │
        ▼
   Firebase (구글이 운영하는 서버) ← 우리가 직접 서버를 만들 필요가 없게 해줌
     ├─ Authentication  → 로그인(이메일/구글) 처리
     ├─ Firestore        → 가방/팩 데이터 저장 + 실시간 동기화
     └─ Storage          → 가방 이미지 파일 저장
```

Firebase 쪽 설정(1~6번)이 끝나야 "로그인 버튼 눌렀을 때 뭔가 실제로 일어나는" 상태가 되고, Vercel 배포(8~9번)가 끝나야 "인터넷 어디서든 접속 가능한 주소"가 생겨요.

---

## 1. Firebase 프로젝트 만들기

1. 브라우저에서 [console.firebase.google.com](https://console.firebase.google.com) 접속
2. 구글 계정으로 로그인 (평소 쓰시는 지메일 계정이면 됩니다)
3. **"프로젝트 추가"** (Add project / 프로젝트 만들기) 버튼 클릭
4. 프로젝트 이름 입력 — 예: `packinbag` (영문/숫자 추천, 나중에 URL 일부에 쓰여요)
5. "이 프로젝트에서 Google Analytics 사용" 토글은 **꺼도 무방** (필요 없음)
6. "프로젝트 만들기" 클릭 → 1분 정도 로딩 → "계속" 클릭

✅ 완료 조건: Firebase 콘솔에 내 프로젝트 대시보드 화면이 뜨면 성공.

---

## 2. 웹 앱 등록해서 설정 키(config) 받기

1. 방금 만든 프로젝트 대시보드 한가운데(또는 상단) 아이콘들 중 **`</>`  (웹)** 아이콘을 클릭
2. 앱 닉네임 입력 — 예: `packinbag-web` (아무 이름이나 상관없음, 이건 그냥 라벨)
3. **"Firebase Hosting도 설정하기"** 체크박스는 **체크하지 마세요** (우리는 Vercel을 쓸 거라서 필요 없음)
4. "앱 등록" 클릭
5. 화면에 코드 조각이 나오는데, 그 중 `firebaseConfig = { ... }` 부분을 그대로 메모장 같은 곳에 복사해두세요. 이렇게 생겼어요:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "packinbag-xxxxx.firebaseapp.com",
     projectId: "packinbag-xxxxx",
     storageBucket: "packinbag-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```
6. "콘솔로 이동" 클릭해서 다음 단계로

✅ 완료 조건: 위 6개 값(apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)을 어딘가에 복사해뒀으면 성공. **이 값들은 나중에 7번과 9번에서 또 씁니다.**

---

## 3. 로그인 기능(Authentication) 켜기

1. 왼쪽 메뉴에서 **"Authentication"** 클릭 → **"시작하기"**(Get started) 클릭
2. **"Sign-in method"**(로그인 방법) 탭 클릭
3. 목록에서 **"이메일/비밀번호"**(Email/Password) 클릭 → 첫 번째 토글(사용 설정) 켜기 → **저장**
4. 목록에서 **"Google"** 클릭 → 사용 설정 토글 켜기 → **"프로젝트의 공개용 이름"**과 **"프로젝트 지원 이메일"**(본인 이메일 선택) 입력 → **저장**

✅ 완료 조건: Sign-in method 목록에서 이메일/비밀번호, Google 둘 다 "사용 설정됨" 상태.

---

## 4. 데이터베이스(Firestore) 켜기

1. 왼쪽 메뉴에서 **"Firestore Database"** 클릭 → **"데이터베이스 만들기"**
2. 위치(Location) 선택 화면에서 **`asia-northeast3 (Seoul)`** 선택 — 한국에서 제일 빠름. **이 선택은 나중에 못 바꾸니 신중하게.**
3. 보안 규칙 모드는 **"테스트 모드에서 시작"** 선택해도 괜찮아요 (어차피 6번에서 우리가 만든 진짜 규칙으로 덮어씌울 거예요)
4. "사용 설정" 클릭 → 로딩 후 빈 데이터베이스 화면이 뜨면 완료

✅ 완료 조건: Firestore Database 화면에 "데이터 추가" 버튼이 보이는 빈 화면이 뜨면 성공.

---

## 5. 이미지 저장소(Storage) 켜기 — 카드 등록 필요 (중요)

1. 왼쪽 메뉴에서 **"Storage"** 클릭 → **"시작하기"**
2. **2026년 2월부터 Storage는 무료(Spark) 요금제로는 켤 수 없고, 유료(Blaze) 요금제로 업그레이드해야 활성화돼요.** 화면에서 업그레이드를 요구하면:
   - "요금제 업그레이드" 또는 "Blaze로 업그레이드" 클릭
   - 결제 계정 만들기 → 신용/체크카드 정보 입력 → 완료
   - **걱정 마세요**: 지금 규모(최대 10명, 가방당 이미지 3장)라면 Firebase가 주는 무료 사용량(1GB 저장/월 10GB 전송) 안에서 끝나서 **실제 청구 금액은 $0로 예상돼요.** 카드 등록 자체는 정책상 필수라 어쩔 수 없어요.
3. Blaze 전환 후 다시 Storage 시작하기 → 위치는 4번에서 고른 것과 **동일한 리전**으로 자동 설정됨 → 완료

**추가로 해두면 좋은 것 (선택, 5분)**: 콘솔 오른쪽 위 톱니바퀴 → **"사용량 및 결제"** → **"세부정보 및 설정"** → 예산 알림 만들기 (예: 월 $5 넘으면 이메일 알림). 혹시 모를 사용량 폭증에 대비하는 안전장치예요.

✅ 완료 조건: Storage 화면에 파일 탐색기 같은 빈 화면(버킷)이 보이면 성공.

---

## 6. 보안 규칙 붙여넣기 (중요 — 절대 건너뛰지 마세요)

이 단계를 안 하면, 로그인한 사람이 **아무 가방 데이터나** 읽고 쓸 수 있는 상태가 돼요. 받은 zip 안에 이미 규칙 파일을 만들어뒀으니 붙여넣기만 하면 돼요.

1. 압축 푼 `packinbag` 폴더에서 **`firestore.rules`** 파일을 메모장으로 열기 → 전체 선택(Ctrl+A) → 복사(Ctrl+C)
2. Firebase 콘솔 → **Firestore Database** → 상단 **"규칙"**(Rules) 탭 클릭
3. 편집창 안 내용을 전부 지우고 → 방금 복사한 내용 붙여넣기 → 우측 상단 **"게시"**(Publish) 클릭
4. 같은 방식으로 `packinbag` 폴더의 **`storage.rules`** 파일을 열어서 복사
5. Firebase 콘솔 → **Storage** → 상단 **"Rules"** 탭 클릭 → 내용 전부 지우고 붙여넣기 → **"게시"**

✅ 완료 조건: Firestore 규칙 탭, Storage 규칙 탭 둘 다 "게시됨" 표시와 함께 방금 붙여넣은 내용이 보이면 성공.

---

## 7. 내 컴퓨터에 `.env.local` 파일 만들기

1. 압축 푼 `packinbag` 폴더를 여세요
2. `.env.local.example` 파일을 복사해서, 복사본 이름을 **`.env.local`** 로 바꾸세요 (점으로 시작하는 파일이라 윈도우 탐색기에서 안 보일 수 있어요 — 안 보이면 탐색기 상단 "보기" → "숨긴 항목" 체크)
3. `.env.local` 파일을 메모장으로 열고, 2번에서 복사해둔 6개 값을 아래처럼 채워넣으세요:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=packinbag-xxxxx.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=packinbag-xxxxx
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=packinbag-xxxxx.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```
4. 저장

이 파일은 **내 컴퓨터에서 테스트할 때만** 필요해요 (9번 Vercel 배포에서는 같은 값을 웹사이트에 직접 입력할 거예요). 이 파일은 절대 GitHub에 올라가지 않도록 이미 설정되어 있어요 (8번에서 확인).

**지금 로컬에서 한번 테스트해보고 싶다면:**
```bash
npm install
npm run dev
```
→ 브라우저에서 `http://localhost:3000` 열어서 회원가입/로그인이 실제로 되는지 확인. 여기서 안 되면 8~9번으로 넘어가도 똑같이 안 될 거라, 여기서 먼저 잡고 가는 걸 추천해요.

✅ 완료 조건: 로컬에서 회원가입하고 홈 화면에서 "+" 버튼으로 가방을 하나 만들 수 있으면 성공.

---

## 8. GitHub에 코드 올리기

Vercel은 GitHub에 있는 코드를 가져다가 배포하는 방식이라, 먼저 GitHub에 코드를 올려야 해요. Git 명령어가 낯설면 **GitHub Desktop**(마우스 클릭만으로 되는 프로그램)을 추천해요.

**방법 A — GitHub Desktop 사용 (추천, 초보자용)**
1. [github.com](https://github.com)에서 계정 없으면 무료 가입
2. [desktop.github.com](https://desktop.github.com)에서 GitHub Desktop 설치 후 로그인
3. 상단 메뉴 File → **"Add Local Repository"** → `packinbag` 폴더 선택
   - "이 폴더는 아직 Git 저장소가 아닙니다" 메시지가 뜨면 **"create a repository"** 클릭
4. 왼쪽 아래 "Summary" 칸에 아무 메시지(예: "첫 커밋") 입력 → **"Commit to main"** 클릭
5. 상단 **"Publish repository"** 클릭 → Private(비공개) 체크된 상태로 그대로 **"Publish Repository"** 클릭

**방법 B — 터미널 명령어 (Git 설치되어 있다면)**
```bash
cd packinbag
git init
git add .
git commit -m "first commit"
```
그다음 [github.com/new](https://github.com/new)에서 새 저장소 만들고, 거기 나오는 안내에 따라:
```bash
git remote add origin (거기 나온 저장소 주소)
git branch -M main
git push -u origin main
```

✅ 완료 조건: github.com에 로그인해서 내 계정에 `packinbag` 저장소가 보이고, 그 안에 `app`, `components` 같은 폴더들이 보이면 성공. (`.env.local`은 안 보여야 정상이에요 — 보인다면 실수로 올라간 거니 바로 삭제하고 비밀키를 새로 발급받으세요.)

---

## 9. Vercel로 배포하기

1. [vercel.com](https://vercel.com) 접속 → **"Sign Up"** → **GitHub 계정으로 로그인** (방금 그 계정)
2. 대시보드에서 **"Add New..."** → **"Project"** 클릭
3. 방금 올린 `packinbag` 저장소를 찾아서 **"Import"** 클릭
4. **"Environment Variables"** 섹션을 펼쳐서, 아까 `.env.local`에 넣었던 6개를 **하나씩** Name/Value로 입력:
   - Name: `NEXT_PUBLIC_FIREBASE_API_KEY` / Value: (그 값)
   - Name: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` / Value: (그 값)
   - ...나머지 4개도 동일하게 (총 6개)
5. 다른 설정은 그대로 두고 **"Deploy"** 클릭
6. 1~3분 기다리면 "Congratulations!" 화면과 함께 `https://packinbag-xxxx.vercel.app` 같은 주소가 생성됨

이후로는 8번의 GitHub 저장소에 변경사항을 push할 때마다 Vercel이 자동으로 재배포해줘요 (신경 쓸 필요 없음).

✅ 완료 조건: 생성된 주소를 브라우저로 열었을 때 팩인백 로그인 화면이 뜨고, 실제로 가입/로그인이 되면 성공.

---

## 10. 아이폰/아이패드에 설치하기

1. 9번에서 만든 주소(`https://packinbag-xxxx.vercel.app`)를 **사파리**로 열기 (⚠️ 크롬이나 다른 브라우저는 "홈 화면에 추가" 기능이 다르게 동작하거나 없어요, 꼭 사파리)
2. 화면 하단(아이패드는 상단 주소창 옆) **공유 버튼** 탭 — 네모 안에서 위로 화살표가 나가는 모양
3. 아이콘 목록을 아래로 스크롤 → **"홈 화면에 추가"** 탭
4. 이름 확인(기본값 "팩인백") → 오른쪽 위 **"추가"** 탭
5. 홈 화면에 아이콘이 생김 → 탭하면 사파리 주소창 없이 진짜 앱처럼 열림

아이패드도 완전히 동일한 방법이고, 안드로이드는 크롬에서 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"로 비슷하게 가능해요.

✅ 완료 조건: 홈 화면 아이콘을 탭했을 때 주소창 없이 팩인백이 열리면 성공.

---

## 11. 가방 공유 테스트하기

팩인백은 "그룹"을 미리 만드는 방식이 아니에요. **가방 하나하나마다** 초대 코드가 따로 생겨요. 팩 라이브러리(재사용 템플릿)는 공유되지 않는 개인 전용 공간이라, 다른 사람이 가방에 불러온 팩이 마음에 들면 북마크로 각자 자기 라이브러리에 복사해서 저장해야 해요.

1. 첫 번째 사람이 가입 → 홈 화면 "+"로 가방 하나 생성
2. 그 가방을 열고 상단 사람 아이콘(👥) 클릭 → **초대 코드**와 복사 아이콘 확인 → 눌러서 링크 복사
3. 그 링크(`https://.../?invite=코드`)를 카톡 등으로 다른 사람에게 전송
4. 그 사람이 링크를 열고 가입 → 홈 화면에 코드가 자동으로 채워진 "코드로 참여하기" 창이 뜸 → 참여 버튼

✅ 완료 조건: 두 계정이 같은 가방을 보게 되고, 한쪽에서 그 가방을 열고 있으면 다른 쪽 화면 상단에 접속자 아바타가 (새로고침 없이) 나타나면 성공. 각자 수정 후 "저장"을 눌러야 상대방 화면에 반영돼요.

**주의 (색인 에러가 뜨면):** 첫 로그인 후 홈 화면이 계속 로딩만 되거나 콘솔에 `The query requires an index`라는 에러가 보이면, 에러 메시지 안의 링크를 클릭하면 Firebase가 필요한 색인을 자동으로 만들어줘요 (1~2분 소요). `firestore.indexes.json`에도 정의해뒀으니 Firebase CLI로 `firebase deploy --only firestore:indexes`를 해도 돼요.

---

## 12. 콘솔 로그 보는 법 (문제 생겼을 때)

아이폰/아이패드에서 뭔가 실패했을 때, 어떤 에러인지 알아야 정확히 고칠 수 있어요. **Mac이 있어야** 볼 수 있어요.

1. 아이폰: 설정 → Safari → 고급 → "웹 속성"(iOS 16+는 "Web Inspector") 켜기
2. 아이폰을 Mac에 케이블로 연결 (같은 Wi-Fi면 무선도 가능)
3. Mac에서 Safari 실행 → Safari 환경설정 → 고급 → "메뉴 막대에 개발자용 메뉴 보기" 체크 (한 번만 하면 됨)
4. Safari 메뉴바 "개발" → 아이폰 기기 이름 → 열려있는 팩인백 웹뷰 선택 → Web Inspector 창의 **Console 탭**에서 빨간 글씨 에러 확인

문제가 재현되면 이 화면에 찍히는 에러 텍스트를 그대로 복사해두면 원인을 훨씬 빨리 찾을 수 있어요.

---

## 문제가 생겼을 때 (자주 나오는 에러)

| 증상 | 원인 / 해결 |
|---|---|
| 로그인 버튼 눌러도 반응 없고 콘솔에 `auth/invalid-api-key` | `.env.local` (또는 Vercel의 Environment Variables)에 값이 비어있거나 잘못 복사됨. 2번 값 다시 확인 |
| Firestore 관련 `permission-denied` 에러 | 6번 보안 규칙을 아직 게시 안 했거나, 자기가 속하지 않은 가방 데이터에 접근 시도한 경우. 규칙 게시 여부 확인 |
| `The query requires an index` 에러 | 11번 참고 — 에러 메시지 속 링크 클릭해서 색인 생성 (1~2분 대기) |
| 가입은 됐는데 인증 메일이 안 옴 | ① 스팸함 확인 ② 브라우저 콘솔에 `[팩인백] 인증 메일 발송 실패` 로그가 있는지 확인(실제 원인이 찍힘) ③ Firebase 콘솔 → Authentication → Templates에서 "이메일 주소 인증" 템플릿이 활성화돼 있는지 확인 ④ Authentication → Settings → 승인된 도메인에 배포 주소(예: Vercel 도메인)가 등록돼 있는지 확인 ⑤ 설정 화면 상단 배너의 "인증 메일 다시 받기"로 재시도 |
| 이미지 업로드가 안 됨 | 5번 Storage를 Blaze로 업그레이드 안 했을 가능성. Storage 화면에서 상태 확인 |
| Vercel 배포는 성공했는데 화면이 하얗게 뜸 | 브라우저 개발자도구(F12) → Console 탭에서 에러 메시지 확인, 대부분 Environment Variables 오타 |
| GitHub에 `.env.local`이 실수로 올라감 | 저장소에서 즉시 파일 삭제 + Firebase 콘솔에서 해당 웹앱을 지우고 새로 등록해서 키를 재발급받는 게 안전해요 |
| "홈 화면에 추가"가 안 보임 (아이폰) | 사파리가 아닌 다른 앱(카톡 인앱 브라우저 등)으로 열었을 가능성. 꼭 사파리 앱으로 직접 열어서 시도 |

---

## 비용 정리 (2026년 7월 기준, 최대 10명 사용 기준 예상치)

| 항목 | 비용 | 비고 |
|---|---|---|
| Firebase Auth (로그인) | **$0** | 월 5만 명까지 무료 |
| Firestore (데이터베이스) | **$0** | 하루 5만 읽기/2만 쓰기까지 무료, 10명 규모면 절대 안 넘음 |
| Firebase Storage (이미지) | **$0 (예상)** | Blaze 전환(카드 등록) 필수지만 무료 사용량 안에서 끝날 것으로 예상 |
| Vercel 웹 호스팅 | **$0** | Hobby(무료) 플랜, 비상업적 개인 프로젝트 |
| Gemini API (메모 AI 분류) | **$0 (무료 티어)** | Gemini 2.5 Flash-Lite 무료 티어 사용, 개인/그룹 규모면 충분. 아래 "부록" 참고 |
| 도메인(선택) | 연 $10~15 | 안 사면 `xxx.vercel.app` 주소 그대로 사용 가능 |
| **지금 단계 합계** | **$0/월** | |
| Apple Developer Program (나중에 네이티브 iOS 앱) | 연 $99 | PWA로 유지하면 필요 없음 |
| Google Play 등록비 (나중에 안드로이드) | 1회 $25 | 안드로이드 스토어 출시할 때만 |

⚠️ Firebase Blaze는 사용량 기반 요금제라, 위 5번의 예산 알림을 꼭 켜두세요.

---

## 앞으로 더 필요할 수 있는 것

- **Apple/카카오/네이버 로그인**: 지금은 이메일+구글만. 나중에 추가 원하시면 말씀해주세요.
- **가방 멤버 관리 강화**: 멤버 목록 보기, 강퇴, 방장 위임 등은 필요해지면 추가
- **이메일 인증 메일 커스텀 디자인**: 지금은 Firebase 기본 인증 메일(무료)이에요. Firebase 콘솔 → Authentication → Templates에서 발신자 이름/제목/본문 텍스트 정도는 무료로 바꿀 수 있어요. 로고가 들어간 완전히 커스텀한 디자인을 원하면 나중에 Cloud Functions(Blaze) + 이메일 발송 서비스 조합으로 확장하면 돼요.
- **오프라인 지원**: Firestore 오프라인 캐시로 확장 가능
- **커스텀 도메인**: Vercel 프로젝트 설정 → Domains에서 구매한 도메인 연결 가능

---

## 부록. "메모에서 가져오기" AI 기능 설정 (Gemini API 키)

홈 화면 "+" → "메모에서 가져오기"로 아이폰 메모 내용을 붙여넣으면, AI(Google Gemini)가 내용을 읽고 자동으로 팩(카테고리)별로 분류해서 가방을 채워줘요. 이 기능은 Gemini API 키가 있어야 동작해요. Gemini는 신용카드 등록 없이 무료로 시작할 수 있어요.

1. [aistudio.google.com](https://aistudio.google.com) 접속 → 구글 계정으로 로그인
2. 좌측 메뉴 **"Get API key"** → **"Create API key"** 클릭 → 생성된 키 복사 (`AIza...`로 시작)
3. `.env.local` 파일(7번 참고)에 아래 줄 추가
   ```
   GEMINI_API_KEY=AIza여기에복사한키
   ```
4. **배포용(Vercel)**: Vercel 프로젝트 → **Settings → Environment Variables**에서 Name `GEMINI_API_KEY` / Value에 같은 키 입력 → 저장 후 재배포(Deployments 탭 → 최신 배포 옆 "..." → Redeploy)

⚠️ 이 키는 절대 `NEXT_PUBLIC_` 접두사를 붙이면 안 돼요 (앱 코드에도 그렇게 안 되어 있어요) — 접두사가 붙으면 브라우저에 노출되어 다른 사람이 내 API 사용량으로 요금을 쓸 수 있어요. 지금 구현은 서버(API 라우트)에서만 이 키를 사용하도록 되어 있어 안전해요.

**무료 티어 관련 참고사항**:
- 현재 코드는 `gemini-2.5-flash-lite` 모델을 사용해요 — 무료 티어가 남아있는 모델 중 가장 저렴하고 이런 분류 작업엔 충분한 성능이에요.
- 무료 티어는 분당 요청 수 제한이 있어요. 개인/그룹 규모(하루 몇 건)에서는 문제없지만, 만약 나중에 "메모에서 가져오기"를 자주 쓰다가 오류가 난다면 잠시 후 다시 시도하거나 유료 결제(카드 등록)로 전환하면 해결돼요.
- 무료 티어로 보낸 내용은 구글이 모델 개선에 활용할 수 있어요. 여행 준비물 메모라 큰 민감정보는 아니지만, 신경 쓰인다면 나중에 결제를 등록해 유료 티어로 전환하면 이 조건이 없어져요.
- 정확한 최신 요금/무료 한도는 시간이 지나며 바뀔 수 있어서, [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)에서 한 번 확인해보는 걸 추천해요.

✅ 완료 조건: 키를 넣고 재배포한 뒤, 앱에서 "메모에서 가져오기"로 아무 텍스트나 붙여넣고 "AI로 분석하기"를 눌렀을 때 팩이 자동으로 채워진 가방 편집 화면이 뜨면 성공.
