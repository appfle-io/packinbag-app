# 팩인백 (Pack In Bag)

여행 짐 싸기용 공유 체크리스트 PWA. 최대 10명이 하나의 **가방(체크리스트)**을 초대코드로 함께 실시간 편집할 수 있어요.

## 주요 기능

- **가방 / 팩 / 짐**: 가방(체크리스트) 안에 팩(카테고리)을 담고, 팩 안에 짐(체크/텍스트 항목)을 담는 구조
- **가방 단위 공유**: 그룹이 아니라 가방마다 초대코드가 생성됨. 코드로 참여한 사람과 최대 10명까지 동시 편집 가능
- **실시간 접속자 표시**: 가방을 같이 보고 있는 사람의 캐릭터 아바타가 상단에 표시됨 (3명 이상이면 "+N"으로 축약)
- **팩 라이브러리**: 자주 쓰는 짐 묶음을 재사용 템플릿으로 저장. 개인 전용이며, 북마크로 가방 ↔ 라이브러리 동기화
- **회원가입**: 이메일/비밀번호(비밀번호 확인 포함) 또는 구글 로그인, 랜덤 추천 닉네임 + 캐릭터 아바타 선택
- **이메일 인증**: 가입 시 인증 메일 발송 (Firebase 기본 템플릿)
- **다크/라이트/시스템 테마**, PWA 설치 지원 (홈 화면 추가)
- iOS/Mac 네이티브 앱 배포는 Capacitor로 진행 중 (`APP_STORE_GUIDE.md` 참고)

## 기술 스택

Next.js + Tailwind CSS · Firebase (Auth / Firestore / Storage) · Vercel · Capacitor

## 로컬 개발

```bash
npm install
npm run dev
```

Firebase 프로젝트 설정, 배포, 앱스토어 등록은 [`SETUP.md`](./SETUP.md), [`APP_STORE_GUIDE.md`](./APP_STORE_GUIDE.md) 참고.

## 로드맵

- [ ] iOS/iPadOS/Mac 위젯 (WidgetKit)
- [ ] Apple / Kakao / Naver 로그인
- [ ] Android 지원
